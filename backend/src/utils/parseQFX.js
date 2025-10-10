import { parseString } from 'xml2js';

/**
 * Parse QFX (Quicken Financial Exchange) files
 * QFX files are XML-based and follow the OFX (Open Financial Exchange) specification
 * 
 * Expected QFX structure:
 * - OFX root element
 * - BANKMSGSRSV1 > STMTTRNRS > STMTRS > BANKTRANLIST > STMTTRN elements
 * - Each STMTTRN contains: DTPOSTED, TRNAMT, FITID, NAME, MEMO
 */
export function parseTransactionsQFX(buffer) {
  const text = buffer.toString('utf8');
  
  return new Promise((resolve, reject) => {
    parseString(text, { 
      explicitArray: false,
      mergeAttrs: true,
      trim: true,
      normalize: true
    }, (err, result) => {
      if (err) {
        reject(new Error(`Failed to parse QFX file: ${err.message}`));
        return;
      }
      
      try {
        const transactions = extractTransactionsFromOFX(result);
        resolve(transactions);
      } catch (parseError) {
        reject(new Error(`Failed to extract transactions from QFX: ${parseError.message}`));
      }
    });
  });
}

function extractTransactionsFromOFX(ofxData) {
  const transactions = [];
  
  // Navigate through the OFX structure to find transactions
  const bankMsgs = ofxData.OFX?.BANKMSGSRSV1;
  if (!bankMsgs) {
    throw new Error('No bank messages found in QFX file');
  }
  
  // Handle both single and multiple statement responses
  const stmtTrnRs = Array.isArray(bankMsgs.STMTTRNRS) ? bankMsgs.STMTTRNRS : [bankMsgs.STMTTRNRS];
  
  for (const stmtTrnR of stmtTrnRs) {
    const stmtRs = stmtTrnR.STMTRS;
    if (!stmtRs) continue;
    
    const bankTranList = stmtRs.BANKTRANLIST;
    if (!bankTranList) continue;
    
    // Handle both single and multiple transactions
    const stmtTrns = Array.isArray(bankTranList.STMTTRN) ? bankTranList.STMTTRN : [bankTranList.STMTTRN];
    
    for (const stmtTrn of stmtTrns) {
      if (!stmtTrn) continue;
      
      const transaction = parseTransactionFromSTMTTRN(stmtTrn);
      if (transaction) {
        transactions.push(transaction);
      }
    }
  }
  
  return transactions;
}

function parseTransactionFromSTMTTRN(stmtTrn) {
  try {
    // Parse date - OFX dates are in format YYYYMMDD or YYYYMMDDHHMMSS
    const datePosted = stmtTrn.DTPOSTED;
    const date = normalizeOFXDate(datePosted);
    
    // Parse amount - positive for credits, negative for debits
    const trnAmt = parseFloat(stmtTrn.TRNAMT || '0');
    
    // Determine if this is an inflow (credit) or outflow (debit)
    const inflow = trnAmt > 0 ? 1 : 0;
    
    // Get transaction name/description
    const name = (stmtTrn.NAME || '').toString().trim();
    const memo = (stmtTrn.MEMO || '').toString().trim();
    
    // Combine name and memo for description, prefer name for the main field
    const description = memo && memo !== name ? memo : '';
    const transactionName = name || memo || 'Unknown Transaction';
    
    // Get unique transaction ID
    const external_id = (stmtTrn.FITID || '').toString().trim() || null;
    
    return {
      date,
      name: transactionName,
      description,
      amount: Math.abs(trnAmt), // Store absolute amount
      inflow,
      external_id
    };
  } catch (error) {
    console.warn('Failed to parse transaction:', stmtTrn, error);
    return null;
  }
}

function normalizeOFXDate(dateStr) {
  if (!dateStr) return new Date().toISOString().slice(0, 10);
  
  // OFX dates can be YYYYMMDD or YYYYMMDDHHMMSS
  // We'll take the first 8 characters for the date part
  const datePart = dateStr.toString().slice(0, 8);
  
  if (datePart.length === 8) {
    const year = datePart.slice(0, 4);
    const month = datePart.slice(4, 6);
    const day = datePart.slice(6, 8);
    return `${year}-${month}-${day}`;
  }
  
  // Fallback to current date if parsing fails
  return new Date().toISOString().slice(0, 10);
}
