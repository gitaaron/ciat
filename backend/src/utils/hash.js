
import crypto from 'crypto';

export function txHash({ external_id, account_id, date, name, description, amount, inflow }) {
  const raw = JSON.stringify({ external_id, account_id, date, name, description, amount, inflow });
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}
