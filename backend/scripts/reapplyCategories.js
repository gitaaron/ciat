
import { db } from '../src/db.js';
import { guessCategory } from '../src/categorizer/index.js';

const rows = db.prepare(`SELECT id, name, description FROM transactions WHERE manual_override=0`).all();
let updated = 0;
for (const r of rows) {
  const guess = guessCategory(r);
  if (guess && guess.category) {
    db.prepare(`UPDATE transactions SET category=?, category_source=?, category_explain=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(guess.category, guess.source, guess.explain, r.id);
    updated++;
  }
}
console.log(`Reapplied categories to ${updated} transactions.`);
