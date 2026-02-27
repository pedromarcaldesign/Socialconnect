import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/db';
import { generatePost, translatePost, suggestPhotoForIdea } from '../services/ai';

const router = Router();

// GET /api/posts
router.get('/', (req: Request, res: Response) => {
  try {
    const { status, hotel_id } = req.query;

    let query = `
      SELECT p.*,
        h.name as hotel_name,
        h.location as hotel_location,
        ph.filename as photo_filename,
        ph.description as photo_description
      FROM posts p
      LEFT JOIN hotels h ON p.hotel_id = h.id
      LEFT JOIN photos ph ON p.photo_id = ph.id
    `;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status) {
      conditions.push('p.status = ?');
      params.push(status);
    }
    if (hotel_id) {
      conditions.push('p.hotel_id = ?');
      params.push(hotel_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY p.created_at DESC';

    const posts = db.prepare(query).all(...params) as Record<string, unknown>[];

    const parsed = posts.map(p => ({
      ...p,
      hashtags: JSON.parse((p.hashtags as string) || '[]'),
      photo_url: p.photo_filename ? `/uploads/hotels/${p.hotel_id}/${p.photo_filename}` : null,
    }));

    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// GET /api/posts/:id
router.get('/:id', (req: Request, res: Response) => {
  try {
    const post = db.prepare(`
      SELECT p.*,
        h.name as hotel_name, h.location as hotel_location, h.tone as hotel_tone,
        ph.filename as photo_filename, ph.description as photo_description, ph.tags as photo_tags
      FROM posts p
      LEFT JOIN hotels h ON p.hotel_id = h.id
      LEFT JOIN photos ph ON p.photo_id = ph.id
      WHERE p.id = ?
    `).get(req.params.id) as Record<string, unknown> | undefined;

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    res.json({
      ...post,
      hashtags: JSON.parse((post.hashtags as string) || '[]'),
      photo_url: post.photo_filename ? `/uploads/hotels/${post.hotel_id}/${post.photo_filename}` : null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// POST /api/posts/generate/batch - Generate posts for multiple hotels
router.post('/generate/batch', async (req: Request, res: Response) => {
  try {
    const { hotel_ids, platform = 'both' } = req.body;

    if (!hotel_ids || !Array.isArray(hotel_ids) || hotel_ids.length === 0) {
      res.status(400).json({ error: 'Lista de hotéis é obrigatória' });
      return;
    }

    const results = [];

    for (const hotelId of hotel_ids) {
      const hotel = db.prepare('SELECT * FROM hotels WHERE id = ?').get(hotelId) as Record<string, unknown> | undefined;
      if (!hotel) continue;

      // Get a random photo from the hotel that has been analyzed
      const photos = db.prepare(`
        SELECT * FROM photos
        WHERE hotel_id = ? AND analysis != '{}'
        ORDER BY RANDOM()
        LIMIT 1
      `).all(hotelId) as Record<string, unknown>[];

      // Fallback to any photo if no analyzed ones
      const photo = photos.length > 0 ? photos[0] :
        db.prepare('SELECT * FROM photos WHERE hotel_id = ? ORDER BY RANDOM() LIMIT 1').get(hotelId) as Record<string, unknown> | undefined;

      const analysis = photo ? JSON.parse((photo.analysis as string) || '{}') : {};

      const generated = await generatePost({
        hotelName: hotel.name as string,
        hotelDescription: (hotel.description as string) || '',
        hotelTone: (hotel.tone as string) || 'profissional e acolhedor',
        hotelKeywords: JSON.parse((hotel.keywords as string) || '[]'),
        hotelAmenities: JSON.parse((hotel.amenities as string) || '[]'),
        hotelLocation: (hotel.location as string) || '',
        photoDescription: analysis.description,
        photoTags: analysis.tags,
        photoMood: analysis.mood,
        photoSetting: analysis.setting,
        platform,
        targetAudience: hotel.target_audience as string,
      });

      const postId = uuidv4();
      db.prepare(`
        INSERT INTO posts (id, hotel_id, photo_id, platform, text_pt, hashtags, status, generation_mode)
        VALUES (?, ?, ?, ?, ?, ?, 'draft', 'batch')
      `).run(
        postId,
        hotelId,
        photo?.id || null,
        platform,
        generated.text_pt,
        JSON.stringify(generated.hashtags)
      );

      results.push({
        id: postId,
        hotel_id: hotelId,
        hotel_name: hotel.name,
        text_pt: generated.text_pt,
        hashtags: generated.hashtags,
        platform_tip: generated.platform_tip,
        photo_url: photo ? `/uploads/hotels/${hotelId}/${photo.filename}` : null,
        status: 'draft',
      });
    }

    res.status(201).json(results);
  } catch (error) {
    console.error('Batch generate error:', error);
    res.status(500).json({ error: 'Failed to generate posts' });
  }
});

// POST /api/posts/generate/manual - Generate post with chosen hotel + photo
router.post('/generate/manual', async (req: Request, res: Response) => {
  try {
    const { hotel_id, photo_id, platform = 'both', stock_image_url, stock_image_credit } = req.body;

    if (!hotel_id) {
      res.status(400).json({ error: 'Hotel é obrigatório' });
      return;
    }

    const hotel = db.prepare('SELECT * FROM hotels WHERE id = ?').get(hotel_id) as Record<string, unknown> | undefined;
    if (!hotel) {
      res.status(404).json({ error: 'Hotel not found' });
      return;
    }

    let photo: Record<string, unknown> | undefined;
    let analysis: Record<string, unknown> = {};

    if (photo_id) {
      photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(photo_id) as Record<string, unknown>;
      if (photo) {
        analysis = JSON.parse((photo.analysis as string) || '{}');
      }
    }

    const generated = await generatePost({
      hotelName: hotel.name as string,
      hotelDescription: (hotel.description as string) || '',
      hotelTone: (hotel.tone as string) || 'profissional e acolhedor',
      hotelKeywords: JSON.parse((hotel.keywords as string) || '[]'),
      hotelAmenities: JSON.parse((hotel.amenities as string) || '[]'),
      hotelLocation: (hotel.location as string) || '',
      photoDescription: analysis.description as string,
      photoTags: analysis.tags as string[],
      photoMood: analysis.mood as string,
      photoSetting: analysis.setting as string,
      platform,
      targetAudience: hotel.target_audience as string,
    });

    const postId = uuidv4();
    db.prepare(`
      INSERT INTO posts (id, hotel_id, photo_id, stock_image_url, stock_image_credit, platform, text_pt, hashtags, status, generation_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'manual')
    `).run(
      postId,
      hotel_id,
      photo_id || null,
      stock_image_url || null,
      stock_image_credit || null,
      platform,
      generated.text_pt,
      JSON.stringify(generated.hashtags)
    );

    res.status(201).json({
      id: postId,
      hotel_id,
      hotel_name: hotel.name,
      text_pt: generated.text_pt,
      hashtags: generated.hashtags,
      platform_tip: generated.platform_tip,
      photo_url: photo ? `/uploads/hotels/${hotel_id}/${photo.filename}` : null,
      stock_image_url: stock_image_url || null,
      status: 'draft',
    });
  } catch (error) {
    console.error('Manual generate error:', error);
    res.status(500).json({ error: 'Failed to generate post' });
  }
});

// POST /api/posts/generate/idea - Generate post from idea
router.post('/generate/idea', async (req: Request, res: Response) => {
  try {
    const { hotel_id, idea, platform = 'both' } = req.body;

    if (!hotel_id || !idea) {
      res.status(400).json({ error: 'Hotel e ideia são obrigatórios' });
      return;
    }

    const hotel = db.prepare('SELECT * FROM hotels WHERE id = ?').get(hotel_id) as Record<string, unknown> | undefined;
    if (!hotel) {
      res.status(404).json({ error: 'Hotel not found' });
      return;
    }

    // Get all analyzed photos for suggestion
    const allPhotos = db.prepare(`
      SELECT id, description, tags, analysis FROM photos
      WHERE hotel_id = ?
    `).all(hotel_id) as Record<string, unknown>[];

    const photosForSuggestion = allPhotos.map(p => {
      const analysis = JSON.parse((p.analysis as string) || '{}');
      return {
        id: p.id as string,
        description: (p.description as string) || analysis.description || '',
        tags: JSON.parse((p.tags as string) || '[]'),
        setting: analysis.setting || 'hotel',
      };
    }).filter(p => p.description || p.tags.length > 0);

    // Suggest a photo based on idea
    const suggestedPhotoId = photosForSuggestion.length > 0
      ? await suggestPhotoForIdea(idea, photosForSuggestion)
      : null;

    const photo = suggestedPhotoId
      ? db.prepare('SELECT * FROM photos WHERE id = ?').get(suggestedPhotoId) as Record<string, unknown>
      : undefined;

    const analysis = photo ? JSON.parse((photo.analysis as string) || '{}') : {};

    const generated = await generatePost({
      hotelName: hotel.name as string,
      hotelDescription: (hotel.description as string) || '',
      hotelTone: (hotel.tone as string) || 'profissional e acolhedor',
      hotelKeywords: JSON.parse((hotel.keywords as string) || '[]'),
      hotelAmenities: JSON.parse((hotel.amenities as string) || '[]'),
      hotelLocation: (hotel.location as string) || '',
      photoDescription: analysis.description,
      photoTags: analysis.tags,
      photoMood: analysis.mood,
      photoSetting: analysis.setting,
      platform,
      idea,
      targetAudience: hotel.target_audience as string,
    });

    const postId = uuidv4();
    db.prepare(`
      INSERT INTO posts (id, hotel_id, photo_id, platform, text_pt, hashtags, status, generation_mode, idea)
      VALUES (?, ?, ?, ?, ?, ?, 'draft', 'idea', ?)
    `).run(
      postId,
      hotel_id,
      photo?.id || null,
      platform,
      generated.text_pt,
      JSON.stringify(generated.hashtags),
      idea
    );

    res.status(201).json({
      id: postId,
      hotel_id,
      hotel_name: hotel.name,
      text_pt: generated.text_pt,
      hashtags: generated.hashtags,
      platform_tip: generated.platform_tip,
      suggested_photo_id: photo?.id || null,
      photo_url: photo ? `/uploads/hotels/${hotel_id}/${photo.filename}` : null,
      idea,
      status: 'draft',
    });
  } catch (error) {
    console.error('Idea generate error:', error);
    res.status(500).json({ error: 'Failed to generate post from idea' });
  }
});

// PUT /api/posts/:id - Edit post
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { text_pt, text_en, hashtags, platform, photo_id, stock_image_url, stock_image_credit } = req.body;

    db.prepare(`
      UPDATE posts SET
        text_pt = COALESCE(?, text_pt),
        text_en = ?,
        hashtags = COALESCE(?, hashtags),
        platform = COALESCE(?, platform),
        photo_id = ?,
        stock_image_url = ?,
        stock_image_credit = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      text_pt || null,
      text_en !== undefined ? text_en : null,
      hashtags ? JSON.stringify(hashtags) : null,
      platform || null,
      photo_id !== undefined ? photo_id : undefined,
      stock_image_url !== undefined ? stock_image_url : null,
      stock_image_credit !== undefined ? stock_image_credit : null,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!updated) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    res.json({
      ...updated,
      hashtags: JSON.parse((updated.hashtags as string) || '[]'),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// POST /api/posts/:id/approve - Approve post
router.post('/:id/approve', (req: Request, res: Response) => {
  try {
    const result = db.prepare(`
      UPDATE posts SET status = 'approved', updated_at = datetime('now') WHERE id = ?
    `).run(req.params.id);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve post' });
  }
});

// POST /api/posts/:id/unapprove - Move back to draft
router.post('/:id/unapprove', (req: Request, res: Response) => {
  try {
    db.prepare(`
      UPDATE posts SET status = 'draft', updated_at = datetime('now') WHERE id = ?
    `).run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unapprove post' });
  }
});

// POST /api/posts/:id/translate - Translate to English
router.post('/:id/translate', async (req: Request, res: Response) => {
  try {
    const post = db.prepare(`
      SELECT p.*, h.name as hotel_name FROM posts p
      LEFT JOIN hotels h ON p.hotel_id = h.id
      WHERE p.id = ?
    `).get(req.params.id) as Record<string, unknown> | undefined;

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const text_en = await translatePost(post.text_pt as string, post.hotel_name as string);

    db.prepare(`
      UPDATE posts SET text_en = ?, is_bilingual = 1, updated_at = datetime('now') WHERE id = ?
    `).run(text_en, req.params.id);

    res.json({ text_en, is_bilingual: true });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Failed to translate post' });
  }
});

// POST /api/posts/:id/toggle-bilingual
router.post('/:id/toggle-bilingual', (req: Request, res: Response) => {
  try {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const newValue = post.is_bilingual ? 0 : 1;
    db.prepare('UPDATE posts SET is_bilingual = ? WHERE id = ?').run(newValue, req.params.id);
    res.json({ is_bilingual: newValue === 1 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle bilingual' });
  }
});

// DELETE /api/posts/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

export default router;
