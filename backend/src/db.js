
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

CREATE TABLE IF NOT EXISTS bucket_list_items (
  id TEXT PRIMARY KEY,             -- UUID string
  name TEXT NOT NULL,
  description TEXT,
  estimated_cost REAL,
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

// Migration: Create bucket_list_items table if it doesn't exist (for existing databases)
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bucket_list_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      estimated_cost REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Bucket list items table ready');
} catch (e) {
  // Table already exists, ignore error
  console.log('Bucket list items table already exists');
}

// Migration: Add new rule fields for filter-based rule creation
try {
  db.exec('ALTER TABLE rules ADD COLUMN account_id INTEGER;');
  console.log('Added account_id column to rules table');
} catch (e) {
  console.log('account_id column already exists in rules table');
}

try {
  db.exec('ALTER TABLE rules ADD COLUMN start_date TEXT;');
  console.log('Added start_date column to rules table');
} catch (e) {
  console.log('start_date column already exists in rules table');
}

try {
  db.exec('ALTER TABLE rules ADD COLUMN end_date TEXT;');
  console.log('Added end_date column to rules table');
} catch (e) {
  console.log('end_date column already exists in rules table');
}

try {
  db.exec('ALTER TABLE rules ADD COLUMN min_amount REAL;');
  console.log('Added min_amount column to rules table');
} catch (e) {
  console.log('min_amount column already exists in rules table');
}

try {
  db.exec('ALTER TABLE rules ADD COLUMN max_amount REAL;');
  console.log('Added max_amount column to rules table');
} catch (e) {
  console.log('max_amount column already exists in rules table');
}

try {
  db.exec('ALTER TABLE rules ADD COLUMN inflow_only INTEGER DEFAULT 0;');
  console.log('Added inflow_only column to rules table');
} catch (e) {
  console.log('inflow_only column already exists in rules table');
}

try {
  db.exec('ALTER TABLE rules ADD COLUMN outflow_only INTEGER DEFAULT 0;');
  console.log('Added outflow_only column to rules table');
} catch (e) {
  console.log('outflow_only column already exists in rules table');
}

// Migration: Remove manual_override column (replaced by flat file)
try {
  db.exec('ALTER TABLE transactions DROP COLUMN manual_override;');
  console.log('Removed manual_override column from transactions table');
} catch (e) {
  // Column doesn't exist or can't be dropped (SQLite limitation), ignore error
  console.log('manual_override column removal attempted (may require manual migration)');
}
