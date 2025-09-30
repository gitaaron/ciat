
import { reapplyCategories } from '../src/categorizer/index.js';

async function main() {
  try {
    const result = await reapplyCategories();
    console.log(`Reapplied categories to ${result.updated} out of ${result.total} transactions.`);
  } catch (error) {
    console.error('Error reapplying categories:', error);
    process.exit(1);
  }
}

main();
