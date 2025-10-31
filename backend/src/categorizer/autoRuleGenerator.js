import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeMerchant, matchesRule } from '../../../common/src/ruleMatcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Normalize a rule object to ensure it has required properties
 * Future-proofs rule objects by ensuring 'enabled' is always a boolean (defaults to true)
 * @param {Object} rule - Rule object
 * @returns {Object} - Normalized rule object with enabled: true if missing
 */
function normalizeRule(rule) {
  if (!rule) return null;
  
  // Always ensure enabled is a boolean, defaulting to true if missing or invalid
  let enabled = true; // Default to true
  if (rule.enabled !== undefined && rule.enabled !== null) {
    if (typeof rule.enabled === 'boolean') {
      enabled = rule.enabled;
    } else if (typeof rule.enabled === 'number') {
      enabled = rule.enabled !== 0; // Convert 0/1 to boolean
    } else if (typeof rule.enabled === 'string') {
      // Handle string representations
      enabled = rule.enabled.toLowerCase() === 'true' || rule.enabled === '1';
    }
    // For any other type, keep default (true)
  }
  
  return {
    ...rule,
    enabled // Always explicitly set
  };
}

/**
 * Normalize an array of rules
 * @param {Array} rules - Array of rule objects
 * @returns {Array} - Array of normalized rule objects
 */
function normalizeRules(rules) {
  if (!Array.isArray(rules)) return [];
  return rules.map(normalizeRule).filter(r => r !== null);
}

// Configuration for auto rule generation
const CONFIG = {
  MIN_FREQUENCY: 2, // Lowered for testing
  MIN_CLUSTER_SIMILARITY: 0.85,
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
  
  // 1. Frequency-based rules - categorize based on type of spending
  if (ruleType === 'contains' || ruleType === 'regex') {
    // Essential food/groceries keywords (fixed costs)
    const essentialFoodKeywords = [
      'grocery', 'supermarket', 'food', 'fresh', 'market', 'produce',
      'meat', 'dairy', 'bakery', 'deli', 'organic', 'whole foods',
      'safeway', 'kroger', 'publix', 'wegmans', 'trader joe',
      'costco', 'walmart', 'target', 'loblaws', 'metro', 'sobeys'
    ];
    
    // Discretionary food/restaurant keywords (guilt free)
    const discretionaryFoodKeywords = [
      'restaurant', 'cafe', 'diner', 'eatery', 'kitchen', 'grill',
      'pizza', 'burger', 'sandwich', 'coffee', 'starbucks', 'tim hortons',
      'mcdonalds', 'subway', 'kfc', 'taco bell', 'wendys', 'burger king'
    ];
    
    const isEssentialFood = essentialFoodKeywords.some(keyword => 
      normalizedPattern.includes(keyword)
    );
    
    const isDiscretionaryFood = discretionaryFoodKeywords.some(keyword => 
      normalizedPattern.includes(keyword)
    );
    
    if (isEssentialFood) {
      return 'fixed_costs';
    }
    
    if (isDiscretionaryFood) {
      return 'guilt_free';
    }
    
    // Check for automotive keywords
    const automotiveKeywords = [
      'gas', 'gasoline', 'fuel', 'petro', 'esso', 'shell', 'chevron',
      'parking', 'impark', 'park', 'garage', 'auto', 'car', 'vehicle',
      'maintenance', 'repair', 'service', 'oil change', 'brake',
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
    
    // Default for frequency-based rules is guilt_free
    return 'guilt_free';
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
        match_type: 'contains',
        pattern: token,
        category,
        support: totalCount,
        applied: false,
        enabled: true,
        explain: 'auto',
        source: 'frequency_analysis',
        priority: 500, // Lower priority than user rules
        labels: []
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
        match_type: 'regex',
        pattern: data.pattern,
        category,
        support: totalCount,
        explain: 'auto',
        source: 'store_pattern',
        applied: false,
        enabled: true,
        priority: 500, // Lower priority than user rules
        labels: []
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
        explain: 'auto',
        source: 'mcc_analysis',
        applied: false,
        enabled: true
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
        match_type: 'exact',
        pattern: merchantId,
        category,
        frequency: totalCount,
        explain: 'auto',
        source: 'merchant_id_analysis',
        applied: false,
        enabled: true
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
      
      // Check if intervals are consistent (within ±10 days of monthly)
      const monthlyMs = 30 * 24 * 60 * 60 * 1000;
      const consistentIntervals = intervals.filter(interval => 
        Math.abs(interval - monthlyMs) <= 10 * 24 * 60 * 60 * 1000
      );
      
      if (consistentIntervals.length >= intervals.length * 0.8) { // 80% consistency
        const [merchant, amount] = key.split(':');
        const category = determineRuleCategory(merchant, 'contains', txs);
        
        recurring.push({
          id: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          match_type: 'contains',
          pattern: merchant,
          merchant,
          amount: Number(amount),
          frequency: txs.length,
          category,
          explain: 'auto',
          source: 'recurring_analysis',
          enabled: true
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
      'aws': 'fixed_costs',
      'channels': 'short_term_savings'
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
                match_type: 'contains',
                pattern: keyword,
                category,
                frequency: 1,
                explain: 'auto',
                source: 'marketplace_analysis',
                applied: false,
                enabled: true
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
            source: 'exception_analysis',
            enabled: true
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
  return normalizeRules(rules).map(rule => {
    let priority = 0;
    
    // Base priority (all rules start with same base)
    priority += 50;
    
    // Specificity bonus (exact > regex > contains)
    const ruleType = rule.type || rule.match_type;
    switch (ruleType) {
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
    const frequency = rule.frequency || rule.support || 0;
    const supportBonus = Math.min(frequency * 2, 20);
    priority += supportBonus;
    
    // Pattern length bonus (longer patterns get higher priority)
    if (rule.pattern) {
      const patternLength = rule.pattern.length;
      const lengthBonus = Math.min(patternLength * 2, 30); // Max 30 points for very long patterns
      priority += lengthBonus;
    }
    
    // Specificity bonus for contains rules - more specific patterns get higher priority
    if (ruleType === 'contains' && rule.pattern) {
      // Count words in pattern - more words = more specific
      const wordCount = rule.pattern.split(/\s+/).length;
      const specificityBonus = Math.min(wordCount * 5, 25); // Max 25 points for very specific patterns
      priority += specificityBonus;
    }
    
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
    
    return normalizeRule({
      ...rule,
      priority: Math.round(priority),
      support: rule.frequency || rule.support
    });
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
      
      // Use the shared matchesRule function for consistency
      if (matchesRule(rule, tx)) {
        matchingTransactions.push(tx);
      }
    }
    
    // Only keep rules that have at least one uncovered transaction
    if (matchingTransactions.length > 0) {
      // Mark these transactions as covered
      matchingTransactions.forEach(tx => coveredTransactions.add(tx.hash));
      
      // Update rule with actual coverage and normalize it
      const updatedRule = normalizeRule({
        ...rule,
        actualMatches: matchingTransactions.length,
        coverage: matchingTransactions.length / transactions.length
      });
      
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
  console.log('Generating frequency rules...');
  const frequencyRules = generateFrequencyBasedRules(analysis);
  console.log('Frequency rules generated:', frequencyRules.length);
  
  console.log('Generating MCC rules...');
  const mccRules = generateMCCRules(analysis);
  console.log('MCC rules generated:', mccRules.length);
  
  console.log('Generating merchant ID rules...');
  const merchantIdRules = generateMerchantIdRules(analysis);
  console.log('Merchant ID rules generated:', merchantIdRules.length);
  
  console.log('Detecting recurring transactions...');
  const recurringRules = detectRecurringTransactions(transactions);
  console.log('Recurring rules generated:', recurringRules.length);
  
  console.log('Generating marketplace rules...');
  const marketplaceRules = generateMarketplaceRules(transactions);
  console.log('Marketplace rules generated:', marketplaceRules.length);
  
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
  
  // Normalize all rules to ensure they have required properties (future-proofing)
  allRules = normalizeRules(allRules);
  
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
