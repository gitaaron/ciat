
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
  field_mapping TEXT,              -- JSON object mapping CSV columns to fields: {date, name, inflow, outflow}
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
  labels TEXT,                     -- JSON array of labels for grouping transactions
  note TEXT,
  hash TEXT UNIQUE,                -- dedupe across imports
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  manual_override INTEGER DEFAULT 0,  -- 1 if user set category manually
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,             -- UUID string
  match_type TEXT NOT NULL,        -- 'exact', 'contains', 'regex'
  pattern TEXT NOT NULL,           -- Pattern to match
  category TEXT NOT NULL,          -- Category to assign
  priority INTEGER DEFAULT 1000,   -- Execution order (higher = first)
  support INTEGER DEFAULT 0,       -- Number of matched transactions
  exceptions TEXT,                 -- JSON array of exclusion tokens
  enabled INTEGER DEFAULT 1,       -- 1 if enabled, 0 if disabled
  explain TEXT,                    -- User explanation of rule
  labels TEXT,                     -- JSON array of labels for grouping rules
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_tx_cat ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_tx_labels ON transactions(labels);
CREATE INDEX IF NOT EXISTS idx_rules_category ON rules(category);
CREATE INDEX IF NOT EXISTS idx_rules_match_type ON rules(match_type);
CREATE INDEX IF NOT EXISTS idx_rules_enabled ON rules(enabled);
CREATE INDEX IF NOT EXISTS idx_rules_priority ON rules(priority);
`);

// Migration: Add labels column if it doesn't exist
try {
  db.exec('ALTER TABLE transactions ADD COLUMN labels TEXT;');
  console.log('Added labels column to transactions table');
} catch (e) {
  // Column already exists, ignore error
  console.log('Labels column already exists in transactions table');
}

// Migration: Add field_mapping column if it doesn't exist
try {
  db.exec('ALTER TABLE accounts ADD COLUMN field_mapping TEXT;');
  console.log('Added field_mapping column to accounts table');
} catch (e) {
  // Column already exists, ignore error
  console.log('Field_mapping column already exists in accounts table');
}

// Migration: Add type column if it doesn't exist
try {
  db.exec('ALTER TABLE accounts ADD COLUMN type TEXT CHECK(type IN (\'credit_card\', \'bank_account\'));');
  console.log('Added type column to accounts table');
} catch (e) {
  // Column already exists, ignore error
  console.log('Type column already exists in accounts table');
}
