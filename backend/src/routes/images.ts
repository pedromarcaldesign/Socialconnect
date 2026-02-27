import { Router, Request, Response } from 'express';
import { searchStockImages } from '../services/imageSearch';

const router = Router();

// GET /api/images/search?q=hotel+pool&per_page=12
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, per_page = '12' } = req.query;

    if (!q) {
      res.status(400).json({ error: 'Query parameter "q" is required' });
      return;
    }

    const images = await searchStockImages(q as string, parseInt(per_page as string, 10));
    res.json(images);
  } catch (error) {
    console.error('Image search error:', error);
    res.status(500).json({ error: 'Failed to search images' });
  }
});

export default router;
