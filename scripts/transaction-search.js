#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, '..', 'backend', 'data', 'ciat.sqlite');
const db = new Database(dbPath);

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  query: null,
  amountMin: null,
  amountMax: null,
  dateStart: null,
  dateEnd: null,
  category: null,
  account: null,
  inflow: null,
  labels: null,
  limit: 50,
  exact: false,
  caseSensitive: false,
  help: false
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  switch (arg) {
    case '--query':
    case '-q':
      options.query = args[++i];
      break;
    case '--amount-min':
      options.amountMin = parseFloat(args[++i]);
      break;
    case '--amount-max':
      options.amountMax = parseFloat(args[++i]);
      break;
    case '--date-start':
    case '--start':
      options.dateStart = args[++i];
      break;
    case '--date-end':
    case '--end':
      options.dateEnd = args[++i];
      break;
    case '--category':
    case '-c':
      options.category = args[++i];
      break;
    case '--account':
    case '-a':
      options.account = args[++i];
      break;
    case '--income':
    case '-i':
      options.inflow = true;
      break;
    case '--expenses':
    case '-e':
      options.inflow = false;
      break;
    case '--labels':
    case '-l':
      options.labels = args[++i];
      break;
    case '--limit':
      options.limit = parseInt(args[++i]) || 50;
      break;
    case '--exact':
      options.exact = true;
      break;
    case '--case-sensitive':
      options.caseSensitive = true;
      break;
    case '--help':
    case '-h':
      options.help = true;
      break;
  }
}

if (options.help) {
  console.log(`
Usage: node transaction-search.js [options]

Search Options:
  -q, --query <term>          Search in name, description, or note
  --amount-min <amount>        Minimum transaction amount
  --amount-max <amount>        Maximum transaction amount
  --start, --date-start <date> Start date (YYYY-MM-DD)
  --end, --date-end <date>     End date (YYYY-MM-DD)
  -c, --category <category>    Filter by category
  -a, --account <account>      Filter by account name
  -i, --income                 Show only income transactions
  -e, --expenses               Show only expense transactions
  -l, --labels <label>         Filter by label
  --limit <number>             Maximum results (default: 50)
  --exact                      Exact match for query
  --case-sensitive             Case sensitive search

Examples:
  node transaction-search.js --query "starbucks"
  node transaction-search.js --amount-min 100 --amount-max 500
  node transaction-search.js --category "Food" --income
  node transaction-search.js --start 2024-01-01 --end 2024-12-31
  node transaction-search.js --query "amazon" --exact
  node transaction-search.js --labels "business"
`);
  process.exit(0);
}

// Build search query
let sql = `
  SELECT 
    t.id,
    t.date,
    t.name,
    t.description,
    t.amount,
    t.inflow,
    t.category,
    t.category_source,
    t.labels,
    t.note,
    t.manual_override,
    a.name as account_name
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  WHERE 1=1
`;

const params = {};

// Text search
if (options.query) {
  if (options.exact) {
    if (options.caseSensitive) {
      sql += ' AND (t.name = @query OR t.description = @query OR t.note = @query)';
    } else {
      sql += ' AND (LOWER(t.name) = LOWER(@query) OR LOWER(t.description) = LOWER(@query) OR LOWER(t.note) = LOWER(@query))';
    }
    params.query = options.query;
  } else {
    if (options.caseSensitive) {
      sql += ' AND (t.name LIKE @query OR t.description LIKE @query OR t.note LIKE @query)';
    } else {
      sql += ' AND (LOWER(t.name) LIKE LOWER(@query) OR LOWER(t.description) LIKE LOWER(@query) OR LOWER(t.note) LIKE LOWER(@query))';
    }
    params.query = `%${options.query}%`;
  }
}

// Amount filters
if (options.amountMin !== null) {
  sql += ' AND t.amount >= @amountMin';
  params.amountMin = options.amountMin;
}

if (options.amountMax !== null) {
  sql += ' AND t.amount <= @amountMax';
  params.amountMax = options.amountMax;
}

// Date filters
if (options.dateStart) {
  sql += ' AND date(t.date) >= date(@dateStart)';
  params.dateStart = options.dateStart;
}

if (options.dateEnd) {
  sql += ' AND date(t.date) <= date(@dateEnd)';
  params.dateEnd = options.dateEnd;
}

// Category filter
if (options.category) {
  sql += ' AND t.category = @category';
  params.category = options.category;
}

// Account filter
if (options.account) {
  sql += ' AND a.name LIKE @account';
  params.account = `%${options.account}%`;
}

// Income/expense filter
if (options.inflow !== null) {
  sql += ' AND t.inflow = @inflow';
  params.inflow = options.inflow ? 1 : 0;
}

// Labels filter (case-insensitive) - use SQLite JSON functions
if (options.labels) {
  const labelsLower = options.labels.toLowerCase();
  sql += ` AND t.labels IS NOT NULL AND EXISTS (
    SELECT 1 FROM json_each(t.labels) 
    WHERE LOWER(json_each.value) = @labels
  )`;
  params.labels = labelsLower;
}

// Add sorting and limit
sql += ' ORDER BY t.date DESC, t.id DESC';
sql += ` LIMIT ${options.limit}`;

// Execute search
const results = db.prepare(sql).all(params);

// Display results
console.log(`\n🔍 Search Results: ${results.length} transactions found\n`);

if (results.length === 0) {
  console.log('No transactions found matching your search criteria.');
  console.log('\nTry adjusting your search parameters or use --help for more options.');
  process.exit(0);
}

// Display transactions
results.forEach((tx, index) => {
  const amount = parseFloat(tx.amount);
  const amountStr = amount >= 0 ? `+$${amount.toFixed(2)}` : `-$${Math.abs(amount).toFixed(2)}`;
  const type = tx.inflow ? '💰 Income' : '💸 Expense';
  const category = tx.category || '❓ Uncategorized';
  const labels = tx.labels ? JSON.parse(tx.labels).join(', ') : '';
  const manualFlag = tx.manual_override ? ' ✋' : '';
  
  console.log(`${index + 1}. ${tx.date} | ${amountStr} | ${type}`);
  console.log(`   ${tx.name}${manualFlag}`);
  if (tx.description) console.log(`   📝 ${tx.description}`);
  console.log(`   🏷️  ${category} (${tx.category_source || 'unknown'})`);
  if (labels) console.log(`   🏷️  Labels: ${labels}`);
  if (tx.note) console.log(`   📌 Note: ${tx.note}`);
  console.log(`   🏦 Account: ${tx.account_name}`);
  console.log('');
});

// Show search summary
const totalAmount = results.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
const incomeCount = results.filter(tx => tx.inflow).length;
const expenseCount = results.filter(tx => !tx.inflow).length;
const manualCount = results.filter(tx => tx.manual_override).length;

console.log('📊 Search Summary:');
console.log(`   Total Amount: $${totalAmount.toFixed(2)}`);
console.log(`   Income: ${incomeCount} transactions`);
console.log(`   Expenses: ${expenseCount} transactions`);
console.log(`   Manual Overrides: ${manualCount} transactions`);

// Show category breakdown
const categoryBreakdown = results.reduce((acc, tx) => {
  const cat = tx.category || 'Uncategorized';
  acc[cat] = (acc[cat] || 0) + 1;
  return acc;
}, {});

if (Object.keys(categoryBreakdown).length > 1) {
  console.log('\n🏷️  Category Breakdown:');
  Object.entries(categoryBreakdown)
    .sort(([,a], [,b]) => b - a)
    .forEach(([category, count]) => {
      console.log(`   ${category}: ${count} transactions`);
    });
}

// Show account breakdown
const accountBreakdown = results.reduce((acc, tx) => {
  acc[tx.account_name] = (acc[tx.account_name] || 0) + 1;
  return acc;
}, {});

if (Object.keys(accountBreakdown).length > 1) {
  console.log('\n🏦 Account Breakdown:');
  Object.entries(accountBreakdown)
    .sort(([,a], [,b]) => b - a)
    .forEach(([account, count]) => {
      console.log(`   ${account}: ${count} transactions`);
    });
}

db.close();
