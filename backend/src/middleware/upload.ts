import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const UPLOADS_DIR = path.join(__dirname, '../../../uploads');

export function createUploadMiddleware(hotelId: string) {
  const hotelDir = path.join(UPLOADS_DIR, 'hotels', hotelId);
  if (!fs.existsSync(hotelDir)) {
    fs.mkdirSync(hotelDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, hotelDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const filename = `${uuidv4()}${ext}`;
      cb(null, filename);
    },
  });

  return multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (_req, file, cb) => {
      const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Apenas imagens são permitidas (JPG, PNG, WEBP, GIF)'));
      }
    },
  });
}

export const UPLOADS_BASE = UPLOADS_DIR;
