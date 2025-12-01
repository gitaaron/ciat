
import { db } from './db.js';
import { parseLabels } from '../../common/src/ruleMatcher.js';
import { loadUserRules, saveUserRules } from './utils/userRules.js';
import { loadAutogenRules, saveAutogenRules } from './utils/autogenRules.js';

export const Accounts = {
  all() {
    const accounts = db.prepare('SELECT * FROM accounts ORDER BY name').all();
    // Parse field_mapping JSON for each account
    return accounts.map(account => ({
      ...account,
      field_mapping: account.field_mapping ? JSON.parse(account.field_mapping) : null
    }));
  },
  create(name, type = null) {
    return db.prepare('INSERT INTO accounts (name, type) VALUES (?, ?)').run(name, type);
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
  update(id, name, type = null) {
    return db.prepare('UPDATE accounts SET name = ?, type = ? WHERE id = ?').run(name, type, id);
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
        category, category_source, category_explain, labels, note, hash
      ) VALUES (@external_id, @account_id, @date, @name, @description, @amount, @inflow,
        @category, @category_source, @category_explain, @labels, @note, @hash)
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
      SET category=?, category_explain=?, category_source=?, labels=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(category, explain, source, labelsJson, id);
  },
  async previewRuleImpact({ category, match_type, pattern }) {
    // Get all transactions that would be affected by this rule
    // Manual overrides are now stored in flat file and checked during rule application
    // Use LEFT JOIN to handle cases where there might be no accounts
    const allTransactions = db.prepare(`
      SELECT t.*, COALESCE(a.name, 'Unknown Account') as account_name 
      FROM transactions t 
      LEFT JOIN accounts a ON a.id=t.account_id 
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
 * Ensures 'enabled' is always a boolean (defaults to true)
 * Ensures labels and exceptions are arrays
 * @param {Object} rule - Rule object from file or elsewhere
 * @returns {Object} - Normalized rule object
 */
function normalizeRule(rule) {
  if (!rule) return null;
  
  // Ensure enabled is a boolean, defaulting to true if missing
  let enabled = rule.enabled;
  if (enabled === undefined || enabled === null) {
    enabled = true; // Default to enabled
  } else if (typeof enabled === 'number') {
    enabled = enabled !== 0; // Convert 0/1 to boolean (for backward compatibility)
  } else if (typeof enabled !== 'boolean') {
    enabled = true; // Fallback: treat any non-boolean as enabled
  }
  
  // Ensure labels is an array (already arrays in JSON file, but handle edge cases)
  let labels = rule.labels;
  if (labels === undefined || labels === null) {
    labels = [];
  } else if (typeof labels === 'string') {
    // Handle legacy JSON string format
    labels = parseLabels(labels);
  } else if (!Array.isArray(labels)) {
    labels = [];
  }
  
  // Ensure exceptions is an array or null (already arrays in JSON file, but handle edge cases)
  let exceptions = rule.exceptions;
  if (exceptions === undefined || exceptions === null) {
    exceptions = null;
  } else if (typeof exceptions === 'string') {
    // Handle legacy JSON string format
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
    const rules = loadUserRules();
    // Sort by priority DESC, then created_at DESC
    const sorted = rules.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return bTime - aTime;
    });
    return normalizeRules(sorted);
  },
  findById(id) {
    const rules = loadUserRules();
    const rule = rules.find(r => r.id === id);
    return normalizeRule(rule);
  },
  findByCategory(category) {
    const rules = loadUserRules();
    const filtered = rules.filter(r => r.category === category);
    // Sort by priority DESC
    filtered.sort((a, b) => b.priority - a.priority);
    return normalizeRules(filtered);
  },
  findEnabled() {
    const rules = loadUserRules();
    const enabled = rules.filter(r => {
      const enabledValue = r.enabled;
      // Handle boolean, number (0/1), or undefined
      if (enabledValue === undefined || enabledValue === null) return true;
      if (typeof enabledValue === 'number') return enabledValue !== 0;
      return enabledValue === true;
    });
    // Sort by priority DESC, then created_at DESC
    enabled.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return bTime - aTime;
    });
    return normalizeRules(enabled);
  },
  create(rule) {
    const rules = loadUserRules();
    
    // Ensure rule has required fields
    const newRule = {
      id: rule.id,
      match_type: rule.match_type,
      pattern: rule.pattern,
      category: rule.category,
      priority: rule.priority || 1000,
      support: rule.support || 0,
      exceptions: rule.exceptions || null,
      enabled: rule.enabled !== undefined ? rule.enabled : true,
      explain: rule.explain || '',
      labels: rule.labels || [],
      created_at: rule.created_at || new Date().toISOString(),
      updated_at: rule.updated_at || new Date().toISOString()
    };
    
    // Add optional fields if provided
    if (rule.account_id !== undefined && rule.account_id !== null) {
      newRule.account_id = rule.account_id;
    }
    if (rule.start_date !== undefined && rule.start_date !== null) {
      newRule.start_date = rule.start_date;
    }
    if (rule.end_date !== undefined && rule.end_date !== null) {
      newRule.end_date = rule.end_date;
    }
    if (rule.min_amount !== undefined && rule.min_amount !== null) {
      newRule.min_amount = rule.min_amount;
    }
    if (rule.max_amount !== undefined && rule.max_amount !== null) {
      newRule.max_amount = rule.max_amount;
    }
    if (rule.inflow_only !== undefined && rule.inflow_only !== null) {
      newRule.inflow_only = rule.inflow_only;
    }
    if (rule.outflow_only !== undefined && rule.outflow_only !== null) {
      newRule.outflow_only = rule.outflow_only;
    }
    
    rules.push(newRule);
    saveUserRules(rules);
    
    // Return a result object similar to database run() result
    return {
      lastInsertRowid: rules.length - 1,
      changes: 1
    };
  },
  update(id, rule) {
    const rules = loadUserRules();
    const index = rules.findIndex(r => r.id === id);
    
    if (index === -1) {
      return { changes: 0 };
    }
    
    // Update the rule
    const updatedRule = {
      ...rules[index],
      ...rule,
      id: id, // Ensure ID doesn't change
      updated_at: new Date().toISOString()
    };
    
    rules[index] = updatedRule;
    saveUserRules(rules);
    
    return { changes: 1 };
  },
  delete(id) {
    const rules = loadUserRules();
    const initialLength = rules.length;
    const filtered = rules.filter(r => r.id !== id);
    
    if (filtered.length === initialLength) {
      return { changes: 0 };
    }
    
    saveUserRules(filtered);
    return { changes: 1 };
  },
  updateSupport(id, support) {
    const rules = loadUserRules();
    const index = rules.findIndex(r => r.id === id);
    
    if (index === -1) {
      return { changes: 0 };
    }
    
    rules[index].support = support;
    rules[index].updated_at = new Date().toISOString();
    saveUserRules(rules);
    
    return { changes: 1 };
  },
  getNextPriority() {
    const rules = loadUserRules();
    if (rules.length === 0) return 1000;
    const maxPriority = Math.max(...rules.map(r => r.priority || 0));
    return maxPriority + 1;
  }
};

export const BucketListItems = {
  all() {
    return db.prepare('SELECT * FROM bucket_list_items ORDER BY `order` ASC, created_at ASC').all();
  },
  findById(id) {
    return db.prepare('SELECT * FROM bucket_list_items WHERE id = ?').get(id);
  },
  create(item) {
    const id = item.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = item.created_at || new Date().toISOString();
    // Get the max order value and add 1 for new item
    const maxOrderResult = db.prepare('SELECT MAX(`order`) as max_order FROM bucket_list_items').get();
    const newOrder = (maxOrderResult?.max_order ?? -1) + 1;
    const result = db.prepare(`
      INSERT INTO bucket_list_items (id, name, description, estimated_cost, created_at, updated_at, \`order\`)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      item.name,
      item.description || null,
      item.estimated_cost || null,
      createdAt,
      createdAt,
      newOrder
    );
    return { id, changes: result.changes };
  },
  update(id, item) {
    const result = db.prepare(`
      UPDATE bucket_list_items
      SET name = ?, description = ?, estimated_cost = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      item.name,
      item.description || null,
      item.estimated_cost || null,
      id
    );
    return { changes: result.changes };
  },
  updateOrder(id, order) {
    const result = db.prepare(`
      UPDATE bucket_list_items
      SET \`order\` = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(order, id);
    return { changes: result.changes };
  },
  reorder(orderedIds) {
    const updateStmt = db.prepare(`
      UPDATE bucket_list_items
      SET \`order\` = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const updateMany = db.transaction((ids) => {
      ids.forEach((id, index) => {
        updateStmt.run(index, id);
      });
    });
    updateMany(orderedIds);
    return { ok: true };
  },
  delete(id) {
    const result = db.prepare('DELETE FROM bucket_list_items WHERE id = ?').run(id);
    return { changes: result.changes };
  }
};

export const AutogenRules = {
  all() {
    const rules = loadAutogenRules();
    // Sort by priority DESC, then created_at DESC
    const sorted = rules.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return bTime - aTime;
    });
    return normalizeRules(sorted);
  },
  findById(id) {
    const rules = loadAutogenRules();
    const rule = rules.find(r => r.id === id);
    return normalizeRule(rule);
  },
  findByCategory(category) {
    const rules = loadAutogenRules();
    const filtered = rules.filter(r => r.category === category);
    // Sort by priority DESC
    filtered.sort((a, b) => b.priority - a.priority);
    return normalizeRules(filtered);
  },
  findEnabled() {
    const rules = loadAutogenRules();
    const enabled = rules.filter(r => {
      const enabledValue = r.enabled;
      // Handle boolean, number (0/1), or undefined
      if (enabledValue === undefined || enabledValue === null) return true;
      if (typeof enabledValue === 'number') return enabledValue !== 0;
      return enabledValue === true;
    });
    // Sort by priority DESC, then created_at DESC
    enabled.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return bTime - aTime;
    });
    return normalizeRules(enabled);
  },
  create(rule) {
    const rules = loadAutogenRules();
    
    // Ensure rule has required fields
    const newRule = {
      id: rule.id,
      match_type: rule.match_type,
      pattern: rule.pattern,
      category: rule.category,
      priority: rule.priority || 1000,
      support: rule.support || 0,
      exceptions: rule.exceptions || null,
      enabled: rule.enabled !== undefined ? rule.enabled : true,
      explain: rule.explain || '',
      labels: rule.labels || [],
      created_at: rule.created_at || new Date().toISOString(),
      updated_at: rule.updated_at || new Date().toISOString()
    };
    
    rules.push(newRule);
    saveAutogenRules(rules);
    
    // Return a result object similar to database run() result
    return {
      lastInsertRowid: rules.length - 1,
      changes: 1
    };
  },
  update(id, rule) {
    const rules = loadAutogenRules();
    const index = rules.findIndex(r => r.id === id);
    
    if (index === -1) {
      return { changes: 0 };
    }
    
    // Update the rule
    const updatedRule = {
      ...rules[index],
      ...rule,
      id: id, // Ensure ID doesn't change
      updated_at: new Date().toISOString()
    };
    
    rules[index] = updatedRule;
    saveAutogenRules(rules);
    
    return { changes: 1 };
  },
  delete(id) {
    const rules = loadAutogenRules();
    const initialLength = rules.length;
    const filtered = rules.filter(r => r.id !== id);
    
    if (filtered.length === initialLength) {
      return { changes: 0 };
    }
    
    saveAutogenRules(filtered);
    return { changes: 1 };
  },
  updateSupport(id, support) {
    const rules = loadAutogenRules();
    const index = rules.findIndex(r => r.id === id);
    
    if (index === -1) {
      return { changes: 0 };
    }
    
    rules[index].support = support;
    rules[index].updated_at = new Date().toISOString();
    saveAutogenRules(rules);
    
    return { changes: 1 };
  },
  getNextPriority() {
    const rules = loadAutogenRules();
    if (rules.length === 0) return 1000;
    const maxPriority = Math.max(...rules.map(r => r.priority || 0));
    return maxPriority + 1;
  }
};
