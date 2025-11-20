
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import { Accounts, Transactions } from './models.js';
import { txHash } from './utils/hash.js';
import { parseTransactionsCSV, previewCSV } from './utils/parseCSV.js';
import { parseTransactionsQFX } from './utils/parseQFX.js';
import { detectFileFormat, isSupportedFormat, getFormatDisplayName } from './utils/fileFormatDetector.js';
import { parseLabels } from '../../common/src/ruleMatcher.js';
import { guessCategory, addUserRule, updateUserRule, deleteUserRule, toggleUserRule, reapplyCategories, getAllRules, getRulesUsedInImport, generateAutoRules, applyAutoRules } from './categorizer/index.js';
import { findBestAccountMatch, suggestAccountName } from './utils/accountMatcher.js';
import { versioner } from './versioning.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
const categoryTargetsPath = path.join(dataDir, 'category-targets.json');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const upload = multer({ storage: multer.memoryStorage() });

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Accounts
app.get('/api/accounts', (_req, res) => res.json(Accounts.all()));
app.post('/api/accounts', (req, res) => {
  const { name } = req.body;
  try {
    Accounts.create(name);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});
app.put('/api/accounts/:id', (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  try {
    const result = Accounts.update(id, name);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});
app.delete('/api/accounts/:id', (req, res) => {
  const { id } = req.params;
  try {
    // Check if account has transactions
    const transactionCount = Accounts.getTransactionCount(id);
    if (transactionCount.count > 0) {
      return res.status(400).json({ 
        error: `Cannot delete account with ${transactionCount.count} transactions. Please delete or reassign transactions first.` 
      });
    }
    
    const result = Accounts.delete(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// Field mapping endpoints
app.put('/api/accounts/:id/field-mapping', (req, res) => {
  const { id } = req.params;
  const { field_mapping } = req.body;
  try {
    const result = Accounts.updateFieldMapping(id, field_mapping);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// Transactions list/search/filter/sort
app.get('/api/transactions', (req, res) => {
  const list = Transactions.list({
    q: req.query.q,
    category: req.query.category,
    label: req.query.label,
    start: req.query.start,
    end: req.query.end,
    sort: req.query.sort,
    order: (req.query.order || '').toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
    accountId: req.query.accountId
  });
  res.json(list);
});

// Get all existing labels
app.get('/api/labels', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT labels 
      FROM transactions 
      WHERE labels IS NOT NULL AND labels != '' AND labels != 'null'
    `).all();
    
    const allLabels = new Set();
    rows.forEach(row => {
      try {
        const labels = JSON.parse(row.labels);
        if (Array.isArray(labels)) {
          labels.forEach(label => {
            if (label && label.trim()) {
              allLabels.add(label.trim());
            }
          });
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });
    
    const sortedLabels = Array.from(allLabels).sort();
    res.json(sortedLabels);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Update category (manual override → new user rule)
app.post('/api/transactions/:id/category', async (req, res) => {
  const id = Number(req.params.id);
  const { category, pattern, match_type, explain, labels } = req.body;
  try {
    // 1) update tx as manual override
    Transactions.updateCategory(id, category, explain || 'Manual override', 'manual', true, labels);
    // 2) persist a new user rule that should win in future
    if (pattern && match_type) {
      await addUserRule({ category, match_type, pattern, explain: explain || 'From user override', labels });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// Create new transaction
app.post('/api/transactions', async (req, res) => {
  const { account_id, date, name, description, amount, inflow, category, labels, note } = req.body;
  
  // Validate required fields
  if (!account_id || !date || !name || amount === undefined || amount === null) {
    return res.status(400).json({ error: 'Missing required fields: account_id, date, name, and amount are required' });
  }
  
  try {
    // Validate account exists
    const account = Accounts.findById(account_id);
    if (!account) {
      return res.status(404).json({ error: `Account with ID ${account_id} not found` });
    }
    
    // Generate hash for the transaction
    const hash = txHash({
      external_id: null,
      account_id: Number(account_id),
      date: date,
      name: name,
      description: description || null,
      amount: Number(amount),
      inflow: inflow ? 1 : 0
    });
    
    // Parse labels if provided
    const parsedLabels = parseLabels(labels);
    
    // Create transaction object
    const tx = {
      external_id: null,
      account_id: Number(account_id),
      date: date,
      name: name,
      description: description || null,
      amount: Number(amount),
      inflow: inflow ? 1 : 0,
      category: category || null,
      category_source: category ? 'manual' : null,
      category_explain: category ? 'Manually created transaction' : null,
      labels: parsedLabels.length > 0 ? JSON.stringify(parsedLabels) : null,
      note: note || null,
      hash: hash,
      manual_override: 1 // Manually created transactions are always manual overrides
    };
    
    // Use upsert to create the transaction
    const result = Transactions.upsert(tx);
    
    if (result.skipped) {
      return res.status(409).json({ error: 'A transaction with the same details already exists' });
    }
    
    // Get the created transaction
    const createdTransaction = db.prepare('SELECT t.*, a.name as account_name FROM transactions t JOIN accounts a ON a.id=t.account_id WHERE t.id = ?').get(result.id);
    
    res.json(createdTransaction);
  } catch (e) {
    console.error('Error creating transaction:', e);
    res.status(400).json({ error: String(e) });
  }
});

// Update transaction (general update endpoint)
app.put('/api/transactions/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { category, category_explain, labels } = req.body;
  
  // Validate transaction ID
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Invalid transaction ID' });
  }
  
  try {
    // Check if transaction exists
    const existing = db.prepare('SELECT id FROM transactions WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: `Transaction with ID ${id} not found` });
    }
    
    // When updating category from transactions table, mark as manual override
    if (category !== undefined) {
      const result = Transactions.updateCategory(
        id, 
        category, 
        category_explain || 'Manual override', 
        'manual', 
        true,  // manual_override = true
        labels
      );
      
      // Check if update actually affected any rows (shouldn't happen if we checked above, but double-check)
      if (result.changes === 0) {
        return res.status(404).json({ error: `Transaction with ID ${id} not found or could not be updated` });
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('Error updating transaction:', e);
    res.status(400).json({ error: String(e) });
  }
});

// Preview rule impact - show which transactions would be affected
app.post('/api/rules/preview', async (req, res) => {
  const { category, match_type, pattern, explain } = req.body;
  try {
    const affectedTransactions = await Transactions.previewRuleImpact({ category, match_type, pattern });
    res.json({ 
      affectedTransactions,
      rule: { category, match_type, pattern, explain },
      count: affectedTransactions.length
    });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// Create new rule with confirmation
app.post('/api/rules', async (req, res) => {
  const { category, match_type, pattern, explain, labels, priority } = req.body;
  try {
    const newRule = await addUserRule({ category, match_type, pattern, explain: explain || 'User created rule', labels, priority });
    res.json(newRule);
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// List all rules (from database)
app.get('/api/rules', (req, res) => {
  try {
    const rules = getAllRules();
    res.json(rules);
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// List only user rules
app.get('/api/rules/user', (req, res) => {
  try {
    const rules = getAllRules();
    res.json(rules);
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// Generate auto rules for transactions
app.post('/api/rules/auto-generate', async (req, res) => {
  try {
    const { transactions } = req.body;
    
    if (!transactions || transactions.length < 5) {
      return res.json({ rules: [], analysis: null });
    }
    
    const autoRules = await generateAutoRules(transactions);
    res.json(autoRules);
  } catch (e) {
    console.error('Auto rule generation error:', e);
    res.status(500).json({ error: String(e) });
  }
});

// Update rule
app.put('/api/rules/:id', async (req, res) => {
  try {
    const ruleId = req.params.id;
    const { category, match_type, pattern, explain, labels, priority } = req.body;
    
    const result = await updateUserRule(ruleId, { category, match_type, pattern, explain, labels, priority });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// Toggle rule enabled/disabled
app.patch('/api/rules/:id/toggle', async (req, res) => {
  try {
    const ruleId = req.params.id;
    const { enabled } = req.body;
    
    const result = await toggleUserRule(ruleId, enabled);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// Delete rule
app.delete('/api/rules/:id', async (req, res) => {
  try {
    const ruleId = req.params.id;
    
    const result = await deleteUserRule(ruleId);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// Manually trigger reapply categories
app.post('/api/reapply-categories', async (req, res) => {
  try {
    const result = await reapplyCategories();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Auto rule generation endpoints
app.post('/api/auto-rules/generate', async (req, res) => {
  try {
    const { transactions } = req.body;
    
    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ error: 'transactions array is required' });
    }
    
    const result = await generateAutoRules(transactions);
    res.json(result);
  } catch (error) {
    console.error('Auto rule generation error:', error);
    res.status(500).json({ error: `Failed to generate auto rules: ${error.message}` });
  }
});

app.post('/api/auto-rules/apply', async (req, res) => {
  try {
    const { rulesToApply, transactions } = req.body;
    
    if (!rulesToApply || !Array.isArray(rulesToApply)) {
      return res.status(400).json({ error: 'rulesToApply array is required' });
    }
    
    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ error: 'transactions array is required' });
    }
    
    const result = await applyAutoRules(rulesToApply, transactions);
    res.json(result);
  } catch (error) {
    console.error('Auto rule application error:', error);
    res.status(500).json({ error: `Failed to apply auto rules: ${error.message}` });
  }
});

// Analyze files and suggest account mappings
app.post('/api/import/analyze', upload.array('files'), (req, res) => {
  const files = req.files || [];
  const accounts = Accounts.all();
  
  const analysis = files.map(file => {
    const suggestedAccount = findBestAccountMatch(file.originalname, accounts);
    const suggestedName = suggestAccountName(file.originalname);
    const format = detectFileFormat(file.originalname, file.buffer);
    const isSupported = isSupportedFormat(format);
    
    return {
      filename: file.originalname,
      size: file.size,
      format: format,
      formatDisplayName: getFormatDisplayName(format),
      isSupported: isSupported,
      suggestedAccount: suggestedAccount?.account || null,
      confidence: suggestedAccount?.score || 0,
      suggestedName: suggestedName
    };
  });

  res.json({ analysis, accounts });
});

// Preview CSV for field mapping
app.post('/api/import/preview-csv', upload.single('file'), (req, res) => {
  try {
    const format = detectFileFormat(req.file.originalname, req.file.buffer);
    
    if (format !== 'csv') {
      return res.status(400).json({ 
        error: `File must be CSV format. Got: ${format}` 
      });
    }
    
    const preview = previewCSV(req.file.buffer);
    res.json(preview);
  } catch (error) {
    console.error('CSV preview error:', error);
    res.status(500).json({ 
      error: `Failed to preview CSV: ${error.message}` 
    });
  }
});

// Import transactions (CSV or QFX)
app.post('/api/import/transactions', upload.single('file'), async (req, res) => {
  const account_id = Number(req.body.account_id);
  if (!account_id) return res.status(400).json({ error: 'account_id required' });
  
  try {
    const format = detectFileFormat(req.file.originalname, req.file.buffer);
    
    if (!isSupportedFormat(format)) {
      return res.status(400).json({ 
        error: `Unsupported file format: ${format}. Supported formats: CSV, QFX` 
      });
    }
    
    // Get account field mapping if it exists
    const account = Accounts.findById(account_id);
    const fieldMapping = account?.field_mapping || null;
    
    let rows;
    
    if (format === 'csv') {
      rows = parseTransactionsCSV(req.file.buffer, fieldMapping);
    } else if (format === 'qfx') {
      rows = await parseTransactionsQFX(req.file.buffer);
    }
    
    // Add account_id and hash to each transaction
    const processedRows = rows.map(r => ({
      ...r,
      account_id,
      hash: txHash({ ...r, account_id })
    }));

    // Parse labels for each transaction (preserve existing labels if any)
    const processedWithLabels = processedRows.map(r => {
      const labels = parseLabels(r.labels);
      
      return {
        ...r,
        labels: labels.length > 0 ? labels : [],
        // Keep ignore flag for backward compatibility with UI, but it won't be used to skip saving
        ignore: false
      };
    });

    // Filter out duplicates already saved
    const deduped = processedWithLabels.filter(r => {
      const existing = db.prepare('SELECT 1 FROM transactions WHERE hash=?').get(r.hash);
      if (existing) {
        console.log(`Skipping duplicate transaction: ${r.name} - ${r.amount} on ${r.date}`);
        return false;
      }
      return true;
    });
    
    res.json({ 
      preview: deduped,
      format: format,
      formatDisplayName: getFormatDisplayName(format),
      totalTransactions: rows.length,
      newTransactions: deduped.length,
      duplicatesSkipped: rows.length - deduped.length
    });
    
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ 
      error: `Failed to import file: ${error.message}` 
    });
  }
});

// Legacy CSV endpoint for backward compatibility
app.post('/api/import/csv', upload.single('file'), async (req, res) => {
  // Redirect to the new generic endpoint
  req.url = '/api/import/transactions';
  req.method = 'POST';
  // The generic endpoint will handle the request
  return app._router.handle(req, res);
});

// Save imported preview
app.post('/api/import/commit', (req, res) => {
  try {
    const { items } = req.body; // array of preview rows user approved (with category possibly edited)
    
    // Validate input
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'items array is required' });
    }
    
    console.log(`POST http://localhost:3108/api/import/commit - Processing ${items.length} items`);
    
    let saved = 0, skipped = 0;
    
    for (const it of items) {
      // Validate required fields
      if (!it.account_id || !it.date || !it.name || !it.amount || !it.hash) {
        console.error('Missing required fields for transaction:', it);
        continue;
      }
      
      // Parse labels (preserves 'transfer' label if present)
      const labels = parseLabels(it.labels);
      
      const tx = {
        external_id: it.external_id || null,
        account_id: it.account_id,
        date: it.date,
        name: it.name,
        description: it.description,
        amount: Number(it.amount),
        inflow: it.inflow ? 1 : 0,
        category: it.category,
        category_source: it.category_source,
        category_explain: it.category_explain,
        labels: labels.length > 0 ? JSON.stringify(labels) : null,
        note: it.note || null,
        hash: it.hash,
        manual_override: 0
      };
      
      try {
        const resu = Transactions.upsert(tx);
        if (resu.skipped) skipped++; else saved++;
      } catch (error) {
        console.error('Error upserting transaction:', error, tx);
        // Continue with other transactions even if one fails
      }
    }
    
    console.log(`Import commit completed: ${saved} saved, ${skipped} skipped`);
    res.json({ ok: true, saved, skipped });
    
  } catch (error) {
    console.error('Error in /api/import/commit:', error);
    res.status(500).json({ 
      error: `Failed to commit imports: ${error.message}` 
    });
  }
});

// Database versioning endpoints
app.get('/api/versions', (_req, res) => {
  try {
    const versions = versioner.listVersions();
    res.json(versions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/versions', (req, res) => {
  try {
    const { description } = req.body;
    const versionId = versioner.createVersion(description || 'Manual version');
    res.json({ ok: true, versionId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/versions/:id/revert', (req, res) => {
  try {
    const { id } = req.params;
    const metadata = versioner.revertToVersion(id);
    res.json({ ok: true, metadata });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/versions/:id', (req, res) => {
  try {
    const { id } = req.params;
    versioner.deleteVersion(id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/versions/status', (_req, res) => {
  try {
    const currentHash = versioner.calculateDatabaseHash();
    const versions = versioner.listVersions();
    const latestVersion = versions[0];
    
    res.json({
      currentHash,
      totalVersions: versions.length,
      latestVersion: latestVersion || null,
      isUpToDate: latestVersion ? latestVersion.hash === currentHash : true
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Category targets endpoints
const calculateDefaultCategoryTargets = () => {
  // Get all transactions
  const allTransactions = Transactions.list({});
  
  if (allTransactions.length === 0) {
    // No transactions, return fallback defaults
    return {
      fixed_costs: 35,
      investments: 10,
      guilt_free: 40,
      short_term_savings: 15
    };
  }
  
  // Calculate date range
  const dates = allTransactions
    .map(tx => tx.date)
    .filter(date => date)
    .sort();
  
  if (dates.length === 0) {
    return {
      fixed_costs: 35,
      investments: 10,
      guilt_free: 40,
      short_term_savings: 15
    };
  }
  
  const startDate = new Date(dates[0]);
  const endDate = new Date(dates[dates.length - 1]);
  const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
  const totalMonths = Math.max(totalDays / 30.4375, 0.1); // Minimum 0.1 to avoid division by zero
  
  // Calculate total net income (inflows)
  const totalNetIncome = allTransactions
    .filter(tx => tx.inflow === 1)
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  
  if (totalNetIncome <= 0) {
    // No income, return fallback defaults
    return {
      fixed_costs: 35,
      investments: 10,
      guilt_free: 40,
      short_term_savings: 15
    };
  }
  
  // Calculate total actual spending by category (total outflows - total inflows)
  const categories = ['fixed_costs', 'investments', 'guilt_free', 'short_term_savings'];
  const totalActual = {};
  
  categories.forEach(category => {
    const categoryTransactions = allTransactions.filter(tx => tx.category === category);
    
    const inflows = categoryTransactions
      .filter(tx => tx.inflow === 1)
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    
    const outflows = categoryTransactions
      .filter(tx => tx.inflow === 0)
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    
    // Total actual = outflows - inflows (matching frontend calculation)
    totalActual[category] = outflows - inflows;
  });
  
  // Calculate defaults based on heuristic:
  // - investments = 10%
  // - fixed_costs and guilt_free set such that they have $0 surplus (target = actual)
  // - short_term_savings = remainder to make it 100%
  
  const investments = 10;
  
  // Calculate fixed_costs and guilt_free percentages to achieve $0 surplus
  // For total values: totalTarget = totalActual
  // totalTarget = (totalNetIncome * percentage) / 100
  // So: (totalNetIncome * percentage) / 100 = totalActual
  // percentage = (totalActual * 100) / totalNetIncome
  
  let fixed_costs = totalNetIncome > 0
    ? (totalActual.fixed_costs * 100) / totalNetIncome
    : 35;
  
  let guilt_free = totalNetIncome > 0
    ? (totalActual.guilt_free * 100) / totalNetIncome
    : 40;
  
  // Ensure percentages are non-negative
  fixed_costs = Math.max(0, fixed_costs);
  guilt_free = Math.max(0, guilt_free);
  
  // Calculate short_term_savings as remainder
  let short_term_savings = 100 - investments - fixed_costs - guilt_free;
  
  // If short_term_savings would be negative, normalize fixed_costs and guilt_free
  // to ensure all four add up to 100% while maintaining their relative proportions
  if (short_term_savings < 0) {
    const available = 100 - investments; // 90% available for fixed_costs, guilt_free, and short_term_savings
    const totalRequested = fixed_costs + guilt_free;
    
    if (totalRequested > 0) {
      // Scale down proportionally
      const scale = available / totalRequested;
      fixed_costs = fixed_costs * scale;
      guilt_free = guilt_free * scale;
      short_term_savings = 0; // No room for short_term_savings
    } else {
      // Both are 0, allocate all to short_term_savings
      fixed_costs = 0;
      guilt_free = 0;
      short_term_savings = available;
    }
  }
  
  return {
    fixed_costs: Math.round(fixed_costs * 100000) / 100000, // Round to 5 decimal places
    investments: investments,
    guilt_free: Math.round(guilt_free * 100000) / 100000, // Round to 5 decimal places
    short_term_savings: Math.round(short_term_savings * 100000) / 100000 // Round to 5 decimal places
  };
};

app.get('/api/category-targets', (req, res) => {
  try {
    if (fs.existsSync(categoryTargetsPath)) {
      const content = fs.readFileSync(categoryTargetsPath, 'utf8');
      const targets = JSON.parse(content);
      res.json(targets);
    } else {
      // Calculate defaults based on transaction data
      const defaults = calculateDefaultCategoryTargets();
      res.json(defaults);
    }
  } catch (error) {
    console.error('Error reading category targets:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to get calculated default targets (always returns calculated defaults)
app.get('/api/category-targets/defaults', (req, res) => {
  try {
    const defaults = calculateDefaultCategoryTargets();
    res.json(defaults);
  } catch (error) {
    console.error('Error calculating default category targets:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/category-targets', (req, res) => {
  try {
    const { targets } = req.body;
    
    if (!targets || typeof targets !== 'object') {
      return res.status(400).json({ error: 'targets object is required' });
    }
    
    // Validate that all required categories are present
    const requiredCategories = ['fixed_costs', 'investments', 'guilt_free', 'short_term_savings'];
    for (const category of requiredCategories) {
      if (!(category in targets) || typeof targets[category] !== 'number') {
        return res.status(400).json({ error: `Invalid or missing target for category: ${category}` });
      }
    }
    
    // Validate that percentages sum to 100
    const total = Object.values(targets).reduce((sum, val) => sum + val, 0);
    if (Math.abs(total - 100) > 0.01) {
      return res.status(400).json({ error: 'Target percentages must sum to exactly 100%' });
    }
    
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Write to file
    fs.writeFileSync(categoryTargetsPath, JSON.stringify(targets, null, 2), 'utf8');
    res.json({ ok: true, targets });
  } catch (error) {
    console.error('Error saving category targets:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize versioning on server start
const initializeVersioning = async () => {
  try {
    // Create initial version if no versions exist
    const versions = versioner.listVersions();
    if (versions.length === 0) {
      console.log('Creating initial database version...');
      versioner.createVersion('Initial database state');
    }
    
    // Start watching for changes
    versioner.startWatching(5000);
    console.log('Database versioning initialized');
  } catch (error) {
    console.error('Failed to initialize versioning:', error);
  }
};

const PORT = process.env.PORT || 3108;
app.listen(PORT, () => {
  console.log('API listening on ' + PORT);
  initializeVersioning();
});
