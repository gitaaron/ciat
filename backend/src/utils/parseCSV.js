
import { parse } from 'csv-parse/sync';

/**
 * Expected CSV columns (flexible): date, name, description, amount, inflow, external_id
 * - date: YYYY-MM-DD or DD/MM/YYYY etc. (we try to normalize but keep it simple here)
 * - amount: positive = expense, negative = income (or vice versa); set inflow accordingly if not provided
 * Supports both comma-delimited and tab-delimited files
 */
export function parseTransactionsCSV(buffer) {
  const text = buffer.toString('utf8');
  
  // Detect delimiter by checking which appears more frequently in the first few lines
  const delimiter = detectDelimiter(text);
  
  const rows = parse(text, { 
    columns: true, 
    skip_empty_lines: true, 
    trim: true,
    delimiter: delimiter
  });
  
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

/**
 * Detect the delimiter used in the CSV file
 * Checks for comma, tab, semicolon, and pipe delimiters
 */
function detectDelimiter(text) {
  const lines = text.split('\n').slice(0, 5); // Check first 5 lines
  const delimiters = [',', '\t', ';', '|'];
  const counts = {};
  
  for (const delimiter of delimiters) {
    counts[delimiter] = 0;
    for (const line of lines) {
      if (line.trim()) {
        counts[delimiter] += (line.match(new RegExp('\\' + delimiter, 'g')) || []).length;
      }
    }
  }
  
  // Return the delimiter with the highest count, defaulting to comma
  const bestDelimiter = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
  return bestDelimiter === '\t' ? '\t' : bestDelimiter;
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
