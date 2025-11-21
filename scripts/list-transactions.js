#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, '..', 'backend', 'data', 'ciat.sqlite');
const db = new Database(dbPath);

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  limit: 50,
  category: null,
  account: null,
  startDate: null,
  endDate: null,
  search: null,
  sort: 'date',
  order: 'DESC',
  showUncategorized: false,
  showIncome: null, // null = all, true = income only, false = expenses only
  help: false
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  switch (arg) {
    case '--limit':
    case '-l':
      options.limit = parseInt(args[++i]) || 50;
      break;
    case '--category':
    case '-c':
      options.category = args[++i];
      break;
    case '--account':
    case '-a':
      options.account = args[++i];
      break;
    case '--start':
    case '-s':
      options.startDate = args[++i];
      break;
    case '--end':
    case '-e':
      options.endDate = args[++i];
      break;
    case '--search':
      options.search = args[++i];
      break;
    case '--sort':
      options.sort = args[++i];
      break;
    case '--order':
      options.order = args[++i].toUpperCase();
      break;
    case '--uncategorized':
    case '-u':
      options.showUncategorized = true;
      break;
    case '--income':
    case '-i':
      options.showIncome = true;
      break;
    case '--expenses':
    case '-x':
      options.showIncome = false;
      break;
    case '--help':
    case '-h':
      options.help = true;
      break;
  }
}

if (options.help) {
  console.log(`
Usage: node list-transactions.js [options]

Options:
  -l, --limit <number>        Number of transactions to show (default: 50)
  -c, --category <category>   Filter by category
  -a, --account <account>     Filter by account name
  -s, --start <date>          Start date (YYYY-MM-DD)
  -e, --end <date>            End date (YYYY-MM-DD)
  --search <term>             Search in name, description, or note
  --sort <field>              Sort by: date, amount, name (default: date)
  --order <direction>         Sort order: ASC, DESC (default: DESC)
  -u, --uncategorized         Show only uncategorized transactions
  -i, --income                Show only income transactions
  -x, --expenses              Show only expense transactions
  -h, --help                  Show this help message

Examples:
  node list-transactions.js --limit 100
  node list-transactions.js --category "Food" --limit 20
  node list-transactions.js --uncategorized
  node list-transactions.js --start 2024-01-01 --end 2024-12-31
  node list-transactions.js --search "starbucks" --income
`);
  process.exit(0);
}

// Build query
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
    a.name as account_name
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  WHERE 1=1
`;

const params = {};

if (options.category) {
  sql += ' AND t.category = @category';
  params.category = options.category;
}

if (options.account) {
  sql += ' AND a.name LIKE @account';
  params.account = `%${options.account}%`;
}

if (options.startDate) {
  sql += ' AND date(t.date) >= date(@startDate)';
  params.startDate = options.startDate;
}

if (options.endDate) {
  sql += ' AND date(t.date) <= date(@endDate)';
  params.endDate = options.endDate;
}

if (options.search) {
  sql += ' AND (t.name LIKE @search OR t.description LIKE @search OR t.note LIKE @search)';
  params.search = `%${options.search}%`;
}

if (options.showUncategorized) {
  sql += ' AND (t.category IS NULL OR t.category = \'\' OR t.category = \'uncategorized\')';
}

if (options.showIncome !== null) {
  sql += ' AND t.inflow = @inflow';
  params.inflow = options.showIncome ? 1 : 0;
}

// Add sorting
const validSort = ['date', 'amount', 'name'];
const validOrder = ['ASC', 'DESC'];
const sortField = validSort.includes(options.sort) ? options.sort : 'date';
const sortOrder = validOrder.includes(options.order) ? options.order : 'DESC';

sql += ` ORDER BY ${sortField} ${sortOrder}`;
sql += ` LIMIT ${options.limit}`;

// Execute query
const transactions = db.prepare(sql).all(params);

// Display results
console.log(`\n📊 Found ${transactions.length} transactions\n`);

if (transactions.length === 0) {
  console.log('No transactions found matching your criteria.');
  process.exit(0);
}

// Display transactions
transactions.forEach((tx, index) => {
  const amount = parseFloat(tx.amount);
  const amountStr = amount >= 0 ? `+$${amount.toFixed(2)}` : `-$${Math.abs(amount).toFixed(2)}`;
  const type = tx.inflow ? '💰 Income' : '💸 Expense';
  const category = tx.category || '❓ Uncategorized';
  const labels = tx.labels ? JSON.parse(tx.labels).join(', ') : '';
  
  console.log(`${index + 1}. ${tx.date} | ${amountStr} | ${type}`);
  console.log(`   ${tx.name}`);
  if (tx.description) console.log(`   📝 ${tx.description}`);
  console.log(`   🏷️  ${category} (${tx.category_source || 'unknown'})`);
  if (labels) console.log(`   🏷️  Labels: ${labels}`);
  if (tx.note) console.log(`   📌 Note: ${tx.note}`);
  console.log(`   🏦 Account: ${tx.account_name}`);
  console.log('');
});

// Show summary
const totalAmount = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
const incomeCount = transactions.filter(tx => tx.inflow).length;
const expenseCount = transactions.filter(tx => !tx.inflow).length;

console.log('📈 Summary:');
console.log(`   Total Amount: $${totalAmount.toFixed(2)}`);
console.log(`   Income: ${incomeCount} transactions`);
console.log(`   Expenses: ${expenseCount} transactions`);

db.close();
