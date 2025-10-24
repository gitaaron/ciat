#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, '..', 'backend', 'data', 'ciat.sqlite');
const db = new Database(dbPath);

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  threshold: 0.8,
  showSimilar: false,
  showExact: false,
  help: false
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  switch (arg) {
    case '--threshold':
    case '-t':
      options.threshold = parseFloat(args[++i]);
      break;
    case '--similar':
    case '-s':
      options.showSimilar = true;
      break;
    case '--exact':
    case '-e':
      options.showExact = true;
      break;
    case '--help':
    case '-h':
      options.help = true;
      break;
  }
}

if (options.help) {
  console.log(`
Usage: node duplicate-finder.js [options]

Options:
  -t, --threshold <number>     Similarity threshold (0.0-1.0, default: 0.8)
  -s, --similar                Show similar transactions
  -e, --exact                  Show exact duplicates
  -h, --help                   Show this help message

Examples:
  node duplicate-finder.js --exact
  node duplicate-finder.js --similar --threshold 0.9
`);
  process.exit(0);
}

console.log('🔍 Duplicate Transaction Finder\n');

// Find exact duplicates (same hash)
if (options.showExact) {
  console.log('📋 Exact Duplicates (same hash):');
  const exactDuplicates = db.prepare(`
    SELECT 
      hash,
      COUNT(*) as count,
      GROUP_CONCAT(id) as ids,
      GROUP_CONCAT(date) as dates,
      GROUP_CONCAT(name) as names,
      GROUP_CONCAT(amount) as amounts
    FROM transactions
    WHERE hash IS NOT NULL
    GROUP BY hash
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `).all();

  if (exactDuplicates.length === 0) {
    console.log('   No exact duplicates found.');
  } else {
    exactDuplicates.forEach((dup, index) => {
      console.log(`\n${index + 1}. Hash: ${dup.hash}`);
      console.log(`   Count: ${dup.count} transactions`);
      console.log(`   IDs: ${dup.ids}`);
      console.log(`   Dates: ${dup.dates}`);
      console.log(`   Names: ${dup.names}`);
      console.log(`   Amounts: ${dup.amounts}`);
    });
  }
}

// Find similar transactions
if (options.showSimilar) {
  console.log('\n🔍 Similar Transactions:');
  
  // Get all transactions
  const transactions = db.prepare(`
    SELECT 
      t.id,
      t.date,
      t.name,
      t.description,
      t.amount,
      t.inflow,
      t.category,
      a.name as account_name
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    ORDER BY t.date DESC
  `).all();

  const similarGroups = [];
  const processed = new Set();

  for (let i = 0; i < transactions.length; i++) {
    if (processed.has(transactions[i].id)) continue;
    
    const current = transactions[i];
    const similar = [current];
    processed.add(current.id);

    for (let j = i + 1; j < transactions.length; j++) {
      if (processed.has(transactions[j].id)) continue;
      
      const other = transactions[j];
      const similarity = calculateSimilarity(current, other);
      
      if (similarity >= options.threshold) {
        similar.push(other);
        processed.add(other.id);
      }
    }

    if (similar.length > 1) {
      similarGroups.push(similar);
    }
  }

  if (similarGroups.length === 0) {
    console.log(`   No similar transactions found (threshold: ${options.threshold}).`);
  } else {
    similarGroups.forEach((group, index) => {
      console.log(`\n${index + 1}. Similar Group (${group.length} transactions):`);
      group.forEach((tx, txIndex) => {
        const amount = parseFloat(tx.amount);
        const amountStr = amount >= 0 ? `+$${amount.toFixed(2)}` : `-$${Math.abs(amount).toFixed(2)}`;
        const type = tx.inflow ? '💰 Income' : '💸 Expense';
        console.log(`   ${txIndex + 1}. ${tx.date} | ${amountStr} | ${type} ${tx.name}`);
        console.log(`      ID: ${tx.id}, Account: ${tx.account_name}, Category: ${tx.category || 'Uncategorized'}`);
      });
    });
  }
}

// Calculate similarity between two transactions
function calculateSimilarity(tx1, tx2) {
  let score = 0;
  let factors = 0;

  // Name similarity (most important)
  const nameSimilarity = stringSimilarity(tx1.name, tx2.name);
  score += nameSimilarity * 0.4;
  factors += 0.4;

  // Amount similarity
  const amount1 = Math.abs(parseFloat(tx1.amount));
  const amount2 = Math.abs(parseFloat(tx2.amount));
  const amountSimilarity = amount1 === 0 && amount2 === 0 ? 1 : 
    Math.min(amount1, amount2) / Math.max(amount1, amount2);
  score += amountSimilarity * 0.3;
  factors += 0.3;

  // Date proximity (within 7 days = high similarity)
  const date1 = new Date(tx1.date);
  const date2 = new Date(tx2.date);
  const daysDiff = Math.abs(date1 - date2) / (1000 * 60 * 60 * 24);
  const dateSimilarity = daysDiff <= 7 ? 1 - (daysDiff / 7) : 0;
  score += dateSimilarity * 0.2;
  factors += 0.2;

  // Account similarity
  const accountSimilarity = tx1.account_name === tx2.account_name ? 1 : 0;
  score += accountSimilarity * 0.1;
  factors += 0.1;

  return factors > 0 ? score / factors : 0;
}

// Calculate string similarity using Levenshtein distance
function stringSimilarity(str1, str2) {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Show summary
const totalTransactions = db.prepare('SELECT COUNT(*) as count FROM transactions').get();
console.log(`\n📊 Summary:`);
console.log(`   Total transactions: ${totalTransactions.count.toLocaleString()}`);

if (options.showExact) {
  const exactCount = db.prepare(`
    SELECT COUNT(*) as count FROM (
      SELECT hash FROM transactions 
      WHERE hash IS NOT NULL 
      GROUP BY hash 
      HAVING COUNT(*) > 1
    )
  `).get();
  console.log(`   Exact duplicates: ${exactCount.count.toLocaleString()}`);
}

db.close();
