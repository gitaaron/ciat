# Can I Afford That? (CIAT)

CIAT is a family budgeting app inspired by Remit Sethi's 'IWT' system.

Based on the following specs:

- Import flow for CSV transactions, 
- Categorization engine (rules + patterns), user overrides with feedback loop.
- Transfer-pair detection and dedupe.
- CLI to reapply categories to transactions
- Node/Express API (`npm run api`) with SQLite persistence.
- Vite + Vue 3 frontend with D3 for charts.

See `product/REQUIREMENTS.md` for a full description.

## Quick Start

```bash
# in project root
npm install
npm run dev    # runs API and Web together
# API at http://localhost:3108/api
# Web at http://localhost:5175
```

Or run separately:
```bash
npm run api    # backend only
npm run web    # frontend only
```

## Importing Transactions
From the UI, go to **Import** and choose an Account (create if needed), upload a CSV. The app will:
1. Normalize merchants/descriptions.
2. Dedupe previously imported items.
3. Detect likely transfers between your accounts and ignore them.
4. Guess a category via: **rules → patterns → (stub ML)**.
5. Show a review list so you can fix categories/notes before saving.

## Reapplying Categories
```bash
npm run reapply
```
This re-applies guessing to transactions that **aren’t** manually overridden.

## Data
All data persists to `backend/data/ciat.sqlite` (gitignored). You can version the DB via any external mechanism you prefer.

## Notes
- Rules live in `backend/src/categorizer/rules.json` and `patterns.json`. User overrides create new rules (highest priority and timestamped), keeping an **explain** field for transparency.
- The ML step is stubbed with a placeholder that you can swap out for a local model or API later.


## Contributing

- Keep docs **concise, consistent, and friendly**.
- Prefer **small, focused feature files** over giant specs.
- When adding a new feature, **update the corresponding feature doc in product/features** and link related areas.

