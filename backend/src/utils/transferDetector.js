
/**
 * Enhanced transfer detector: pairs opposite-signed amounts between accounts within a date window.
 * Also detects transfers based on common transfer patterns in transaction names.
 * Returns a Set of hashes to ignore.
 */
export function detectTransfers(rows) {
  // rows: [{account_id, amount, date, name, description, ...}]
  const byKey = new Map(); // key: date:abs(amount)
  const ignore = new Set();

  // First pass: detect by amount and date matching
  for (const r of rows) {
    const key = `${r.date}:${Math.abs(Number(r.amount)).toFixed(2)}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(r);
  }
  
  for (const [key, list] of byKey) {
    if (list.length < 2) continue;
    // Check if there are opposite signs from different accounts
    const hasOpposite = list.some(a => list.some(b => 
      a.account_id !== b.account_id && 
      Math.sign(a.amount) !== Math.sign(b.amount)
    ));
    if (hasOpposite) {
      for (const r of list) if (r.hash) ignore.add(r.hash);
    }
  }

  // Second pass: detect by transfer keywords in transaction names
  const transferKeywords = [
    'transfer', 'xfer', 'move', 'payment', 'pay', 'credit card payment',
    'cc payment', 'card payment', 'balance transfer', 'account transfer',
    'online transfer', 'bill payment', 'autopay', 'auto pay'
  ];

  for (const r of rows) {
    if (ignore.has(r.hash)) continue; // Already marked as transfer
    
    const name = (r.name || '').toLowerCase();
    const description = (r.description || '').toLowerCase();
    const combined = `${name} ${description}`;
    
    // Check for transfer keywords
    const hasTransferKeyword = transferKeywords.some(keyword => 
      combined.includes(keyword)
    );
    
    // Check for common transfer patterns
    const hasTransferPattern = 
      /transfer.*to|from.*account|payment.*card|card.*payment/i.test(combined) ||
      /online.*transfer|bill.*payment|autopay/i.test(combined);
    
    if (hasTransferKeyword || hasTransferPattern) {
      ignore.add(r.hash);
    }
  }

  return ignore;
}
