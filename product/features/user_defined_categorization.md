# Turning User Overrides into New Categorization Rules

This document explains how to convert a user’s manual category change (override) into a new rule that will automatically apply to future transactions.

It covers rule precedence, data model, matching logic, persistence, and code examples.

---

## 1) Design Goals

- **User-first precedence**: A user-created rule must always win.
- **Low-latency & explainable**: Rules are simple, readable, and return a short “why” string.
- **Incremental**: Start with exact/contains/regex rules; expand to amount/frequency when needed.
- **Safe**: Avoid retroactively breaking prior classifications; store versions and timestamps.

---

## 2) Rule Precedence (Top → Bottom)

1. **User Overrides / Custom Rules (persisted)**
2. **Household Dictionary (shared manual rules)**
3. **System Heuristics** (recurrence, account → account transfers, known utilities)
4. **ML Classifier Fallback**
5. **Default** → *Guilt Free*

> If multiple rules match at level 1, pick the **most recent**, or the **most specific** (e.g., exact > contains > regex).

---

## 3) Supported Rule Types

- **merchant_exact**: `merchant_normalized == "STARBUCKS"`
- **merchant_contains**: `"AMZN"` in `description_normalized`
- **merchant_regex**: `/\bTORONTO\s*HYDRO\b/i`
- **account_to_account**: `(from_account_id, to_account_id)` → Short-Term Savings / Investments

Each rule stores:
- **scope**: `"user"` | `"household"`
- **category**: `"fixed_costs" | "short_term_savings" | "guilt_free" | "investments"`
- **match_type**: `"exact" | "contains" | "regex" | "acct_to_acct"`
- **pattern**: String or JSON payload (merchant text, regex, or account pair)
- **priority**: Int (higher wins)
- **enabled**: Bool
- **created_at / updated_at**
- **explain**: Short human-readable reason
- **hit_count** *(optional)*

---

## 4) Persistence (Pick One)

### Option A: SQLite Table

```sql
CREATE TABLE IF NOT EXISTS categorization_rules (
  id INTEGER PRIMARY KEY,
  scope TEXT NOT NULL,                      -- 'user' | 'household'
  category TEXT NOT NULL,                   -- enum of your 4 categories
  match_type TEXT NOT NULL,                 -- 'exact' | 'contains' | 'regex' | 'acct_to_acct'
  pattern TEXT NOT NULL,                    -- e.g., 'STARBUCKS' or JSON for acct pair
  amount_min_cents INTEGER,                 -- nullable
  amount_max_cents INTEGER,                 -- nullable
  priority INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1,
  explain TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rules_priority ON categorization_rules(priority DESC);
CREATE INDEX IF NOT EXISTS idx_rules_match ON categorization_rules(match_type, pattern);
