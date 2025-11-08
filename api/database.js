import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'menus.db'));

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS menu_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant TEXT NOT NULL,
    date DATE NOT NULL,
    menu_data TEXT NOT NULL,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant, date)
  );
  CREATE INDEX IF NOT EXISTS idx_menu_cache_date ON menu_cache(date);
`);

export function saveMenu(restaurant, date, menuData) {
  const result = db.prepare(`
    INSERT INTO menu_cache (restaurant, date, menu_data, fetched_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(restaurant, date) 
    DO UPDATE SET menu_data = excluded.menu_data, fetched_at = CURRENT_TIMESTAMP
  `).run(restaurant, date, JSON.stringify(menuData));
}

export function getMenu(restaurant, date) {
  const row = db.prepare('SELECT * FROM menu_cache WHERE restaurant = ? AND date = ?').get(restaurant, date);
  if (!row) return null;
  
  const CACHE_MAX_AGE_HOURS = 1;
  const ageHours = (Date.now() - new Date(row.fetched_at)) / (1000 * 60 * 60);
  return {
    data: JSON.parse(row.menu_data),
    isStale: ageHours > CACHE_MAX_AGE_HOURS
  };
}

export function getAllMenus() {
  return db.prepare('SELECT restaurant, date, menu_data, fetched_at FROM menu_cache ORDER BY date DESC LIMIT 100')
    .all()
    .map(row => ({ ...row, menu_data: JSON.parse(row.menu_data) }));
}

export function getStats() {
  const total = db.prepare('SELECT COUNT(*) as count FROM menu_cache').get();
  const byRestaurant = db.prepare('SELECT restaurant, COUNT(*) as count FROM menu_cache GROUP BY restaurant').all();
  const dateRange = db.prepare('SELECT MIN(date) as first, MAX(date) as last FROM menu_cache').get();
  return { total: total.count, byRestaurant, dateRange };
}

export default db;
