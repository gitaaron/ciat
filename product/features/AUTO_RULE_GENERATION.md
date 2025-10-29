# Auto Rule Generation

### Overview
Automatically generate initial categorization rules (exact, contains, regex) from a user's first transaction import. The goal is to bootstrap the rule engine intelligently so users don't start from a blank slate. Rules are generated using deterministic business logic rather than learning from existing transaction categories.

### User Goals
- Automatically suggest rules from transaction patterns.
- Reduce repetitive manual categorization for common merchants.
- Make the system feel smart from the first import.
- Let users review/approve/modify proposed rules before applying them.

---

### Functional Requirements

#### 1. Normalization
Before pattern discovery, normalize each transaction's merchant string:
- Lowercase; strip punctuation, emojis, extra whitespace.
- Remove variable tokens: dates, reference IDs, store numbers, phone numbers, amounts.
- Remove payment-rail noise (e.g., "VISA DEBIT", "INTERAC", "POS", "PURCHASE –").
- Canonicalize brand variants (e.g., "mcdonald's" → "mcdonalds", "costco wholesale" → "costco").
Retain both **raw** and **normalized** strings for rule generation and preview.

#### 2. Business Logic Category Assignment
Rules are assigned categories using deterministic business logic rather than learning from existing transaction categories:

**Category Assignment Rules:**
1. **Frequency-based rules** (contains/regex patterns) → `fixed_costs` by default
2. **Food/Groceries keywords** → `fixed_costs`
   - Includes: grocery, supermarket, food, fresh, market, produce, meat, dairy, bakery, deli, organic, whole foods, safeway, kroger, publix, wegmans, trader joe, costco, walmart, target, loblaws, metro, sobeys, restaurant, cafe, diner, eatery, kitchen, grill, pizza, burger, sandwich, coffee, starbucks, tim hortons, mcdonalds, subway, kfc, taco bell, wendys, burger king
3. **Automotive keywords** → `fixed_costs`
   - Includes: gas, gasoline, fuel, petro, esso, shell, chevron, parking, impark, park, garage, auto, car, vehicle, maintenance, repair, service, oil change, tire, brake, insurance, geico, state farm, progressive, allstate, dmv, registration, license, inspection
4. **High amount transactions** (≥$500) → `short_term_savings`
5. **Default fallback** → `guilt_free`

#### 3. Frequency-Based Rule Discovery
For each normalized token (and 2–3-grams):
- If token frequency ≥ 2, propose a rule using business logic category assignment
- When a "brand + store number" pattern repeats, propose a brand-anchored regex:
  - `regex("^brand(?:\\s*#?\\d{2,5})?$")` → assigned category based on business logic
- Make frequency thresholds configurable

#### 4. Store Number–Aware Regex Rules
Detect repeating structures like:
- `starbucks #0421 toronto on`
- `shoppers drug mart 2041`
- `metro store 043 toronto`
Generate anchored regexes with business logic category assignment:
- `regex("^starbucks(?:\\s*#?\\d{2,5})?$")` → `fixed_costs` (food-related)
- `regex("^shoppers drug mart\\s+\\d{3,5}")` → `fixed_costs` (pharmacy/grocery)
Regex rules take precedence over generic "contains".

#### 5. Metadata-Based Seeding
If available (MCC, merchant_id, bank category hints):
- Use predefined MCC mappings when available (e.g., `MCC 5411 → fixed_costs` for groceries)
- For merchant IDs, apply business logic based on transaction amounts
- High amount merchant IDs (≥$500) → `short_term_savings`
- Low amount merchant IDs → `guilt_free`

#### 6. Recurring Transaction Detection
Identify recurring, similar-amount charges on fixed monthly dates (±10 days):
- Apply business logic category assignment based on merchant name patterns
- Recurring charges are typically utilities, subscriptions, or services
- Use merchant name keywords to determine appropriate category

#### 7. Marketplace Resolvers
Handle masked merchants (Amazon, PayPal, Square, Stripe):
- Extract underlying seller from memo/detail fields when present
- Apply contextual heuristics (e.g., "kindle" → `fixed_costs`, "fresh" → `fixed_costs`)
- Mark such rules as "derived from marketplace" for transparency

#### 8. Negative & Exception Rules
Reduce collisions (e.g., "subway" restaurant vs. "subway transit"):
- Generate exception/guard rules when patterns could conflict
- Place exception rules at higher priority
- Use business logic to resolve conflicts

#### 9. Configuration
- `MIN_FREQUENCY`: 2 (minimum occurrences to consider a pattern)
- `SHORT_TERM_AMOUNT_THRESHOLD`: $500 (amount threshold for short_term_savings)
- No maximum limit on rules generated per import

#### 10. Priority Calculation
Rules are prioritized based on:
- **Specificity**: exact > regex > contains > MCC
- **Pattern Length**: Longer patterns get higher priority
- **Support**: More frequent patterns get higher priority
- **Source**: MCC and merchant ID rules get source bonuses

#### 11. Rule Explanations
All auto-generated rules have simplified explanations set to "auto" for consistency.

#### 12. Same logic as pre-existing rules
The matching algorithm that checks to see if a transaction matches an auto generated rule should be the exact same as the matching algorithm used to check if a pre-existing rule matches a transaction.

#### 13. Database Persistence
Auto-generated rules must be persisted to the SQLite database:
- Rules are stored in the `rules` table with the same schema as user-created rules
- Auto-generated rules are marked with appropriate metadata (e.g., `explain: "auto"`)
- Rules are immediately available for transaction categorization after generation
- Database transactions ensure atomic rule creation and updates

---

### Non-Goals
- Full-text ML categorization at runtime (engine remains rule-first).
- User-specific hardcoding outside the rule framework.

---

### Success Metrics
- % of transactions auto-categorized on first import.
- Acceptance rate of proposed rules.
- Reduction in manual edits after rule adoption.

### UX

- When showing each proposed auto generated rules, it should be possible to:
    - edit the rule
    - remove it from the list of proposed new rules
    - expand to see all transactions that would apply to the rule

---

### See Also
- New Category Wizard
- User Overrides
- Transaction Import
