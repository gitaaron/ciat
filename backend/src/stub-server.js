import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Stub data for testing
const stubAutoRules = {
  rules: [
    {
      id: 'auto_stub_1',
      match_type: 'contains',
      pattern: 'york square',
      category: 'fixed_costs',
      support: 2,
      applied: false,
      enabled: true,
      explain: 'auto',
      source: 'frequency_analysis',
      priority: 500,
      labels: [],
      actualMatches: 2,
      matchingTransactions: ['test1', 'test5']
    },
    {
      id: 'auto_stub_2',
      match_type: 'contains',
      pattern: 'smoque bones',
      category: 'guilt_free',
      support: 1,
      applied: false,
      enabled: true,
      explain: 'auto',
      source: 'frequency_analysis',
      priority: 500,
      labels: [],
      actualMatches: 1,
      matchingTransactions: ['test2']
    },
    {
      id: 'auto_stub_3',
      match_type: 'contains',
      pattern: 'amazon channels',
      category: 'short_term_savings',
      support: 1,
      applied: false,
      enabled: true,
      explain: 'auto',
      source: 'frequency_analysis',
      priority: 500,
      labels: [],
      actualMatches: 1,
      matchingTransactions: ['test4']
    },
    {
      id: 'auto_stub_4',
      match_type: 'contains',
      pattern: 'jian hing',
      category: 'fixed_costs',
      support: 1,
      applied: false,
      enabled: true,
      explain: 'auto',
      source: 'frequency_analysis',
      priority: 500,
      labels: [],
      actualMatches: 1,
      matchingTransactions: ['test3']
    }
  ],
  analysis: {
    tokenFrequency: new Map(),
    merchantFrequency: new Map(),
    storePatterns: new Map(),
    mccMappings: new Map(),
    merchantIdMappings: new Map()
  },
  stats: {
    totalTransactions: 5,
    rulesGenerated: 4,
    frequencyRules: 4,
    mccRules: 0,
    merchantIdRules: 0,
    recurringRules: 0,
    marketplaceRules: 0,
    exceptionRules: 0,
    rulesWithMatches: 4,
    rulesFilteredOut: 0
  },
  previews: []
};

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
  const mockTransactions = [
    {
      name: 'YORK SQUARE PARKING TORONTO',
      amount: -15.00,
      date: '2024-01-01',
      hash: 'test1',
      account_id: 1
    },
    {
      name: 'SMOQUE BONES TORONTO',
      amount: -25.00,
      date: '2024-01-02',
      hash: 'test2',
      account_id: 1
    },
    {
      name: 'JIAN HING SUPERMARKET NORTH',
      amount: -45.00,
      date: '2024-01-03',
      hash: 'test3',
      account_id: 1
    },
    {
      name: 'AMAZON CHANNELS AMAZON CA',
      amount: -8.99,
      date: '2024-01-04',
      hash: 'test4',
      account_id: 1
    },
    {
      name: 'YORK SQUARE PARKING TORONTO',
      amount: -15.00,
      date: '2024-01-08',
      hash: 'test5',
      account_id: 1
    }
  ];
  
  res.json({
    preview: mockTransactions,
    format: 'csv',
    formatDisplayName: 'CSV',
    totalTransactions: 5,
    newTransactions: 5,
    duplicatesSkipped: 0
  });
});

app.post('/api/import/commit', (req, res) => {
  console.log('Stub: Import commit requested');
  res.json({ ok: true, saved: 5, skipped: 0 });
});

const PORT = process.env.PORT || 3108;
app.listen(PORT, () => {
  console.log(`Stub API listening on port ${PORT}`);
  console.log('Available endpoints:');
  console.log('  POST /api/rules/auto-generate - Returns stub auto rules');
  console.log('  POST /api/import/analyze - File analysis');
  console.log('  POST /api/import/transactions - Transaction import');
  console.log('  POST /api/import/commit - Import commit');
  console.log('  GET /api/accounts - Account list');
  console.log('  GET /api/health - Health check');
});
