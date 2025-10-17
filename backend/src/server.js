
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { db } from './db.js';
import { Accounts, Transactions } from './models.js';
import { txHash } from './utils/hash.js';
import { parseTransactionsCSV } from './utils/parseCSV.js';
import { parseTransactionsQFX } from './utils/parseQFX.js';
import { detectFileFormat, isSupportedFormat, getFormatDisplayName } from './utils/fileFormatDetector.js';
import { detectTransfers } from './utils/transferDetector.js';
import { guessCategory, addUserRule, updateUserRule, deleteUserRule, toggleUserRule, reapplyCategories, getAllRules, getRulesUsedInImport, generateAutoRules, applyAutoRules } from './categorizer/index.js';
import { loadJSON } from './categorizer/index.js';
import { findBestAccountMatch, suggestAccountName } from './utils/accountMatcher.js';
import { versioner } from './versioning.js';

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
  const { category, match_type, pattern, explain, labels } = req.body;
  try {
    const ruleId = await addUserRule({ category, match_type, pattern, explain: explain || 'User created rule', labels });
    res.json({ ok: true, ruleId });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// List all rules (consolidated from rules.json only)
app.get('/api/rules', (req, res) => {
  try {
    const rules = loadJSON('rules.json');
    res.json(rules);
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// List only user rules
app.get('/api/rules/user', (req, res) => {
  try {
    const rules = loadJSON('rules.json');
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
    const { category, match_type, pattern, explain, labels } = req.body;
    
    const result = await updateUserRule(ruleId, { category, match_type, pattern, explain, labels });
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
    
    let rows;
    
    if (format === 'csv') {
      rows = parseTransactionsCSV(req.file.buffer);
    } else if (format === 'qfx') {
      rows = await parseTransactionsQFX(req.file.buffer);
    }
    
    // Add account_id and hash to each transaction
    const processedRows = rows.map(r => ({
      ...r,
      account_id,
      hash: txHash({ ...r, account_id })
    }));

    // Transfer detection (pre-save)
    const ignore = detectTransfers(processedRows);

    // Add ignore flag to transactions
    const processedWithIgnore = processedRows.map(r => ({
      ...r,
      ignore: ignore.has(r.hash)
    }));

    // Filter out duplicates already saved
    const deduped = processedWithIgnore.filter(r => {
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
  const { items } = req.body; // array of preview rows user approved (with category possibly edited)
  let saved = 0, skipped = 0;
  for (const it of items) {
    if (it.ignore) continue;
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
      note: it.note || null,
      hash: it.hash,
      manual_override: 0
    };
    const resu = Transactions.upsert(tx);
    if (resu.skipped) skipped++; else saved++;
  }
  res.json({ ok: true, saved, skipped });
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
