import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import db from '../database/db';
import { createUploadMiddleware, UPLOADS_BASE } from '../middleware/upload';
import { analyzePhoto } from '../services/ai';

const router = Router({ mergeParams: true });

// GET /api/hotels/:hotelId/photos
router.get('/', (req: Request, res: Response) => {
  try {
    const hid = Array.isArray(req.params.hotelId) ? req.params.hotelId[0] : req.params.hotelId;
    const photos = db.prepare(`
      SELECT * FROM photos WHERE hotel_id = ? ORDER BY created_at DESC
    `).all(hid) as Record<string, unknown>[];

    const parsed = photos.map(p => ({
      ...p,
      analysis: JSON.parse((p.analysis as string) || '{}'),
      tags: JSON.parse((p.tags as string) || '[]'),
      url: `/uploads/hotels/${hid}/${p.filename}`,
    }));

    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// POST /api/hotels/:hotelId/photos - Upload photos
router.post('/', async (req: Request, res: Response) => {
  const hotelId = Array.isArray(req.params.hotelId) ? req.params.hotelId[0] : req.params.hotelId;
  const upload = createUploadMiddleware(hotelId);

  upload.array('photos', 20)(req, res, async (err) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'Nenhuma foto enviada' });
      return;
    }

    const results = [];

    for (const file of files) {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO photos (id, hotel_id, filename, original_name, path, size)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, req.params.hotelId, file.filename, file.originalname, file.path, file.size);

      results.push({
        id,
        filename: file.filename,
        original_name: file.originalname,
        url: `/uploads/hotels/${req.params.hotelId}/${file.filename}`,
        size: file.size,
        analysis: {},
        tags: [],
      });
    }

    res.status(201).json(results);
  });
});

// POST /api/hotels/:hotelId/photos/:photoId/analyze - AI analyze photo
router.post('/:photoId/analyze', async (req: Request, res: Response) => {
  try {
    const photo = db.prepare('SELECT * FROM photos WHERE id = ? AND hotel_id = ?')
      .get(req.params.photoId, req.params.hotelId) as Record<string, unknown> | undefined;

    if (!photo) {
      res.status(404).json({ error: 'Photo not found' });
      return;
    }

    const analysis = await analyzePhoto(photo.path as string);

    db.prepare(`
      UPDATE photos SET
        analysis = ?,
        tags = ?,
        description = ?
      WHERE id = ?
    `).run(
      JSON.stringify(analysis),
      JSON.stringify(analysis.tags || []),
      analysis.description,
      req.params.photoId
    );

    const updated = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.photoId) as Record<string, unknown>;
    res.json({
      ...updated,
      analysis: JSON.parse((updated.analysis as string) || '{}'),
      tags: JSON.parse((updated.tags as string) || '[]'),
      url: `/uploads/hotels/${req.params.hotelId}/${updated.filename}`,
    });
  } catch (error) {
    console.error('Analyze error:', error);
    res.status(500).json({ error: 'Failed to analyze photo' });
  }
});

// DELETE /api/hotels/:hotelId/photos/:photoId
router.delete('/:photoId', (req: Request, res: Response) => {
  try {
    const photo = db.prepare('SELECT * FROM photos WHERE id = ? AND hotel_id = ?')
      .get(req.params.photoId, req.params.hotelId) as Record<string, unknown> | undefined;

    if (!photo) {
      res.status(404).json({ error: 'Photo not found' });
      return;
    }

    // Delete file
    const hid2 = Array.isArray(req.params.hotelId) ? req.params.hotelId[0] : req.params.hotelId;
    const filePath = path.join(UPLOADS_BASE, 'hotels', hid2, photo.filename as string);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    db.prepare('DELETE FROM photos WHERE id = ?').run(req.params.photoId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

export default router;
