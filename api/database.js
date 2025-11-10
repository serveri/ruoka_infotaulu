import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// --- Setup ------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'menus.db'));
db.pragma('journal_mode = WAL');

// Restaurants list (single source of truth)
export const RESTAURANTS = ['tietoteknia','snelmannia','canthia','antell_round'];

db.exec(`
  ${RESTAURANTS.map(r => `
    CREATE TABLE IF NOT EXISTS ${r}_menus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE NOT NULL,
      weekday TEXT,
      dish_name TEXT NOT NULL,
      student_price TEXT,
      components TEXT,
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date, dish_name, components)
    );
    CREATE INDEX IF NOT EXISTS idx_${r}_date ON ${r}_menus(date);
  `).join('')}
`);

// --- Helpers ----------------------------------------------------------------
function getWeekdayName(dateString) {
  if (!dateString) return null;
  const days = ['Sunnuntai','Maanantai','Tiistai','Keskiviikko','Torstai','Perjantai','Lauantai'];
  const dateObj = new Date(dateString);
  if (Number.isNaN(dateObj.getTime())) return null;
  return days[dateObj.getDay()];
}

// Extract student price as text only (no numeric column) matching known patterns
function extractStudentPrice(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  
  // Format: "Op 2,95 € / Hk 6,12€ / Vieras 6,25€" - student keyword comes FIRST
  // Direct keyword patterns (prioritize these before slash logic)
  const directMatch = s.match(/(?:opiskelija|opisk\.?|op\.?)\s*(\d+[,.]\d+)/i);
  if (directMatch) return directMatch[1].replace('.', ',');
  
  // Format: "12,90€ / opisk. 2,95 €" - student keyword after slash
  if (s.includes('/')) {
    const afterSlash = s.split('/').pop().trim();
    const m = afterSlash.match(/(?:opiskelija|opisk\.?|op\.?)\s*(\d+[,.]\d+)/i);
    if (m) return m[1].replace('.', ',');
    // If no keyword after slash, take first number after slash (fallback)
    const num = afterSlash.match(/(\d+[,.]\d+)/);
    if (num) return num[1].replace('.', ',');
  }
  
  // Fallback: take smallest number (student prices are usually cheapest)
  const all = s.match(/\d+[,.]\d+/g);
  if (all && all.length > 1) {
    const nums = all.map(x => parseFloat(x.replace(',','.')));
    const min = Math.min(...nums);
    return String(min.toFixed(2)).replace('.', ',');
  }
  
  // Single number: use it
  if (all && all.length === 1) return all[0].replace('.', ',');
  
  return null;
}

// --- Saving -----------------------------------------------------------------
function internalSaveAllDays(restaurant, menuData, onlyTodayDate = null) {
  if (!RESTAURANTS.includes(restaurant) || !menuData?.MenusForDays?.length) return;
  const table = `${restaurant}_menus`;
  const insert = db.prepare(`INSERT OR IGNORE INTO ${table} (date, weekday, dish_name, student_price, components) VALUES (?, ?, ?, ?, ?)`);
  const daysToProcess = onlyTodayDate
    ? menuData.MenusForDays.filter(d => d.Date?.startsWith(onlyTodayDate))
    : menuData.MenusForDays.slice(0,1);
  
  const tx = db.transaction(days => {
    days.forEach(day => {
      const date = day.Date?.slice(0,10);
      if (!date || !day.SetMenus?.length) return;
      const weekday = getWeekdayName(date);
      day.SetMenus.forEach(item => {
        const name = (item.Name || item.name || '').trim();
        if (!name) return;
        insert.run(date, weekday, name, extractStudentPrice(item.Price || item.price || ''), item.Components ? JSON.stringify(item.Components) : '[]');
      });
    });
  });
  tx(daysToProcess);
}

// Backwards-compatible export: old signature saveMenu(restaurant, date, menuData)
export function saveMenu(restaurant, maybeDate, maybeMenuData) {
  if (typeof maybeDate === 'string' && maybeMenuData) {
    internalSaveAllDays(restaurant.replace(/-/g,'_'), maybeMenuData, maybeDate);
  } else {
    // treat second param as full menuData, save only today (first day)
    internalSaveAllDays(restaurant.replace(/-/g,'_'), maybeDate);
  }
}

export function saveMenuAllDays(restaurant, menuData) {
  internalSaveAllDays(restaurant.replace(/-/g,'_'), menuData);
}

// --- Querying ----------------------------------------------------------------
export function getMenuItemsByRestaurant(restaurant, date) {
  const table = `${restaurant.replace(/-/g,'_')}_menus`;
  try {
    return db.prepare(`SELECT dish_name, student_price, components, weekday, fetched_at FROM ${table} WHERE date = ? ORDER BY id`)
      .all(date).map(r => ({ ...r, components: r.components ? JSON.parse(r.components) : [] }));
  } catch (e) {
    return [];
  }
}

export function getAllDishes({ minPrice = null, maxPrice = null } = {}) {
  const out = [];
  RESTAURANTS.forEach(r => {
    let sql = `SELECT '${r}' as restaurant, date, weekday, dish_name, student_price, components FROM ${r}_menus`;
    const clauses = [], params = [];
    if (minPrice != null) { clauses.push(`CAST(REPLACE(student_price, ',', '.') AS REAL) >= ?`); params.push(minPrice); }
    if (maxPrice != null) { clauses.push(`CAST(REPLACE(student_price, ',', '.') AS REAL) <= ?`); params.push(maxPrice); }
    if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
    sql += ' ORDER BY date DESC, restaurant';
    db.prepare(sql).all(...params).forEach(row => out.push({ ...row, components: row.components ? JSON.parse(row.components) : [] }));
  });
  return out;
}

// Compatibility wrapper used by existing server code
export function getAllDishesWithPrice(minPrice = null, maxPrice = null) {
  return getAllDishes({ minPrice, maxPrice });
}

export function getAllMenus() {
  return getAllDishes();
}

export function getStats() {
  const byRestaurant = RESTAURANTS.map(r => ({ restaurant: r, count: db.prepare(`SELECT COUNT(*) as c FROM ${r}_menus`).get().c }));
  return { total: byRestaurant.reduce((s,r)=>s+r.count,0), byRestaurant };
}

export default db;
