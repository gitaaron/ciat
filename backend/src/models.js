
import { db } from './db.js';
import { parseLabels } from '../../common/src/ruleMatcher.js';

export const Accounts = {
  all() {
    const accounts = db.prepare('SELECT * FROM accounts ORDER BY name').all();
    // Parse field_mapping JSON for each account
    return accounts.map(account => ({
      ...account,
      field_mapping: account.field_mapping ? JSON.parse(account.field_mapping) : null
    }));
  },
  create(name) {
    return db.prepare('INSERT INTO accounts (name) VALUES (?)').run(name);
  },
  findByName(name) {
    const account = db.prepare('SELECT * FROM accounts WHERE name = ?').get(name);
    if (account && account.field_mapping) {
      account.field_mapping = JSON.parse(account.field_mapping);
    }
    return account;
  },
  findById(id) {
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
    if (account && account.field_mapping) {
      account.field_mapping = JSON.parse(account.field_mapping);
    }
    return account;
  },
  update(id, name) {
    return db.prepare('UPDATE accounts SET name = ? WHERE id = ?').run(name, id);
  },
  updateFieldMapping(id, fieldMapping) {
    const mappingJson = fieldMapping ? JSON.stringify(fieldMapping) : null;
    return db.prepare('UPDATE accounts SET field_mapping = ? WHERE id = ?').run(mappingJson, id);
  },
  delete(id) {
    return db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  },
  getTransactionCount(id) {
    return db.prepare('SELECT COUNT(*) as count FROM transactions WHERE account_id = ?').get(id);
  }
};

export const Transactions = {
  upsert(tx) {
    // If hash exists, skip insert
    const found = db.prepare('SELECT id FROM transactions WHERE hash=?').get(tx.hash);
    if (found) return { skipped: true, id: found.id };
    const stmt = db.prepare(`
      INSERT INTO transactions (
        external_id, account_id, date, name, description, amount, inflow,
        category, category_source, category_explain, labels, note, hash, manual_override
      ) VALUES (@external_id, @account_id, @date, @name, @description, @amount, @inflow,
        @category, @category_source, @category_explain, @labels, @note, @hash, @manual_override)
    `);
    const info = stmt.run(tx);
    return { skipped: false, id: info.lastInsertRowid };
  },
  list({ q, category, label, start, end, sort, order, accountId }) {
    let sql = `SELECT t.*, a.name as account_name FROM transactions t JOIN accounts a ON a.id=t.account_id WHERE 1=1`;
    const params = {};
    if (q) {
      sql += ` AND (t.name LIKE @q OR t.description LIKE @q OR t.note LIKE @q OR CAST(t.amount AS TEXT) LIKE @q)`;
      params.q = `%${q}%`;
    }
    if (category) { sql += ` AND t.category=@category`; params.category = category; }
    if (label) { 
      // Search for label in JSON array (case-insensitive, contains match)
      // Use SQLite JSON functions (json_each) to properly query JSON arrays
      const labelLower = label.toLowerCase().trim();
      
      // Use json_each to iterate through the JSON array and match the label (contains, not exact)
      // Similar to how name search works with LIKE and wildcards
      sql += ` AND t.labels IS NOT NULL AND EXISTS (
        SELECT 1 FROM json_each(t.labels) 
        WHERE LOWER(json_each.value) LIKE @labelValue
      )`;
      params.labelValue = `%${labelLower}%`;
    }
    if (start) { sql += ` AND date(t.date) >= date(@start)`; params.start = start; }
    if (end) { sql += ` AND date(t.date) <= date(@end)`; params.end = end; }
    if (accountId) { sql += ` AND t.account_id=@accountId`; params.accountId = accountId; }
    const validSort = new Set(['date','amount','name']);
    const validOrder = new Set(['ASC','DESC']);
    sort = validSort.has(sort) ? sort : 'date';
    order = validOrder.has(order) ? order : 'DESC';
    sql += ` ORDER BY ${sort} ${order}`;
    return db.prepare(sql).all(params);
  },
  updateCategory(id, category, explain, source, manual, labels = null) {
    const labelsJson = labels ? JSON.stringify(labels) : null;
    return db.prepare(`
      UPDATE transactions
      SET category=?, category_explain=?, category_source=?, manual_override=?, labels=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(category, explain, source, manual ? 1 : 0, labelsJson, id);
  },
  async previewRuleImpact({ category, match_type, pattern }) {
    // Get all transactions that would be affected by this rule
    // Skip transactions with manual_override=1 (user overrides should not be affected)
    // Use LEFT JOIN to handle cases where there might be no accounts
    const allTransactions = db.prepare(`
      SELECT t.*, COALESCE(a.name, 'Unknown Account') as account_name 
      FROM transactions t 
      LEFT JOIN accounts a ON a.id=t.account_id 
      WHERE t.manual_override = 0
      ORDER BY t.date DESC
    `).all();
    
    // Import the shared matching function used by the categorizer
    const { matchesRule } = await import('../../common/src/ruleMatcher.js');
    
    // Create a rule object for matching
    const rule = {
      pattern,
      match_type,
      category
    };
    
    const affected = [];
    for (const tx of allTransactions) {
      if (matchesRule(rule, tx)) {
        affected.push({
          ...tx,
          currentCategory: tx.category,
          newCategory: category,
          wouldChange: tx.category !== category
        });
      }
    }
    
    return affected;
  }
};

/**
 * Normalize a rule object to ensure it has required properties with correct types
 * Future-proofs rule objects by ensuring 'enabled' is always a boolean (defaults to true)
 * Also handles database INTEGER to boolean conversion and parses JSON strings for labels/exceptions
 * @param {Object} rule - Rule object from database or elsewhere
 * @returns {Object} - Normalized rule object
 */
function normalizeRule(rule) {
  if (!rule) return null;
  
  // Convert database INTEGER (0/1) to boolean, defaulting to true if missing
  let enabled = rule.enabled;
  if (enabled === undefined || enabled === null) {
    enabled = true; // Default to enabled
  } else if (typeof enabled === 'number') {
    enabled = enabled !== 0; // Convert 0/1 to boolean
  } else if (typeof enabled !== 'boolean') {
    enabled = true; // Fallback: treat any non-boolean as enabled
  }
  
  // Parse labels from JSON string to array (labels are stored as JSON strings in database)
  let labels = rule.labels;
  if (labels !== undefined && labels !== null) {
    labels = parseLabels(labels);
  } else {
    labels = [];
  }
  
  // Parse exceptions from JSON string to array (exceptions are stored as JSON strings in database)
  let exceptions = rule.exceptions;
  if (exceptions !== undefined && exceptions !== null && typeof exceptions === 'string') {
    try {
      const parsed = JSON.parse(exceptions);
      exceptions = Array.isArray(parsed) ? parsed : null;
    } catch {
      exceptions = null;
    }
  } else if (!Array.isArray(exceptions)) {
    exceptions = null;
  }
  
  return {
    ...rule,
    enabled,
    labels,
    exceptions
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

export const Rules = {
  all() {
    const rules = db.prepare('SELECT * FROM rules ORDER BY priority DESC, created_at DESC').all();
    return normalizeRules(rules);
  },
  findById(id) {
    const rule = db.prepare('SELECT * FROM rules WHERE id = ?').get(id);
    return normalizeRule(rule);
  },
  findByCategory(category) {
    const rules = db.prepare('SELECT * FROM rules WHERE category = ? ORDER BY priority DESC').all(category);
    return normalizeRules(rules);
  },
  findEnabled() {
    const rules = db.prepare('SELECT * FROM rules WHERE enabled = 1 ORDER BY priority DESC, created_at DESC').all();
    return normalizeRules(rules);
  },
  create(rule) {
    const stmt = db.prepare(`
      INSERT INTO rules (
        id, match_type, pattern, category, priority, support, exceptions, 
        enabled, explain, labels, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      rule.id,
      rule.match_type,
      rule.pattern,
      rule.category,
      rule.priority || 1000,
      rule.support || 0,
      rule.exceptions ? JSON.stringify(rule.exceptions) : null,
      rule.enabled ? 1 : 0,
      rule.explain || '',
      rule.labels ? JSON.stringify(rule.labels) : null,
      rule.created_at || new Date().toISOString(),
      rule.updated_at || new Date().toISOString()
    );
  },
  update(id, rule) {
    const stmt = db.prepare(`
      UPDATE rules SET 
        match_type = ?, pattern = ?, category = ?, priority = ?, support = ?, 
        exceptions = ?, enabled = ?, explain = ?, labels = ?, updated_at = ?
      WHERE id = ?
    `);
    return stmt.run(
      rule.match_type,
      rule.pattern,
      rule.category,
      rule.priority || 1000,
      rule.support || 0,
      rule.exceptions ? JSON.stringify(rule.exceptions) : null,
      rule.enabled ? 1 : 0,
      rule.explain || '',
      rule.labels ? JSON.stringify(rule.labels) : null,
      new Date().toISOString(),
      id
    );
  },
  delete(id) {
    return db.prepare('DELETE FROM rules WHERE id = ?').run(id);
  },
  updateSupport(id, support) {
    return db.prepare('UPDATE rules SET support = ?, updated_at = ? WHERE id = ?').run(
      support, 
      new Date().toISOString(), 
      id
    );
  },
  getNextPriority() {
    const result = db.prepare('SELECT MAX(priority) as max_priority FROM rules').get();
    return (result.max_priority || 0) + 1;
  }
};
