
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { db } from './db.js';
import { Accounts, Transactions } from './models.js';
import { txHash } from './utils/hash.js';
import { parseTransactionsCSV } from './utils/parseCSV.js';
import { detectTransfers } from './utils/transferDetector.js';
import { guessCategory, addUserRule } from './categorizer/index.js';
import { versioner } from './versioning.js';

const app = express();
app.use(cors());
app.use(express.json());

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

// Transactions list/search/filter/sort
app.get('/api/transactions', (req, res) => {
  const list = Transactions.list({
    q: req.query.q,
    category: req.query.category,
    start: req.query.start,
    end: req.query.end,
    sort: req.query.sort,
    order: (req.query.order || '').toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
    accountId: req.query.accountId
  });
  res.json(list);
});

// Update category (manual override → new user rule)
app.post('/api/transactions/:id/category', (req, res) => {
  const id = Number(req.params.id);
  const { category, pattern, match_type, explain } = req.body;
  try {
    // 1) update tx as manual override
    Transactions.updateCategory(id, category, explain || 'Manual override', 'manual', true);
    // 2) persist a new user rule that should win in future
    if (pattern && match_type) {
      addUserRule({ category, match_type, pattern, explain: explain || 'From user override' });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// Import CSV
app.post('/api/import/csv', upload.single('file'), (req, res) => {
  const account_id = Number(req.body.account_id);
  if (!account_id) return res.status(400).json({ error: 'account_id required' });
  const rows = parseTransactionsCSV(req.file.buffer).map(r => ({
    ...r,
    account_id,
    hash: txHash({ ...r, account_id })
  }));

  // Transfer detection (pre-save)
  const ignore = detectTransfers(rows);

  const preview = rows.map(r => {
    const guess = guessCategory(r);
    return { ...r, ...guess, ignore: ignore.has(r.hash) };
  });

  // Filter out duplicates already saved
  const deduped = preview.filter(r => !db.prepare('SELECT 1 FROM transactions WHERE hash=?').get(r.hash));

  res.json({ preview: deduped });
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

const PORT = process.env.PORT || 5174;
app.listen(PORT, () => {
  console.log('API listening on ' + PORT);
  initializeVersioning();
});
