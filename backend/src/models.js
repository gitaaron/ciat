
import { db } from './db.js';

export const Accounts = {
  all() {
    return db.prepare('SELECT * FROM accounts ORDER BY name').all();
  },
  create(name) {
    return db.prepare('INSERT INTO accounts (name) VALUES (?)').run(name);
  },
  findByName(name) {
    return db.prepare('SELECT * FROM accounts WHERE name = ?').get(name);
  },
  findById(id) {
    return db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  },
  update(id, name) {
    return db.prepare('UPDATE accounts SET name = ? WHERE id = ?').run(name, id);
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
      sql += ` AND (t.name LIKE @q OR t.description LIKE @q OR t.note LIKE @q)`;
      params.q = `%${q}%`;
    }
    if (category) { sql += ` AND t.category=@category`; params.category = category; }
    if (label) { 
      // Search for label in JSON array
      sql += ` AND (t.labels LIKE @label OR t.labels LIKE @labelStart OR t.labels LIKE @labelEnd OR t.labels LIKE @labelMiddle)`;
      params.label = `"${label}"`;
      params.labelStart = `"${label}",`;
      params.labelEnd = `,"${label}"`;
      params.labelMiddle = `,"${label}",`;
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
    // Use LEFT JOIN to handle cases where there might be no accounts
    const allTransactions = db.prepare(`
      SELECT t.*, COALESCE(a.name, 'Unknown Account') as account_name 
      FROM transactions t 
      LEFT JOIN accounts a ON a.id=t.account_id 
      ORDER BY t.date DESC
    `).all();
    
    const affected = [];
    // Import the same normalization function used by the categorizer
    const { normalizeMerchant } = await import('./categorizer/autoRuleGenerator.js');
    const normalizedPattern = normalizeMerchant(pattern).normalized;
    
    for (const tx of allTransactions) {
      const merchant = normalizeMerchant(tx.name || '').normalized;
      const description = normalizeMerchant(tx.description || '').normalized;
      let matches = false;
      
      switch (match_type) {
        case 'exact':
          matches = merchant === normalizedPattern || description === normalizedPattern;
          break;
        case 'contains':
          matches = merchant.includes(normalizedPattern) || description.includes(normalizedPattern);
          break;
        case 'regex':
          try {
            const regex = new RegExp(pattern, 'i');
            matches = regex.test(merchant) || regex.test(description);
          } catch (e) {
            // Invalid regex
            matches = false;
          }
          break;
      }
      
      if (matches) {
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

export const Rules = {
  all() {
    return db.prepare('SELECT * FROM rules ORDER BY priority DESC, created_at DESC').all();
  },
  findById(id) {
    return db.prepare('SELECT * FROM rules WHERE id = ?').get(id);
  },
  findByCategory(category) {
    return db.prepare('SELECT * FROM rules WHERE category = ? ORDER BY priority DESC').all(category);
  },
  findEnabled() {
    return db.prepare('SELECT * FROM rules WHERE enabled = 1 ORDER BY priority DESC, created_at DESC').all();
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
