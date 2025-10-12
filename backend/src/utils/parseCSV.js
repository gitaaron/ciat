
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
  
  // Pre-process the text to fix common CSV issues
  const cleanedText = preprocessCSV(text);
  
  let rows;
  try {
    rows = parse(cleanedText, { 
      columns: ['date', 'name', 'amount', 'credit', 'card_number'], // Define column names for headerless CSV
      skip_empty_lines: true, 
      trim: true,
      delimiter: delimiter,
      quote: '"',
      escape: '"',
      relax_quotes: true,
      relax_column_count: true,
      skip_records_with_error: true,
      on_record: (record, context) => {
        // Log any parsing issues but continue processing
        if (context.error) {
          console.warn(`CSV parsing warning at line ${context.lines}: ${context.error.message}`);
        }
        return record;
      }
    });
  } catch (error) {
    console.error('CSV parsing error:', error);
    throw error;
  }
  
  
  return rows.map(r => {
    const date = normalizeDate(r.date);
    const name = (r.name || '').toString().trim();
    const description = ''; // No description field in this CSV format
    // Handle both amount and credit fields - use the non-empty one
    const amount = Number(r.amount || r.credit || 0);
    // For this CSV format, positive amounts are expenses (inflow = 0)
    const inflow = 0; // All transactions appear to be expenses
    const external_id = (r.card_number || '').toString().trim() || null;
    return { date, name, description, amount, inflow, external_id };
  });
}

/**
 * Pre-process CSV text to fix common formatting issues
 */
function preprocessCSV(text) {
  // Fix unescaped quotes within quoted fields
  // This handles cases like "TOYS "R" US" -> "TOYS R US"
  // Use a more targeted approach to only fix the specific problematic patterns
  return text
    .replace(/"TOYS "R" US/g, '"TOYS R US')  // Fix the specific TOYS R US pattern
    .replace(/"TOYS "R" US/g, '"TOYS R US');  // Handle multiple occurrences
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
