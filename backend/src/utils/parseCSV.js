
import { parse } from 'csv-parse/sync';

/**
 * Expected CSV columns (flexible): date, name, description, amount, inflow, external_id
 * - date: YYYY-MM-DD or DD/MM/YYYY etc. (we try to normalize but keep it simple here)
 * - amount: positive = expense, negative = income (or vice versa); set inflow accordingly if not provided
 */
export function parseTransactionsCSV(buffer) {
  const text = buffer.toString('utf8');
  const rows = parse(text, { columns: true, skip_empty_lines: true, trim: true });
  return rows.map(r => {
    const date = normalizeDate(r.date || r.Date || r.transaction_date || r.posted);
    const name = (r.name || r.merchant || r.payee || r.description || '').toString().trim();
    const description = (r.description || r.memo || '').toString().trim();
    const amount = Number(r.amount || r.debit || r.credit || 0);
    let inflow = r.inflow !== undefined ? (String(r.inflow).toLowerCase() in {'1':1,'true':1,'yes':1}) : (amount < 0 ? 1 : 0);
    const external_id = (r.external_id || r.id || '').toString().trim() || null;
    return { date, name, description, amount, inflow, external_id };
  });
}

function normalizeDate(s) {
  if (!s) return new Date().toISOString().slice(0,10);
  // if DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d,m,y] = s.split('/');
    return `${y}-${m}-${d}`;
  }
  // if MM/DD/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [m,d,y] = s.split('/');
    return `${y}-${m}-${d}`;
  }
  // assume ISO or something close
  return s.slice(0,10);
}
