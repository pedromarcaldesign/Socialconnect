import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Resolve .env from project root (works for both dev and cPanel production)
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

import hotelsRouter from './routes/hotels';
import photosRouter from './routes/photos';
import postsRouter from './routes/posts';
import imagesRouter from './routes/images';

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'https://hotels.moh.pt',
    'http://hotels.moh.pt',
  ],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/hotels', hotelsRouter);
app.use('/api/hotels/:hotelId/photos', photosRouter);
app.use('/api/posts', postsRouter);
app.use('/api/images', imagesRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    unsplash: !!process.env.UNSPLASH_ACCESS_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendBuild = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendBuild));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendBuild, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🏨 SocialConnect backend running on http://localhost:${PORT}`);
  console.log(`   Anthropic API: ${process.env.ANTHROPIC_API_KEY ? '✅ Configured' : '⚠️  Not configured (mock mode)'}`);
  console.log(`   Unsplash API: ${process.env.UNSPLASH_ACCESS_KEY ? '✅ Configured' : '⚠️  Not configured'}`);
});

export default app;
