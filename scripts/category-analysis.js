#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Connect to database
const dbPath = path.join(__dirname, '..', 'backend', 'data', 'ciat.sqlite');
const db = new Database(dbPath);

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  category: null,
  showRules: false,
  showUncategorized: false,
  showPatterns: false,
  help: false
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  switch (arg) {
    case '--category':
    case '-c':
      options.category = args[++i];
      break;
    case '--rules':
    case '-r':
      options.showRules = true;
      break;
    case '--uncategorized':
    case '-u':
      options.showUncategorized = true;
      break;
    case '--patterns':
    case '-p':
      options.showPatterns = true;
      break;
    case '--help':
    case '-h':
      options.help = true;
      break;
  }
}

if (options.help) {
  console.log(`
Usage: node category-analysis.js [options]

Options:
  -c, --category <category>   Analyze specific category
  -r, --rules                 Show categorization rules
  -u, --uncategorized        Show uncategorized transactions
  -p, --patterns              Show common patterns for categorization
  -h, --help                  Show this help message

Examples:
  node category-analysis.js
  node category-analysis.js --category "Food"
  node category-analysis.js --uncategorized
  node category-analysis.js --patterns
`);
  process.exit(0);
}

console.log('🏷️  Category Analysis\n');

// Load rules if available
let rules = [];
try {
  const rulesPath = path.join(__dirname, '..', 'backend', 'src', 'categorizer', 'rules.json');
  if (fs.existsSync(rulesPath)) {
    rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
  }
} catch (e) {
  console.log('⚠️  Could not load rules file');
}

// Category overview
console.log('📊 Category Overview:');
const categoryOverview = db.prepare(`
  SELECT 
    COALESCE(category, 'Uncategorized') as category,
    COUNT(*) as count,
    SUM(amount) as total_amount,
    AVG(amount) as avg_amount,
    COUNT(CASE WHEN inflow = 1 THEN 1 END) as income_count,
    COUNT(CASE WHEN inflow = 0 THEN 1 END) as expense_count,
    SUM(CASE WHEN inflow = 1 THEN amount ELSE 0 END) as total_income,
    SUM(CASE WHEN inflow = 0 THEN amount ELSE 0 END) as total_expenses,
    category_source
  FROM transactions
  GROUP BY category, category_source
  ORDER BY count DESC
`).all();

categoryOverview.forEach((cat, index) => {
  console.log(`\n${index + 1}. ${cat.category} (${cat.category_source || 'unknown'})`);
  console.log(`   Transactions: ${cat.count.toLocaleString()}`);
  console.log(`   Total Amount: $${cat.total_amount?.toFixed(2) || '0.00'}`);
  console.log(`   Average: $${cat.avg_amount?.toFixed(2) || '0.00'}`);
  console.log(`   Income: ${cat.income_count} ($${cat.total_income?.toFixed(2) || '0.00'})`);
  console.log(`   Expenses: ${cat.expense_count} ($${cat.total_expenses?.toFixed(2) || '0.00'})`);
});

// Show rules if requested
if (options.showRules && rules.length > 0) {
  console.log('\n📋 Categorization Rules:');
  rules.forEach((rule, index) => {
    console.log(`\n${index + 1}. ${rule.category}`);
    console.log(`   Type: ${rule.match_type}`);
    console.log(`   Pattern: ${rule.pattern}`);
    if (rule.explain) console.log(`   Explanation: ${rule.explain}`);
    console.log(`   Created: ${rule.created_at || 'Unknown'}`);
  });
}

// Show patterns if requested
if (options.showPatterns) {
  console.log('\n🔍 Common Patterns for Uncategorized Transactions:');
  
  const uncategorized = db.prepare(`
    SELECT name, description, COUNT(*) as count
    FROM transactions
    WHERE category IS NULL OR category = '' OR category = 'uncategorized'
    GROUP BY name, description
    ORDER BY count DESC
    LIMIT 20
  `).all();

  uncategorized.forEach((pattern, index) => {
    console.log(`\n${index + 1}. ${pattern.name}`);
    if (pattern.description) console.log(`   Description: ${pattern.description}`);
    console.log(`   Occurrences: ${pattern.count}`);
  });
}

// Show uncategorized transactions if requested
if (options.showUncategorized) {
  console.log('\n❓ Uncategorized Transactions:');
  const uncategorized = db.prepare(`
    SELECT 
      t.date,
      t.name,
      t.description,
      t.amount,
      t.inflow,
      a.name as account_name
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    WHERE t.category IS NULL OR t.category = ''
    ORDER BY t.date DESC
    LIMIT 50
  `).all();

  uncategorized.forEach((tx, index) => {
    const amount = parseFloat(tx.amount);
    const amountStr = amount >= 0 ? `+$${amount.toFixed(2)}` : `-$${Math.abs(amount).toFixed(2)}`;
    const type = tx.inflow ? '💰 Income' : '💸 Expense';
    console.log(`\n${index + 1}. ${tx.date} | ${amountStr} | ${type}`);
    console.log(`   ${tx.name}`);
    if (tx.description) console.log(`   📝 ${tx.description}`);
    console.log(`   🏦 ${tx.account_name}`);
  });
}

// Analyze specific category if requested
if (options.category) {
  console.log(`\n🔍 Analysis for "${options.category}":`);
  
  const categoryTransactions = db.prepare(`
    SELECT 
      t.date,
      t.name,
      t.description,
      t.amount,
      t.inflow,
      t.category_source,
      a.name as account_name
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    WHERE t.category = ?
    ORDER BY t.date DESC
  `).all(options.category);

  if (categoryTransactions.length === 0) {
    console.log(`   No transactions found for category "${options.category}"`);
  } else {
    console.log(`   Found ${categoryTransactions.length} transactions`);
    
    // Show recent transactions
    console.log('\n   Recent Transactions:');
    categoryTransactions.slice(0, 10).forEach((tx, index) => {
      const amount = parseFloat(tx.amount);
      const amountStr = amount >= 0 ? `+$${amount.toFixed(2)}` : `-$${Math.abs(amount).toFixed(2)}`;
      const type = tx.inflow ? '💰' : '💸';
      console.log(`   ${index + 1}. ${tx.date} | ${amountStr} | ${type} ${tx.name} (${tx.category_source})`);
    });

    // Show common merchants
    console.log('\n   Common Merchants:');
    const merchants = db.prepare(`
      SELECT name, COUNT(*) as count, AVG(amount) as avg_amount
      FROM transactions
      WHERE category = ?
      GROUP BY name
      ORDER BY count DESC
      LIMIT 10
    `).all(options.category);

    merchants.forEach((merchant, index) => {
      console.log(`   ${index + 1}. ${merchant.name} (${merchant.count} times, avg: $${merchant.avg_amount?.toFixed(2) || '0.00'})`);
    });
  }
}

// Category source analysis
console.log('\n📊 Category Source Analysis:');
const sourceAnalysis = db.prepare(`
  SELECT 
    COALESCE(category_source, 'unknown') as source,
    COUNT(*) as count,
    COUNT(DISTINCT category) as unique_categories
  FROM transactions
  WHERE category IS NOT NULL AND category != ''
  GROUP BY category_source
  ORDER BY count DESC
`).all();

sourceAnalysis.forEach(source => {
  console.log(`   ${source.source}: ${source.count.toLocaleString()} transactions across ${source.unique_categories} categories`);
});

// Manual overrides analysis
console.log('\n✋ Manual Override Analysis:');
const manualOverrides = db.prepare(`
  SELECT 
    category,
    COUNT(*) as count
  FROM transactions
  WHERE manual_override = 1
  GROUP BY category
  ORDER BY count DESC
`).all();

if (manualOverrides.length > 0) {
  manualOverrides.forEach(override => {
    console.log(`   ${override.category}: ${override.count.toLocaleString()} manual overrides`);
  });
} else {
  console.log('   No manual overrides found');
}

db.close();
