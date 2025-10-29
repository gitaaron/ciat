# Architecture

This document summarizes the current system design.

## Backend
- **Node + Express** application.
- API runs separately via `npm run api`.


## Data
- **SQLite** is the primary data store.
- The application-generated SQLite file should be **ignored in `.gitignore`**, but **versioned separately** so prior states can be restored.
- From `npm run dev`, **watch** for database changes and create **versioned snapshots**.
- **Rules are stored in the database** (not in flat files like `rules.json`).
- Provide a simple **CLI** to:
  - List prior DB versions
  - Revert to a chosen version
  - Clean up DB versions

### Database Schema
The SQLite database includes the following tables:
- `accounts` - User account information
- `transactions` - Financial transaction records
- `rules` - Categorization rules (replaces flat file storage)


## Frontend
- **Vite + Vue.js** application.
- **D3.js** used for data visualizations (e.g., charts).


> See also:
> - Feature → [Persistence](../features/PERSISTENCE.md) for storage/versioning details.  
> - Feature → [Reports & Charts](../features/REPORTS_AND_CHARTS.md) for visualization needs.
