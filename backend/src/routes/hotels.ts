import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/db';
import { scrapeHotelInfo } from '../services/scraper';
import { extractHotelInfo } from '../services/ai';

const router = Router();

// GET /api/hotels
router.get('/', (_req: Request, res: Response) => {
  try {
    const hotels = db.prepare(`
      SELECT h.*,
        (SELECT COUNT(*) FROM photos WHERE hotel_id = h.id) as photo_count,
        (SELECT COUNT(*) FROM posts WHERE hotel_id = h.id AND status = 'draft') as draft_count,
        (SELECT COUNT(*) FROM posts WHERE hotel_id = h.id AND status = 'approved') as approved_count
      FROM hotels h
      ORDER BY h.created_at DESC
    `).all();

    const parsed = (hotels as Record<string, unknown>[]).map((h) => ({
      ...h,
      amenities: JSON.parse((h.amenities as string) || '[]'),
      keywords: JSON.parse((h.keywords as string) || '[]'),
      scraped_data: JSON.parse((h.scraped_data as string) || '{}'),
    }));

    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch hotels' });
  }
});

// GET /api/hotels/:id
router.get('/:id', (req: Request, res: Response) => {
  try {
    const hotel = db.prepare('SELECT * FROM hotels WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;

    if (!hotel) {
      res.status(404).json({ error: 'Hotel not found' });
      return;
    }

    res.json({
      ...hotel,
      amenities: JSON.parse((hotel.amenities as string) || '[]'),
      keywords: JSON.parse((hotel.keywords as string) || '[]'),
      scraped_data: JSON.parse((hotel.scraped_data as string) || '{}'),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch hotel' });
  }
});

// POST /api/hotels
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, website, description, location, stars, amenities, tone, instagram_handle, facebook_page, target_audience, keywords } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Nome do hotel é obrigatório' });
      return;
    }

    const id = uuidv4();

    db.prepare(`
      INSERT INTO hotels (id, name, website, description, location, stars, amenities, tone, instagram_handle, facebook_page, target_audience, keywords)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      website || null,
      description || null,
      location || null,
      stars || null,
      JSON.stringify(amenities || []),
      tone || 'profissional e acolhedor',
      instagram_handle || null,
      facebook_page || null,
      target_audience || null,
      JSON.stringify(keywords || [])
    );

    const hotel = db.prepare('SELECT * FROM hotels WHERE id = ?').get(id) as Record<string, unknown>;
    res.status(201).json({
      ...hotel,
      amenities: JSON.parse((hotel.amenities as string) || '[]'),
      keywords: JSON.parse((hotel.keywords as string) || '[]'),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create hotel' });
  }
});

// POST /api/hotels/:id/scrape - Scrape hotel info
router.post('/:id/scrape', async (req: Request, res: Response) => {
  try {
    const hotel = db.prepare('SELECT * FROM hotels WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;

    if (!hotel) {
      res.status(404).json({ error: 'Hotel not found' });
      return;
    }

    // Scrape info
    const scraped = await scrapeHotelInfo(hotel.name as string, hotel.website as string | undefined);

    // Extract structured info using AI
    const combinedContent = `${scraped.title}\n${scraped.description}\n${scraped.content}`;
    const hotelInfo = await extractHotelInfo(hotel.name as string, combinedContent);

    // Update hotel with scraped data
    db.prepare(`
      UPDATE hotels SET
        description = COALESCE(?, description),
        location = COALESCE(?, location),
        stars = COALESCE(?, stars),
        amenities = ?,
        tone = COALESCE(?, tone),
        target_audience = COALESCE(?, target_audience),
        keywords = ?,
        instagram_handle = COALESCE(?, instagram_handle),
        facebook_page = COALESCE(?, facebook_page),
        scraped_data = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      hotelInfo.description || null,
      hotelInfo.location || null,
      hotelInfo.stars || null,
      JSON.stringify(hotelInfo.amenities || []),
      hotelInfo.tone || null,
      hotelInfo.target_audience || null,
      JSON.stringify(hotelInfo.keywords || []),
      hotelInfo.instagram_handle || null,
      hotelInfo.facebook_page || null,
      JSON.stringify({ ...hotelInfo, scraped_url: scraped.url, scraped_at: new Date().toISOString() }),
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM hotels WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    res.json({
      ...updated,
      amenities: JSON.parse((updated.amenities as string) || '[]'),
      keywords: JSON.parse((updated.keywords as string) || '[]'),
      scraped_data: JSON.parse((updated.scraped_data as string) || '{}'),
    });
  } catch (error) {
    console.error('Scrape error:', error);
    res.status(500).json({ error: 'Failed to scrape hotel info' });
  }
});

// PUT /api/hotels/:id
router.put('/:id', (req: Request, res: Response) => {
  try {
    const hotel = db.prepare('SELECT * FROM hotels WHERE id = ?').get(req.params.id);
    if (!hotel) {
      res.status(404).json({ error: 'Hotel not found' });
      return;
    }

    const { name, website, description, location, stars, amenities, tone, instagram_handle, facebook_page, target_audience, keywords } = req.body;

    db.prepare(`
      UPDATE hotels SET
        name = COALESCE(?, name),
        website = ?,
        description = ?,
        location = ?,
        stars = ?,
        amenities = ?,
        tone = ?,
        instagram_handle = ?,
        facebook_page = ?,
        target_audience = ?,
        keywords = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name || null,
      website || null,
      description || null,
      location || null,
      stars || null,
      JSON.stringify(amenities || []),
      tone || 'profissional e acolhedor',
      instagram_handle || null,
      facebook_page || null,
      target_audience || null,
      JSON.stringify(keywords || []),
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM hotels WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    res.json({
      ...updated,
      amenities: JSON.parse((updated.amenities as string) || '[]'),
      keywords: JSON.parse((updated.keywords as string) || '[]'),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update hotel' });
  }
});

// DELETE /api/hotels/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM hotels WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Hotel not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete hotel' });
  }
});

export default router;
