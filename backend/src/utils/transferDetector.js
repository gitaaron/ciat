
/**
 * Simple transfer detector: pairs opposite-signed amounts between accounts within a small date window.
 * Returns a Set of hashes to ignore.
 */
export function detectTransfers(rows) {
  // rows: [{account_id, amount, date, name, ...}]
  const byKey = new Map(); // key: date:abs(amount)
  const ignore = new Set();

  for (const r of rows) {
    const key = `${r.date}:${Math.abs(Number(r.amount)).toFixed(2)}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(r);
  }
  for (const [key, list] of byKey) {
    if (list.length < 2) continue;
    // naive: if there exists opposite signs from different accounts, mark all as transfers
    const hasOpposite = list.some(a => list.some(b => a.account_id !== b.account_id && Math.sign(a.amount) !== Math.sign(b.amount)));
    if (hasOpposite) {
      for (const r of list) if (r.hash) ignore.add(r.hash);
    }
  }
  return ignore;
}
