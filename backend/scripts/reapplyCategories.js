
import { reapplyCategories } from '../src/categorizer/index.js';

async function main() {
  try {
    const result = await reapplyCategories();
    console.log(`Reapplied rules to ${result.updated || 0} transactions` +
      (result.changed ? ` (${result.changed} category changes)` : '') +
      ` out of ${result.total || 0} total.`);
  } catch (error) {
    console.error('Error reapplying categories:', error);
    process.exit(1);
  }
}

main();
