
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'ciat.sqlite'));

// schema
db.exec(`
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT,                -- id from bank file if present
  account_id INTEGER NOT NULL,
  date TEXT NOT NULL,              -- ISO date
  name TEXT NOT NULL,
  description TEXT,
  amount REAL NOT NULL,            -- positive for outflow, negative for inflow OR vice versa; choose convention below
  inflow INTEGER NOT NULL,         -- 1 income, 0 expense
  category TEXT,                   -- current category
  category_source TEXT,            -- 'rule' | 'pattern' | 'ml' | 'manual' | 'none'
  category_explain TEXT,
  note TEXT,
  hash TEXT UNIQUE,                -- dedupe across imports
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  manual_override INTEGER DEFAULT 0,  -- 1 if user set category manually
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_tx_cat ON transactions(category);
`);
