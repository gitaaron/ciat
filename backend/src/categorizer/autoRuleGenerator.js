import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration for auto rule generation
const CONFIG = {
  MIN_FREQUENCY: 2, // Lowered for testing
  MIN_CLUSTER_SIMILARITY: 0.85,
  MAX_RULES_PER_IMPORT: 50,
  SHORT_TERM_AMOUNT_THRESHOLD: 500, // Amount threshold for short_term_savings category
  STORE_NUMBER_PATTERN: /#?\d{2,5}/g,
  PHONE_PATTERN: /\(\d{3}\)\s*\d{3}-\d{4}|\d{3}-\d{3}-\d{4}/g,
  AMOUNT_PATTERN: /\$[\d,]+\.?\d*/g,
  DATE_PATTERN: /\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/g,
  REFERENCE_PATTERN: /ref[#:]?\s*\d+/gi,
  PAYMENT_RAIL_NOISE: [
    'visa debit', 'interac', 'pos', 'purchase', 'debit', 'credit',
    'atm', 'cash withdrawal', 'online banking', 'mobile payment'
  ],
  BRAND_CANONICALIZATION: {
    'mcdonald\'s': 'mcdonalds',
    'mcdonalds': 'mcdonalds',
    'costco wholesale': 'costco',
    'walmart supercenter': 'walmart',
    'target corporation': 'target',
    'home depot': 'homedepot',
    'lowes companies': 'lowes',
    'starbucks coffee': 'starbucks',
    'tim hortons': 'timhortons',
    'subway restaurants': 'subway'
  },
  MCC_CATEGORY_MAPPING: {
    '5411': 'fixed_costs', // Grocery stores
    '5814': 'guilt_free', // Fast food
    '5541': 'guilt_free', // Gas stations
    '5311': 'fixed_costs', // Department stores
    '5812': 'guilt_free', // Restaurants
    '5999': 'guilt_free', // Miscellaneous retail
    '4900': 'fixed_costs', // Utilities
    '6011': 'guilt_free', // ATM
    '6010': 'guilt_free', // Financial institutions
    '4111': 'fixed_costs', // Transportation
    '4121': 'fixed_costs', // Taxi/limo
    '4131': 'fixed_costs', // Bus lines
    '4511': 'fixed_costs', // Airlines
    '7011': 'guilt_free', // Hotels
    '5813': 'guilt_free', // Drinking places
    '5812': 'guilt_free', // Eating places
    '5993': 'guilt_free', // Cigar stores
    '5994': 'guilt_free', // News dealers
    '5995': 'guilt_free', // Pet shops
    '5996': 'guilt_free', // Swimming pools
    '5997': 'guilt_free', // Electric razor stores
    '5998': 'guilt_free', // Tent and awning stores
    '5999': 'guilt_free', // Miscellaneous retail
    '6012': 'guilt_free', // Financial institutions
    '6013': 'guilt_free', // Financial institutions
    '6014': 'guilt_free', // Financial institutions
    '6015': 'guilt_free', // Financial institutions
    '6016': 'guilt_free', // Financial institutions
    '6017': 'guilt_free', // Financial institutions
    '6018': 'guilt_free', // Financial institutions
    '6019': 'guilt_free', // Financial institutions
    '6020': 'guilt_free', // Financial institutions
    '6021': 'guilt_free', // Financial institutions
    '6022': 'guilt_free', // Financial institutions
    '6023': 'guilt_free', // Financial institutions
    '6024': 'guilt_free', // Financial institutions
    '6025': 'guilt_free', // Financial institutions
    '6026': 'guilt_free', // Financial institutions
    '6027': 'guilt_free', // Financial institutions
    '6028': 'guilt_free', // Financial institutions
    '6029': 'guilt_free', // Financial institutions
    '6030': 'guilt_free', // Financial institutions
    '6031': 'guilt_free', // Financial institutions
    '6032': 'guilt_free', // Financial institutions
    '6033': 'guilt_free', // Financial institutions
    '6034': 'guilt_free', // Financial institutions
    '6035': 'guilt_free', // Financial institutions
    '6036': 'guilt_free', // Financial institutions
    '6037': 'guilt_free', // Financial institutions
    '6038': 'guilt_free', // Financial institutions
    '6039': 'guilt_free', // Financial institutions
    '6040': 'guilt_free', // Financial institutions
    '6041': 'guilt_free', // Financial institutions
    '6042': 'guilt_free', // Financial institutions
    '6043': 'guilt_free', // Financial institutions
    '6044': 'guilt_free', // Financial institutions
    '6045': 'guilt_free', // Financial institutions
    '6046': 'guilt_free', // Financial institutions
    '6047': 'guilt_free', // Financial institutions
    '6048': 'guilt_free', // Financial institutions
    '6049': 'guilt_free', // Financial institutions
    '6050': 'guilt_free', // Financial institutions
    '6051': 'guilt_free', // Financial institutions
    '6052': 'guilt_free', // Financial institutions
    '6053': 'guilt_free', // Financial institutions
    '6054': 'guilt_free', // Financial institutions
    '6055': 'guilt_free', // Financial institutions
    '6056': 'guilt_free', // Financial institutions
    '6057': 'guilt_free', // Financial institutions
    '6058': 'guilt_free', // Financial institutions
    '6059': 'guilt_free', // Financial institutions
    '6060': 'guilt_free', // Financial institutions
    '6061': 'guilt_free', // Financial institutions
    '6062': 'guilt_free', // Financial institutions
    '6063': 'guilt_free', // Financial institutions
    '6064': 'guilt_free', // Financial institutions
    '6065': 'guilt_free', // Financial institutions
    '6066': 'guilt_free', // Financial institutions
    '6067': 'guilt_free', // Financial institutions
    '6068': 'guilt_free', // Financial institutions
    '6069': 'guilt_free', // Financial institutions
    '6070': 'guilt_free', // Financial institutions
    '6071': 'guilt_free', // Financial institutions
    '6072': 'guilt_free', // Financial institutions
    '6073': 'guilt_free', // Financial institutions
    '6074': 'guilt_free', // Financial institutions
    '6075': 'guilt_free', // Financial institutions
    '6076': 'guilt_free', // Financial institutions
    '6077': 'guilt_free', // Financial institutions
    '6078': 'guilt_free', // Financial institutions
    '6079': 'guilt_free', // Financial institutions
    '6080': 'guilt_free', // Financial institutions
    '6081': 'guilt_free', // Financial institutions
    '6082': 'guilt_free', // Financial institutions
    '6083': 'guilt_free', // Financial institutions
    '6084': 'guilt_free', // Financial institutions
    '6085': 'guilt_free', // Financial institutions
    '6086': 'guilt_free', // Financial institutions
    '6087': 'guilt_free', // Financial institutions
    '6088': 'guilt_free', // Financial institutions
    '6089': 'guilt_free', // Financial institutions
    '6090': 'guilt_free', // Financial institutions
    '6091': 'guilt_free', // Financial institutions
    '6092': 'guilt_free', // Financial institutions
    '6093': 'guilt_free', // Financial institutions
    '6094': 'guilt_free', // Financial institutions
    '6095': 'guilt_free', // Financial institutions
    '6096': 'guilt_free', // Financial institutions
    '6097': 'guilt_free', // Financial institutions
    '6098': 'guilt_free', // Financial institutions
    '6099': 'guilt_free' // Financial institutions
  }
};

/**
 * Determine category for a rule based on pattern and transaction context
 * @param {string} pattern - The rule pattern
 * @param {string} ruleType - Type of rule (contains, regex, exact, mcc)
 * @param {Array} matchingTransactions - Transactions that would match this rule
 * @returns {string} - Category for the rule
 */
export function determineRuleCategory(pattern, ruleType, matchingTransactions = []) {
  const normalizedPattern = pattern.toLowerCase();
  
  // 1. Frequency-based rules are always fixed_costs
  if (ruleType === 'contains' || ruleType === 'regex') {
    // Check for food/groceries keywords
    const foodKeywords = [
      'grocery', 'supermarket', 'food', 'fresh', 'market', 'produce',
      'meat', 'dairy', 'bakery', 'deli', 'organic', 'whole foods',
      'safeway', 'kroger', 'publix', 'wegmans', 'trader joe',
      'costco', 'walmart', 'target', 'loblaws', 'metro', 'sobeys',
      'restaurant', 'cafe', 'diner', 'eatery', 'kitchen', 'grill',
      'pizza', 'burger', 'sandwich', 'coffee', 'starbucks', 'tim hortons',
      'mcdonalds', 'subway', 'kfc', 'taco bell', 'wendys', 'burger king'
    ];
    
    const isFoodRelated = foodKeywords.some(keyword => 
      normalizedPattern.includes(keyword)
    );
    
    if (isFoodRelated) {
      return 'fixed_costs';
    }
    
    // Check for automotive keywords
    const automotiveKeywords = [
      'gas', 'gasoline', 'fuel', 'petro', 'esso', 'shell', 'chevron',
      'parking', 'impark', 'park', 'garage', 'auto', 'car', 'vehicle',
      'maintenance', 'repair', 'service', 'oil change', 'tire', 'brake',
      'insurance', 'geico', 'state farm', 'progressive', 'allstate',
      'dmv', 'registration', 'license', 'inspection'
    ];
    
    const isAutomotiveRelated = automotiveKeywords.some(keyword => 
      normalizedPattern.includes(keyword)
    );
    
    if (isAutomotiveRelated) {
      return 'fixed_costs';
    }
    
    // Check transaction amounts for short_term_savings
    if (matchingTransactions.length > 0) {
      const hasHighAmount = matchingTransactions.some(tx => 
        Math.abs(Number(tx.amount)) >= CONFIG.SHORT_TERM_AMOUNT_THRESHOLD
      );
      
      if (hasHighAmount) {
        return 'short_term_savings';
      }
    }
    
    // Default for frequency-based rules is fixed_costs
    return 'fixed_costs';
  }
  
  // 2. MCC-based rules use predefined mappings or default logic
  if (ruleType === 'mcc') {
    const predefinedCategory = CONFIG.MCC_CATEGORY_MAPPING[pattern];
    if (predefinedCategory) {
      return predefinedCategory;
    }
    
    // Default MCC rules to fixed_costs
    return 'fixed_costs';
  }
  
  // 3. Merchant ID rules - check amounts
  if (ruleType === 'exact' && matchingTransactions.length > 0) {
    const hasHighAmount = matchingTransactions.some(tx => 
      Math.abs(Number(tx.amount)) >= CONFIG.SHORT_TERM_AMOUNT_THRESHOLD
    );
    
    if (hasHighAmount) {
      return 'short_term_savings';
    }
    
    return 'guilt_free';
  }
  
  // 4. Default fallback
  return 'guilt_free';
}

/**
 * Normalize merchant string for pattern matching
 * @param {string} merchant - Raw merchant string
 * @returns {Object} - { raw, normalized }
 */
export function normalizeMerchant(merchant) {
  if (!merchant) return { raw: '', normalized: '' };
  
  const raw = merchant.trim();
  let normalized = raw.toLowerCase();
  
  // Remove punctuation and emojis
  normalized = normalized.replace(/[^\w\s]/g, ' ');
  
  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  // Remove variable tokens
  normalized = normalized.replace(CONFIG.STORE_NUMBER_PATTERN, '');
  normalized = normalized.replace(CONFIG.PHONE_PATTERN, '');
  normalized = normalized.replace(CONFIG.AMOUNT_PATTERN, '');
  normalized = normalized.replace(CONFIG.DATE_PATTERN, '');
  normalized = normalized.replace(CONFIG.REFERENCE_PATTERN, '');
  
  // Remove payment rail noise
  for (const noise of CONFIG.PAYMENT_RAIL_NOISE) {
    normalized = normalized.replace(new RegExp(`\\b${noise}\\b`, 'gi'), '');
  }
  
  // Canonicalize brand variants
  for (const [variant, canonical] of Object.entries(CONFIG.BRAND_CANONICALIZATION)) {
    if (normalized.includes(variant)) {
      normalized = normalized.replace(new RegExp(`\\b${variant}\\b`, 'gi'), canonical);
    }
  }
  
  // Clean up again after replacements
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return { raw, normalized };
}

/**
 * Extract tokens and n-grams from normalized merchant string
 * @param {string} normalized - Normalized merchant string
 * @returns {Array} - Array of tokens and n-grams
 */
export function extractTokens(normalized) {
  if (!normalized) return [];
  
  const tokens = normalized.split(/\s+/).filter(t => t.length > 1);
  const ngrams = [];
  
  // Add 2-grams and 3-grams
  for (let i = 0; i < tokens.length - 1; i++) {
    ngrams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  
  for (let i = 0; i < tokens.length - 2; i++) {
    ngrams.push(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
  }
  
  return [...tokens, ...ngrams];
}

/**
 * Calculate Jaccard similarity between two sets
 * @param {Set} setA - First set
 * @param {Set} setB - Second set
 * @returns {number} - Jaccard similarity coefficient
 */
export function jaccardSimilarity(setA, setB) {
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

/**
 * Cluster similar merchants based on token similarity
 * @param {Array} merchants - Array of { raw, normalized, category, tokens }
 * @returns {Array} - Array of clusters
 */
export function clusterMerchants(merchants) {
  const clusters = [];
  const processed = new Set();
  
  for (let i = 0; i < merchants.length; i++) {
    if (processed.has(i)) continue;
    
    const cluster = [merchants[i]];
    const tokensA = new Set(merchants[i].tokens);
    processed.add(i);
    
    for (let j = i + 1; j < merchants.length; j++) {
      if (processed.has(j)) continue;
      
      const tokensB = new Set(merchants[j].tokens);
      const similarity = jaccardSimilarity(tokensA, tokensB);
      
      if (similarity >= CONFIG.MIN_CLUSTER_SIMILARITY) {
        cluster.push(merchants[j]);
        processed.add(j);
      }
    }
    
    if (cluster.length > 1) {
      clusters.push(cluster);
    }
  }
  
  return clusters;
}

/**
 * Detect store number patterns in merchant names
 * @param {string} merchant - Merchant name
 * @returns {Object|null} - { brand, hasStoreNumber, pattern } or null
 */
export function detectStoreNumberPattern(merchant) {
  const normalized = normalizeMerchant(merchant).normalized;
  const storeMatch = normalized.match(/(\w+)\s*(?:#?\d{2,5})/);
  
  if (storeMatch) {
    const brand = storeMatch[1];
    const hasStoreNumber = normalized.includes('#') || /\d{2,5}/.test(normalized);
    
    return {
      brand,
      hasStoreNumber,
      pattern: hasStoreNumber ? `^${brand}(?:\\s*#?\\d{2,5})?$` : `^${brand}$`
    };
  }
  
  return null;
}

/**
 * Analyze transaction frequency patterns (without category tracking)
 * @param {Array} transactions - Array of transactions with normalized merchant names
 * @returns {Object} - Analysis results
 */
export function analyzeTransactionPatterns(transactions) {
  const tokenFrequency = new Map();
  const merchantFrequency = new Map();
  const storePatterns = new Map();
  const mccMappings = new Map();
  const merchantIdMappings = new Map();
  
  // Process each transaction
  for (const tx of transactions) {
    const { raw, normalized } = normalizeMerchant(tx.name);
    const tokens = extractTokens(normalized);
    
    // Track merchant frequency
    if (!merchantFrequency.has(normalized)) {
      merchantFrequency.set(normalized, { count: 0, raw, transactions: [] });
    }
    const merchant = merchantFrequency.get(normalized);
    merchant.count++;
    merchant.transactions.push(tx);
    
    // Track token frequency
    for (const token of tokens) {
      if (!tokenFrequency.has(token)) {
        tokenFrequency.set(token, { count: 0, transactions: [] });
      }
      const tokenData = tokenFrequency.get(token);
      tokenData.count++;
      tokenData.transactions.push(tx);
    }
    
    // Track store number patterns
    const storePattern = detectStoreNumberPattern(tx.name);
    if (storePattern) {
      const key = storePattern.brand;
      if (!storePatterns.has(key)) {
        storePatterns.set(key, { count: 0, pattern: storePattern.pattern, transactions: [] });
      }
      const pattern = storePatterns.get(key);
      pattern.count++;
      pattern.transactions.push(tx);
    }
    
    // Track MCC mappings
    if (tx.mcc) {
      if (!mccMappings.has(tx.mcc)) {
        mccMappings.set(tx.mcc, { count: 0, transactions: [] });
      }
      const mcc = mccMappings.get(tx.mcc);
      mcc.count++;
      mcc.transactions.push(tx);
    }
    
    // Track merchant ID mappings
    if (tx.merchant_id) {
      if (!merchantIdMappings.has(tx.merchant_id)) {
        merchantIdMappings.set(tx.merchant_id, { count: 0, transactions: [] });
      }
      const merchantId = merchantIdMappings.get(tx.merchant_id);
      merchantId.count++;
      merchantId.transactions.push(tx);
    }
  }
  
  return {
    tokenFrequency,
    merchantFrequency,
    storePatterns,
    mccMappings,
    merchantIdMappings
  };
}

/**
 * Generate frequency-based rules from analysis
 * @param {Object} analysis - Analysis results from analyzeTransactionPatterns
 * @returns {Array} - Array of proposed rules
 */
export function generateFrequencyBasedRules(analysis) {
  const rules = [];
  
  console.log(`Analyzing ${analysis.tokenFrequency.size} tokens for frequency-based rules...`);
  
  // Generate token-based rules
  for (const [token, data] of analysis.tokenFrequency) {
    if (data.count >= CONFIG.MIN_FREQUENCY) {
      const totalCount = data.count;
      const category = determineRuleCategory(token, 'contains', data.transactions);
      
      console.log(`Generated frequency rule: "${token}" -> ${category} (${totalCount} occurrences)`);
      rules.push({
        id: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'contains',
        pattern: token,
        category,
        frequency: totalCount,
        applied: false,
        enabled: true,
        explain: `Auto-generated: "${token}" appears ${totalCount} times, categorized as ${category}`,
        source: 'frequency_analysis'
      });
    }
  }
  
  // Generate store pattern rules
  for (const [brand, data] of analysis.storePatterns) {
    if (data.count >= CONFIG.MIN_FREQUENCY) {
      const totalCount = data.count;
      const category = determineRuleCategory(brand, 'regex', data.transactions);
      
      rules.push({
        id: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'regex',
        pattern: data.pattern,
        category,
        frequency: totalCount,
        explain: `Auto-generated: ${brand} store pattern appears ${totalCount} times, categorized as ${category}`,
        source: 'store_pattern',
        applied: false
      });
    }
  }
  
  return rules;
}

/**
 * Generate MCC-based rules
 * @param {Object} analysis - Analysis results
 * @returns {Array} - Array of proposed rules
 */
export function generateMCCRules(analysis) {
  const rules = [];
  
  for (const [mcc, data] of analysis.mccMappings) {
    if (data.count >= CONFIG.MIN_FREQUENCY) {
      const totalCount = data.count;
      const category = determineRuleCategory(mcc, 'mcc', data.transactions);
      
      rules.push({
        id: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'mcc',
        pattern: mcc,
        category,
        frequency: totalCount,
        explain: `Auto-generated: MCC ${mcc} appears ${totalCount} times, categorized as ${category}`,
        source: 'mcc_analysis',
        applied: false
      });
    }
  }
  
  return rules;
}

/**
 * Generate merchant ID-based rules
 * @param {Object} analysis - Analysis results
 * @returns {Array} - Array of proposed rules
 */
export function generateMerchantIdRules(analysis) {
  const rules = [];
  
  for (const [merchantId, data] of analysis.merchantIdMappings) {
    if (data.count >= CONFIG.MIN_FREQUENCY) {
      const totalCount = data.count;
      const category = determineRuleCategory(merchantId, 'exact', data.transactions);
      
      rules.push({
        id: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'exact',
        pattern: merchantId,
        category,
        frequency: totalCount,
        explain: `Auto-generated: Merchant ID ${merchantId} appears ${totalCount} times, categorized as ${category}`,
        source: 'merchant_id_analysis',
        applied: false
      });
    }
  }
  
  return rules;
}

/**
 * Detect recurring transactions based on periodicity and amount
 * @param {Array} transactions - Array of transactions
 * @returns {Array} - Array of recurring transaction patterns
 */
export function detectRecurringTransactions(transactions) {
  const recurring = [];
  const merchantAmounts = new Map();
  
  // Group by merchant and amount
  for (const tx of transactions) {
    const { normalized } = normalizeMerchant(tx.name);
    const amount = Math.abs(Number(tx.amount));
    const key = `${normalized}:${amount}`;
    
    if (!merchantAmounts.has(key)) {
      merchantAmounts.set(key, []);
    }
    merchantAmounts.get(key).push(tx);
  }
  
  // Analyze for periodicity
  for (const [key, txs] of merchantAmounts) {
    if (txs.length >= 3) { // Need at least 3 occurrences
      const dates = txs.map(tx => new Date(tx.date)).sort();
      const intervals = [];
      
      for (let i = 1; i < dates.length; i++) {
        const interval = dates[i] - dates[i - 1];
        intervals.push(interval);
      }
      
      // Check if intervals are consistent (within ±2 days of monthly)
      const monthlyMs = 30 * 24 * 60 * 60 * 1000;
      const consistentIntervals = intervals.filter(interval => 
        Math.abs(interval - monthlyMs) <= 2 * 24 * 60 * 60 * 1000
      );
      
      if (consistentIntervals.length >= intervals.length * 0.8) { // 80% consistency
        const [merchant, amount] = key.split(':');
        const category = determineRuleCategory(merchant, 'contains', txs);
        
        recurring.push({
          id: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'contains',
          pattern: merchant,
          merchant,
          amount: Number(amount),
          frequency: txs.length,
          category,
          explain: `Auto-detected: Recurring monthly charge of $${amount} from ${merchant}`,
          source: 'recurring_analysis'
        });
      }
    }
  }
  
  return recurring;
}

/**
 * Generate marketplace resolver rules
 * @param {Array} transactions - Array of transactions
 * @returns {Array} - Array of proposed rules
 */
export function generateMarketplaceRules(transactions) {
  const rules = [];
  const marketplacePatterns = {
    'amazon': /amzn|amazon/i,
    'paypal': /paypal|pp/i,
    'square': /square/i,
    'stripe': /stripe/i
  };
  
  const marketplaceCategories = {
    'amazon': {
      'kindle': 'fixed_costs',
      'fresh': 'fixed_costs',
      'prime': 'fixed_costs',
      'aws': 'fixed_costs'
    }
  };
  
  for (const tx of transactions) {
    const { raw, normalized } = normalizeMerchant(tx.name);
    
    for (const [marketplace, pattern] of Object.entries(marketplacePatterns)) {
      if (pattern.test(raw)) {
        const categories = marketplaceCategories[marketplace];
        if (categories) {
          for (const [keyword, category] of Object.entries(categories)) {
            if (normalized.includes(keyword)) {
              rules.push({
                id: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'contains',
                pattern: keyword,
                category,
                frequency: 1,
                explain: `Auto-generated: ${marketplace} marketplace keyword "${keyword}" → ${category}`,
                source: 'marketplace_analysis',
                applied: false
              });
            }
          }
        }
      }
    }
  }
  
  return rules;
}

/**
 * Generate negative/exception rules to reduce collisions
 * @param {Array} rules - Array of proposed rules
 * @returns {Array} - Array of exception rules
 */
export function generateExceptionRules(rules) {
  const exceptions = [];
  const conflictingPatterns = new Map();
  
  // Find patterns that could conflict
  for (const rule of rules) {
    if (rule.type === 'contains') {
      const pattern = rule.pattern.toLowerCase();
      if (!conflictingPatterns.has(pattern)) {
        conflictingPatterns.set(pattern, []);
      }
      conflictingPatterns.get(pattern).push(rule);
    }
  }
  
  // Generate exceptions for conflicting patterns
  for (const [pattern, conflictingRules] of conflictingPatterns) {
    if (conflictingRules.length > 1) {
      const categories = conflictingRules.map(r => r.category);
      const uniqueCategories = [...new Set(categories)];
      
      if (uniqueCategories.length > 1) {
        // Create exception rules with higher priority
        for (const rule of conflictingRules) {
          exceptions.push({
            ...rule,
            type: 'exception',
            priority: 2000, // Higher than normal rules
            explain: `Auto-generated exception: ${rule.explain} (conflict resolution)`,
            source: 'exception_analysis'
          });
        }
      }
    }
  }
  
  return exceptions;
}

/**
 * Calculate priority scores for rules based on specificity and support
 * @param {Array} rules - Array of rules
 * @returns {Array} - Rules with priority scores
 */
export function calculateRulePriorities(rules) {
  return rules.map(rule => {
    let priority = 0;
    
    // Base priority (all rules start with same base)
    priority += 50;
    
    // Specificity bonus (exact > regex > contains)
    switch (rule.type) {
      case 'exact':
        priority += 50;
        break;
      case 'regex':
        priority += 30;
        break;
      case 'contains':
        priority += 10;
        break;
      case 'mcc':
        priority += 40; // MCC is very specific
        break;
    }
    
    // Support bonus (more transactions = higher priority, but with diminishing returns)
    const supportBonus = Math.min(rule.frequency * 2, 20);
    priority += supportBonus;
    
    // Source bonus (some sources are more reliable)
    switch (rule.source) {
      case 'mcc_analysis':
        priority += 25;
        break;
      case 'merchant_id_analysis':
        priority += 20;
        break;
      case 'store_pattern':
        priority += 15;
        break;
      case 'recurring_analysis':
        priority += 10;
        break;
      case 'marketplace_analysis':
        priority += 5;
        break;
    }
    
    // User-created rules get highest priority
    if (rule.source === 'user_created') {
      priority += 100; // User-created rules always win
    }
    
    return {
      ...rule,
      priority: Math.round(priority),
      support: rule.frequency
    };
  });
}

/**
 * Resolve rule conflicts to ensure each transaction only matches one rule
 * @param {Array} rules - Array of rules sorted by priority
 * @param {Array} transactions - Array of transactions
 * @returns {Array} - Rules with conflict resolution applied
 */
export function resolveRuleConflicts(rules, transactions) {
  const resolvedRules = [];
  const coveredTransactions = new Set();
  
  for (const rule of rules) {
    // Find transactions that would match this rule
    const matchingTransactions = [];
    
    for (const tx of transactions) {
      if (coveredTransactions.has(tx.hash)) continue; // Already covered by higher priority rule
      
      const { normalized } = normalizeMerchant(tx.name);
      let matches = false;
      
      switch (rule.type) {
        case 'contains':
          matches = normalized.includes(rule.pattern.toLowerCase());
          break;
        case 'regex':
          try {
            matches = new RegExp(rule.pattern, 'i').test(normalized);
          } catch (e) {
            matches = false;
          }
          break;
        case 'exact':
          matches = normalized === rule.pattern.toLowerCase();
          break;
        case 'mcc':
          matches = tx.mcc === rule.pattern;
          break;
      }
      
      if (matches) {
        matchingTransactions.push(tx);
      }
    }
    
    // Only keep rules that have at least one uncovered transaction
    if (matchingTransactions.length > 0) {
      // Mark these transactions as covered
      matchingTransactions.forEach(tx => coveredTransactions.add(tx.hash));
      
      // Update rule with actual coverage
      const updatedRule = {
        ...rule,
        actualMatches: matchingTransactions.length,
        coverage: matchingTransactions.length / transactions.length
      };
      
      resolvedRules.push(updatedRule);
    }
  }
  
  return resolvedRules;
}

/**
 * Main function to generate auto rules from transactions
 * @param {Array} transactions - Array of transactions
 * @returns {Object} - Generated rules and analysis
 */
export function generateAutoRules(transactions) {
  if (!transactions || transactions.length === 0) {
    console.log('No transactions provided for auto rule generation');
    return { rules: [], analysis: null };
  }
  
  console.log(`Generating auto rules from ${transactions.length} transactions...`);
  console.log('Sample transactions:', transactions.slice(0, 3).map(t => ({ name: t.name, category: t.category })));
  
  // Analyze transaction patterns
  const analysis = analyzeTransactionPatterns(transactions);
  
  // Generate different types of rules
  const frequencyRules = generateFrequencyBasedRules(analysis);
  const mccRules = generateMCCRules(analysis);
  const merchantIdRules = generateMerchantIdRules(analysis);
  const recurringRules = detectRecurringTransactions(transactions);
  const marketplaceRules = generateMarketplaceRules(transactions);
  
  // Combine all rules
  let allRules = [
    ...frequencyRules,
    ...mccRules,
    ...merchantIdRules,
    ...recurringRules,
    ...marketplaceRules
  ];
  
  // Generate exception rules
  const exceptionRules = generateExceptionRules(allRules);
  allRules = [...allRules, ...exceptionRules];
  
  // Calculate priority scores and sort by priority
  allRules = calculateRulePriorities(allRules);
  
  // Sort by priority (highest first)
  allRules.sort((a, b) => b.priority - a.priority);
  
  // Resolve conflicts to ensure each transaction only matches one rule
  allRules = resolveRuleConflicts(allRules, transactions);
  
  // Limit number of rules
  allRules = allRules.slice(0, CONFIG.MAX_RULES_PER_IMPORT);
  
  console.log(`Generated ${allRules.length} auto rules`);
  console.log('Rule breakdown:', {
    frequencyRules: frequencyRules.length,
    mccRules: mccRules.length,
    merchantIdRules: merchantIdRules.length,
    recurringRules: recurringRules.length,
    marketplaceRules: marketplaceRules.length,
    exceptionRules: exceptionRules.length
  });
  
  if (allRules.length > 0) {
    console.log('Sample generated rules (with priorities):', allRules.slice(0, 5).map(r => ({ 
      type: r.type, 
      pattern: r.pattern, 
      category: r.category, 
      priority: r.priority,
      actualMatches: r.actualMatches || r.frequency,
      coverage: r.coverage ? Math.round(r.coverage * 100) + '%' : 'N/A'
    })));
  }
  
  return {
    rules: allRules,
    analysis,
    stats: {
      totalTransactions: transactions.length,
      rulesGenerated: allRules.length,
      frequencyRules: frequencyRules.length,
      mccRules: mccRules.length,
      merchantIdRules: merchantIdRules.length,
      recurringRules: recurringRules.length,
      marketplaceRules: marketplaceRules.length,
      exceptionRules: exceptionRules.length
    }
  };
}

/**
 * Preview the impact of auto-generated rules with priority-based conflict resolution
 * @param {Array} rules - Array of proposed rules (should be sorted by priority)
 * @param {Array} transactions - Array of transactions to test against
 * @returns {Array} - Array of rule impact previews
 */
export function previewRuleImpact(rules, transactions) {
  const previews = [];
  const coveredTransactions = new Set();
  
  for (const rule of rules) {
    const matches = [];
    let totalMatches = 0;
    let categoryMatches = 0;
    
    for (const tx of transactions) {
      // Skip if already covered by higher priority rule
      if (coveredTransactions.has(tx.hash)) continue;
      
      const { normalized } = normalizeMerchant(tx.name);
      let matchesRule = false;
      
      switch (rule.type) {
        case 'contains':
          matchesRule = normalized.includes(rule.pattern.toLowerCase());
          break;
        case 'regex':
          try {
            matchesRule = new RegExp(rule.pattern, 'i').test(normalized);
          } catch (e) {
            matchesRule = false;
          }
          break;
        case 'exact':
          matchesRule = normalized === rule.pattern.toLowerCase();
          break;
        case 'mcc':
          matchesRule = tx.mcc === rule.pattern;
          break;
      }
      
      if (matchesRule) {
        totalMatches++;
        coveredTransactions.add(tx.hash); // Mark as covered
        if (tx.category === rule.category) {
          categoryMatches++;
        }
        matches.push({
          id: tx.id,
          name: tx.name,
          amount: tx.amount,
          date: tx.date,
          currentCategory: tx.category,
          newCategory: rule.category,
          wouldChange: tx.category !== rule.category
        });
      }
    }
    
    previews.push({
      rule,
      totalMatches,
      categoryMatches,
      accuracy: totalMatches > 0 ? categoryMatches / totalMatches : 0,
      matches: matches.slice(0, 10) // Limit preview to first 10 matches
    });
  }
  
  return previews;
}
