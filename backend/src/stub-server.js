import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the rules JSON file
const RULES_JSON_PATH = path.join(__dirname, '../fixtures/rules.json');

// Path to the transactions JSON file
const TRANSACTIONS_JSON_PATH = path.join(__dirname, '../fixtures/transactions.json');

// Helper function to load stub auto rules from JSON file
function loadStubAutoRules() {
  try {
    const rulesJson = fs.readFileSync(RULES_JSON_PATH, 'utf8');
    return JSON.parse(rulesJson);
  } catch (error) {
    console.error('Error loading stub auto rules from JSON file:', error);
    // Return empty structure as fallback
    return {
      rules: [],
      analysis: {},
      stats: {
        totalTransactions: 0,
        rulesGenerated: 0,
        frequencyRules: 0,
        mccRules: 0,
        merchantIdRules: 0,
        recurringRules: 0,
        marketplaceRules: 0,
        exceptionRules: 0,
        rulesWithMatches: 0,
        rulesFilteredOut: 0
      },
      previews: []
    };
  }
}

// Helper function to load stub transactions from JSON file
function loadStubTransactions(account_id = 1) {
  try {
    const transactionsJson = fs.readFileSync(TRANSACTIONS_JSON_PATH, 'utf8');
    const data = JSON.parse(transactionsJson);
    
    // Update account_id in all transactions to match the requested account_id
    const updatedTransactions = (data.preview || []).map(tx => ({
      ...tx,
      account_id
    }));
    
    return {
      ...data,
      preview: updatedTransactions,
      totalTransactions: updatedTransactions.length,
      newTransactions: updatedTransactions.length
    };
  } catch (error) {
    console.error('Error loading stub transactions from JSON file:', error);
    // Return empty structure as fallback
    return {
      preview: [],
      format: 'csv',
      formatDisplayName: 'CSV',
      totalTransactions: 0,
      newTransactions: 0,
      duplicatesSkipped: 0
    };
  }
}



const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Stub data for testing - load from JSON file
const stubAutoRules = loadStubAutoRules();

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Stub auto rules generation endpoint
app.post('/api/rules/auto-generate', (req, res) => {
  console.log('Stub: Auto rules generation requested');
  console.log('Stub: Transactions received:', req.body.transactions?.length || 0);
  
  // Return stub data
  res.json(stubAutoRules);
});

// Stub other endpoints that might be needed
app.get('/api/accounts', (_req, res) => res.json([
  { id: 1, name: 'Test Account' }
]));

// Stub rules endpoint
app.get('/api/rules', (_req, res) => {
  console.log('Stub: Rules list requested');
  res.json([]);
});

app.post('/api/import/analyze', (req, res) => {
  console.log('Stub: File analysis requested');
  res.json({
    analysis: [{
      filename: 'test.csv',
      size: 1024,
      format: 'csv',
      formatDisplayName: 'CSV',
      isSupported: true,
      suggestedAccount: null,
      confidence: 0,
      suggestedName: 'Test Account'
    }],
    accounts: [{ id: 1, name: 'Test Account' }]
  });
});

app.post('/api/import/transactions', (req, res) => {
  console.log('Stub: Transaction import requested');
  
  try {
    const account_id = Number(req.body.account_id) || 1;
    
    // Load transactions from JSON file
    const response = loadStubTransactions(account_id);
    
    res.json(response);
  } catch (error) {
    console.error('Error loading transactions:', error);
    res.status(500).json({ 
      error: `Failed to load transactions: ${error.message}` 
    });
  }
});

app.post('/api/import/commit', (req, res) => {
  console.log('Stub: Import commit requested');
  res.json({ ok: true, saved: 5, skipped: 0 });
});

const PORT = process.env.PORT || 3108;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Stub API listening on ${HOST}:${PORT}`);
  console.log('Available endpoints:');
  console.log('  POST /api/rules/auto-generate - Returns stub auto rules');
  console.log('  POST /api/import/analyze - File analysis');
  console.log('  POST /api/import/transactions - Transaction import');
  console.log('  POST /api/import/commit - Import commit');
  console.log('  GET /api/accounts - Account list');
  console.log('  GET /api/health - Health check');
});
