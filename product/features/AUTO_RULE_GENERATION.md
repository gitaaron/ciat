# Auto Rule Generation

### Overview
Automatically generate initial categorization rules (exact, contains, regex) from a user’s first transaction import. The goal is to bootstrap the rule engine intelligently so users don’t start from a blank slate.

### User Goals
- Automatically suggest rules from transaction patterns.
- Reduce repetitive manual categorization for common merchants.
- Make the system feel smart from the first import.
- Let users review/approve/modify proposed rules before applying them.

---

### Functional Requirements

#### 1. Normalization
Before pattern discovery, normalize each transaction’s merchant string:
- Lowercase; strip punctuation, emojis, extra whitespace.
- Remove variable tokens: dates, reference IDs, store numbers, phone numbers, amounts.
- Remove payment-rail noise (e.g., “VISA DEBIT”, “INTERAC”, “POS”, “PURCHASE –”).
- Canonicalize brand variants (e.g., “mcdonald’s” → “mcdonalds”, “costco wholesale” → “costco”).
Retain both **raw** and **normalized** strings for rule generation and preview.

#### 2. Frequency-Based Rule Discovery
For each normalized token (and 2–3-grams):
- If token frequency ≥ 3 and ≥ 90% of those lines share the same category, propose:
  - `contains(token)` → that category.
- When a “brand + store number” pattern repeats, propose a brand-anchored regex:
  - `regex("^brand(?:\\s*#?\\d{2,5})?$")` → that category.
Make thresholds configurable.

#### 3. Store Number–Aware Regex Rules
Detect repeating structures like:
- `starbucks #0421 toronto on`
- `shoppers drug mart 2041`
- `metro store 043 toronto`
Generate anchored regexes:
- `regex("^starbucks(?:\\s*#?\\d{2,5})?$")` → Guilt Free / Dining
- `regex("^shoppers drug mart\\s+\\d{3,5}")` → Short Term Savings / Pharmacy
Regex rules take precedence over generic “contains”.

#### 4. Metadata-Based Seeding
If available (MCC, merchant_id, bank category hints):
- Seed mappings (e.g., `MCC 5411 → Groceries`, `MCC 5814 → Fast Food`).
- For consistent `(merchant_id, category)` pairs, create `exact(merchant_id)` rules.
- Skip pairs with conflicting categories.

#### 5. Clustering Similar Merchants
Cluster merchant strings via token similarity (e.g., Jaccard ≥ 0.85).
- If ≥ 90% of a cluster is the same category, create a single rule such as:
  - `regex("^metro(?:\\s+(canada|store|inc))?")` → Fixed / Groceries
Prevents duplicated rules for brand variations.

#### 6. Periodicity & Amount Heuristics
Identify recurring, similar-amount charges on fixed monthly dates (±2 days):
- Tag as Utilities, Subscriptions, Insurance, or Loans.
- Start as low-confidence “weak rules” until confirmed by user acceptance.

#### 7. Marketplace Resolvers
Handle masked merchants (Amazon, PayPal, Square, Stripe):
- Extract underlying seller from memo/detail fields when present.
- Otherwise, apply contextual heuristics (e.g., “kindle” → Fixed / Digital Media, “fresh” → Fixed / Groceries).
- Mark such rules as “derived from marketplace” for transparency.

#### 8. Negative & Exception Rules
Reduce collisions (e.g., “subway” restaurant vs. “subway transit”):
- Generate exception/guard rules when two categories are detected for similar tokens.
- Place exception rules at higher priority.

---

### Non-Goals
- Full-text ML categorization at runtime (engine remains rule-first).
- User-specific hardcoding outside the rule framework.

---

### Success Metrics
- % of transactions auto-categorized on first import.
- Acceptance rate of proposed rules.
- Reduction in manual edits after rule adoption.

---

### See Also
- New Category Wizard
- User Overrides
- Transaction Import
