import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(__dirname, '../../data/socialconnect.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS hotels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    website TEXT,
    description TEXT,
    location TEXT,
    stars INTEGER,
    amenities TEXT DEFAULT '[]',
    tone TEXT DEFAULT 'professional and welcoming',
    instagram_handle TEXT,
    facebook_page TEXT,
    target_audience TEXT,
    keywords TEXT DEFAULT '[]',
    scraped_data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    hotel_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    path TEXT NOT NULL,
    size INTEGER,
    analysis TEXT DEFAULT '{}',
    tags TEXT DEFAULT '[]',
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    hotel_id TEXT NOT NULL,
    photo_id TEXT,
    stock_image_url TEXT,
    stock_image_credit TEXT,
    platform TEXT NOT NULL DEFAULT 'both',
    text_pt TEXT NOT NULL,
    text_en TEXT,
    hashtags TEXT DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'draft',
    generation_mode TEXT NOT NULL DEFAULT 'manual',
    idea TEXT,
    is_bilingual INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
    FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE SET NULL
  );
`);

export default db;
