
import { parse } from 'csv-parse/sync';

/**
 * Expected CSV columns (flexible): date, name, amount, credit, external_id
 * - date: YYYY-MM-DD or DD/MM/YYYY etc. (we try to normalize but keep it simple here)
 * - amount: outflow/expense field (when present, sets inflow = 0)
 * - credit: inflow/income field (when present, sets inflow = 1)
 * - If amount field has value → expense (inflow = 0)
 * - If credit field has value → income (inflow = 1)
 * Supports both comma-delimited and tab-delimited files
 * 
 * @param {Buffer} buffer - CSV file buffer
 * @param {Object} fieldMapping - Optional field mapping: {date: 'column_name', name: 'column_name', inflow: 'column_name', outflow: 'column_name'}
 */
export function parseTransactionsCSV(buffer, fieldMapping = null) {
  const text = buffer.toString('utf8');
  
  // Detect delimiter by checking which appears more frequently in the first few lines
  const delimiter = detectDelimiter(text);
  
  // Pre-process the text to fix common CSV issues
  const cleanedText = preprocessCSV(text);
  
  let rows;
  
  try {
    // When field mapping is provided, we need to parse the same way previewCSV does
    // previewCSV uses columns: true, which on headerless CSV uses first row as column names
    // So we need to do the same to get consistent column names
    
    // First, get the column names the same way previewCSV does
    let columnNames = [];
    if (fieldMapping) {
      // Parse a preview to get column names (same as previewCSV)
      const previewRows = parse(cleanedText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter: delimiter,
        quote: '"',
        escape: '"',
        relax_quotes: true,
        relax_column_count: true,
        to: 1 // Just get first row to determine column names
      });
      if (previewRows.length > 0) {
        columnNames = Object.keys(previewRows[0]);
      }
    }
    
    const parseOptions = {
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
    };
    
    // Parse with columns: true when field mapping is provided (matches previewCSV)
    // This will use first row as column names for headerless CSV
    if (fieldMapping) {
      parseOptions.columns = true;
    } else {
      // No field mapping - use default column names for headerless CSV
      parseOptions.columns = ['date', 'name', 'amount', 'credit', 'card_number'];
    }
    
    rows = parse(cleanedText, parseOptions);
    
    // Debug: log column names and first row when field mapping is used
    if (fieldMapping && rows.length > 0) {
      console.log('Parsed CSV with field mapping:', {
        detectedColumns: Object.keys(rows[0]),
        fieldMapping,
        firstRow: rows[0]
      });
    }
  } catch (error) {
    console.error('CSV parsing error:', error);
    throw error;
  }
  
  
  // Get column names/keys from first row to determine column order
  const columnKeys = rows.length > 0 ? Object.keys(rows[0]) : [];
  
  return rows.map((r, index) => {
    // Use field mapping if provided, otherwise use default column names
    let dateValue, nameValue, outflowValue, inflowValue, externalIdValue;
    
    if (fieldMapping) {
      // Helper function to get value by column index
      // Field mapping format: { 0: 'date', 1: 'name', 2: 'outflow', 3: 'inflow' }
      const getMappedValueByIndex = (mappingKey) => {
        // Find the column index for this field
        let columnIndex = null;
        
        for (const [key, value] of Object.entries(fieldMapping)) {
          if (value === mappingKey) {
            // Format: index -> field name
            const idx = parseInt(key, 10);
            if (!isNaN(idx)) {
              columnIndex = idx;
              break;
            }
          }
        }
        
        // If we found an index, use it
        if (columnIndex !== null && columnIndex >= 0 && columnIndex < columnKeys.length) {
          const columnKey = columnKeys[columnIndex];
          const value = r[columnKey];
          return (value === undefined || value === null) ? '' : String(value);
        }
        
        // Field not found in mapping
        if (index === 0) {
          console.warn(`CSV parsing: Field "${mappingKey}" not found in mapping.`, {
            fieldMapping,
            availableColumns: columnKeys,
            mappingKey
          });
        }
        return '';
      };
      
      dateValue = getMappedValueByIndex('date');
      nameValue = getMappedValueByIndex('name');
      outflowValue = getMappedValueByIndex('outflow');
      inflowValue = getMappedValueByIndex('inflow');
      externalIdValue = getMappedValueByIndex('external_id');
      
      // Debug logging for first row
      if (index === 0) {
        console.log('CSV parsing with field mapping:', {
          fieldMapping,
          columnKeys,
          columnIndices: columnKeys.map((_, i) => i),
          dateValue,
          nameValue,
          outflowValue,
          inflowValue
        });
      }
    } else {
      // Default column names
      dateValue = r.date || '';
      nameValue = r.name || '';
      outflowValue = r.amount || '';
      inflowValue = r.credit || '';
      externalIdValue = r.card_number || '';
    }
    
    const date = normalizeDate(dateValue);
    const name = (nameValue || '').toString().trim();
    const description = ''; // No description field in this CSV format
    
    // Handle separate outflow/expense and inflow/income fields
    const outflowStr = (outflowValue || '').toString().trim();
    const inflowStr = (inflowValue || '').toString().trim();
    
    // Try to parse as numbers, handling negative values and currency symbols
    const parseAmount = (str) => {
      if (!str) return 0;
      // Remove currency symbols, commas, and whitespace
      const cleaned = str.replace(/[$,\s]/g, '');
      const num = Number(cleaned);
      return isNaN(num) ? 0 : Math.abs(num); // Always use absolute value
    };
    
    const outflowValueNum = parseAmount(outflowStr);
    const inflowValueNum = parseAmount(inflowStr);
    
    // Determine which field has a value and set inflow accordingly
    let amount, inflow;
    if (outflowValueNum > 0) {
      // outflow field has value = expense (inflow = 0)
      amount = outflowValueNum;
      inflow = 0;
    } else if (inflowValueNum > 0) {
      // inflow field has value = income (inflow = 1)
      amount = inflowValueNum;
      inflow = 1;
    } else {
      // Neither field has a value - log warning and default to expense with 0 amount
      if (index === 0) {
        console.warn('CSV parsing: Neither outflow nor inflow field has a valid value', {
          outflowStr,
          inflowStr,
          outflowValueNum,
          inflowValueNum,
          row: r
        });
      }
      amount = 0;
      inflow = 0;
    }
    
    const external_id = (externalIdValue || '').toString().trim() || null;
    return { date, name, description, amount, inflow, external_id };
  });
}

/**
 * Preview CSV file and detect column structure
 * Returns first 5 rows and detected column names
 * Tries to include at least one transaction with inflow and one with outflow
 */
export function previewCSV(buffer) {
  const text = buffer.toString('utf8');
  const delimiter = detectDelimiter(text);
  const cleanedText = preprocessCSV(text);
  
  try {
    // Parse more rows to find examples with inflow and outflow
    const allRows = parse(cleanedText, {
      columns: true, // Use first row as headers
      skip_empty_lines: true,
      trim: true,
      delimiter: delimiter,
      quote: '"',
      escape: '"',
      relax_quotes: true,
      relax_column_count: true,
      to: 50 // Parse up to 50 rows to find good examples
    });
    
    // Get column names from first row (these are the actual column names used for parsing)
    const originalColumnNames = allRows.length > 0 ? Object.keys(allRows[0]) : [];
    
    // Find numeric columns and identify inflow/outflow example rows
    // We need to find rows that have values in different columns to identify separate inflow/outflow columns
    const numericColumns = new Set();
    let inflowRow = null;
    let inflowRowIndex = -1;
    let outflowRow = null;
    let outflowRowIndex = -1;
    
    // Track which columns have values in which rows
    const columnValueMap = new Map(); // column -> array of row indices with values
    // Track column positions and their usage patterns
    const columnUsageStats = new Map(); // column -> { totalRowsWithValue, totalValue }
    
    for (let i = 0; i < allRows.length; i++) {
      const row = allRows[i];
      const numericValues = [];
      
      // Check each column for numeric values
      for (let colIndex = 0; colIndex < originalColumnNames.length; colIndex++) {
        const col = originalColumnNames[colIndex];
        const val = (row[col] || '').toString().trim();
        const numVal = val ? Number(val.replace(/[$,\s]/g, '')) : 0;
        if (numVal > 0) {
          numericColumns.add(col);
          numericValues.push({ col, val: numVal, colIndex });
          
          // Track which rows have values in this column
          if (!columnValueMap.has(col)) {
            columnValueMap.set(col, []);
          }
          columnValueMap.get(col).push(i);
          
          // Track usage statistics
          if (!columnUsageStats.has(col)) {
            columnUsageStats.set(col, { totalRowsWithValue: 0, totalValue: 0 });
          }
          const stats = columnUsageStats.get(col);
          stats.totalRowsWithValue++;
          stats.totalValue += numVal;
        }
      }
      
      // If row has exactly one numeric value, it's a good example of inflow OR outflow
      if (numericValues.length === 1) {
        // Try to determine if it's more likely inflow or outflow based on column name
        const colName = numericValues[0].col.toLowerCase();
        const isLikelyInflow = colName.includes('credit') || colName.includes('deposit') || 
                               colName.includes('income') || colName.includes('inflow') || 
                               colName.includes('received');
        const isLikelyOutflow = colName.includes('debit') || colName.includes('withdrawal') || 
                               colName.includes('expense') || colName.includes('outflow') || 
                               colName.includes('paid') || colName.includes('amount') || 
                               colName.includes('charge');
        
        // For headerless CSVs, column names might be data values, so also check column position
        // Typically: date, name, outflow, inflow (columns 0, 1, 2, 3)
        // Or: date, name, inflow, outflow (columns 0, 1, 2, 3)
        const colIndex = numericValues[0].colIndex;
        const isLikelyOutflowByPosition = (colIndex === 2 || colIndex === 3) && !isLikelyInflow;
        const isLikelyInflowByPosition = (colIndex === 2 || colIndex === 3) && !isLikelyOutflow;
        
        if (isLikelyInflow && !inflowRow) {
          inflowRow = row;
          inflowRowIndex = i;
        } else if (isLikelyOutflow && !outflowRow) {
          outflowRow = row;
          outflowRowIndex = i;
        } else if (!inflowRow && (isLikelyInflowByPosition || (!isLikelyOutflow && !isLikelyOutflowByPosition))) {
          // If we can't determine, prefer earlier columns for outflow
          if (colIndex <= 2) {
            if (!outflowRow) {
              outflowRow = row;
              outflowRowIndex = i;
            }
          } else {
            inflowRow = row;
            inflowRowIndex = i;
          }
        } else if (!outflowRow && (isLikelyOutflowByPosition || (!isLikelyInflow && !isLikelyInflowByPosition))) {
          outflowRow = row;
          outflowRowIndex = i;
        }
      } else if (numericValues.length >= 2) {
        // Row has multiple numeric columns - good candidate for showing both
        // Use the first numeric column as outflow, second as inflow (typical pattern)
        if (!outflowRow) {
          outflowRow = row;
          outflowRowIndex = i;
        }
        if (!inflowRow && outflowRowIndex !== i) {
          inflowRow = row;
          inflowRowIndex = i;
        }
      }
    }
    
    // If we still don't have both examples, use column usage statistics
    // The column with more rows having values is likely the outflow column
    if ((!inflowRow || !outflowRow) && numericColumns.size >= 1) {
      const numericColsArray = Array.from(numericColumns);
      
      // Sort by usage (most used first) - most used is likely outflow
      const sortedByUsage = numericColsArray.map(col => ({
        col,
        stats: columnUsageStats.get(col) || { totalRowsWithValue: 0, totalValue: 0 }
      })).sort((a, b) => b.stats.totalRowsWithValue - a.stats.totalRowsWithValue);
      
      // The most used column is likely outflow - ensure we have an example
      if (!outflowRow && sortedByUsage.length > 0) {
        const outflowCol = sortedByUsage[0].col;
        const outflowRows = columnValueMap.get(outflowCol) || [];
        if (outflowRows.length > 0) {
          // Find a row with a substantial value (not just a small amount)
          // This helps ensure we show a clear example
          let bestRowIndex = outflowRows[0];
          let bestValue = 0;
          for (const rowIdx of outflowRows) {
            const row = allRows[rowIdx];
            const val = (row[outflowCol] || '').toString().trim();
            const numVal = val ? Number(val.replace(/[$,\s]/g, '')) : 0;
            if (numVal > bestValue) {
              bestValue = numVal;
              bestRowIndex = rowIdx;
            }
          }
          outflowRow = allRows[bestRowIndex];
          outflowRowIndex = bestRowIndex;
        }
      }
      
      // The second most used column (or a column with fewer values) is likely inflow
      if (!inflowRow && sortedByUsage.length > 1) {
        const inflowCol = sortedByUsage[1].col;
        const inflowRows = columnValueMap.get(inflowCol) || [];
        if (inflowRows.length > 0) {
          inflowRow = allRows[inflowRows[0]];
          inflowRowIndex = inflowRows[0];
        }
      } else if (!inflowRow && sortedByUsage.length === 1) {
        // Only one numeric column - check if there's a column that's always empty (likely inflow)
        // Find a column that has no values in any row
        for (let colIndex = 0; colIndex < originalColumnNames.length; colIndex++) {
          const col = originalColumnNames[colIndex];
          if (!numericColumns.has(col)) {
            // This column has no numeric values - it might be the inflow column
            // But we can't show an example with no value, so skip
            continue;
          }
        }
      }
    }
    
    // Final fallback: if we still don't have an outflow row but we have numeric columns,
    // just pick the first row with a value in the most-used column
    if (!outflowRow && numericColumns.size > 0) {
      const numericColsArray = Array.from(numericColumns);
      const firstNumericCol = numericColsArray[0];
      const rowsWithValue = columnValueMap.get(firstNumericCol) || [];
      if (rowsWithValue.length > 0) {
        outflowRow = allRows[rowsWithValue[0]];
        outflowRowIndex = rowsWithValue[0];
      }
    }
    
    // If we have multiple numeric columns, try to find rows where only one column has a value
    // This helps identify which column is inflow vs outflow
    if (numericColumns.size >= 2 && (!inflowRow || !outflowRow)) {
      const numericColsArray = Array.from(numericColumns);
      
      // Find rows where only the first numeric column has a value (likely outflow)
      if (!outflowRow) {
        const firstCol = numericColsArray[0];
        const rowsWithFirstColOnly = columnValueMap.get(firstCol) || [];
        for (const rowIdx of rowsWithFirstColOnly) {
          const row = allRows[rowIdx];
          let onlyFirstCol = true;
          for (let j = 1; j < numericColsArray.length; j++) {
            const val = (row[numericColsArray[j]] || '').toString().trim();
            const numVal = val ? Number(val.replace(/[$,\s]/g, '')) : 0;
            if (numVal > 0) {
              onlyFirstCol = false;
              break;
            }
          }
          if (onlyFirstCol) {
            outflowRow = row;
            outflowRowIndex = rowIdx;
            break;
          }
        }
      }
      
      // Find rows where only the second numeric column has a value (likely inflow)
      if (!inflowRow && numericColsArray.length >= 2) {
        const secondCol = numericColsArray[1];
        const rowsWithSecondColOnly = columnValueMap.get(secondCol) || [];
        for (const rowIdx of rowsWithSecondColOnly) {
          const row = allRows[rowIdx];
          let onlySecondCol = true;
          for (let j = 0; j < numericColsArray.length; j++) {
            if (j === 1) continue; // Skip the second column
            const val = (row[numericColsArray[j]] || '').toString().trim();
            const numVal = val ? Number(val.replace(/[$,\s]/g, '')) : 0;
            if (numVal > 0) {
              onlySecondCol = false;
              break;
            }
          }
          if (onlySecondCol) {
            inflowRow = row;
            inflowRowIndex = rowIdx;
            break;
          }
        }
      }
    }
    
    // Build preview rows - prioritize inflow and outflow examples
    const previewRowsWithOriginalNames = [];
    const usedIndicesForPreview = new Set();
    
    // Always include first row for context (unless it's already our inflow/outflow row)
    if (allRows.length > 0 && 
        (inflowRowIndex !== 0 && outflowRowIndex !== 0)) {
      previewRowsWithOriginalNames.push(allRows[0]);
      usedIndicesForPreview.add(0);
    }
    
    // Add inflow row if found and not already included (high priority)
    if (inflowRow && inflowRowIndex >= 0 && !usedIndicesForPreview.has(inflowRowIndex)) {
      previewRowsWithOriginalNames.push(inflowRow);
      usedIndicesForPreview.add(inflowRowIndex);
    }
    
    // Add outflow row if found and not already included (high priority)
    if (outflowRow && outflowRowIndex >= 0 && !usedIndicesForPreview.has(outflowRowIndex)) {
      previewRowsWithOriginalNames.push(outflowRow);
      usedIndicesForPreview.add(outflowRowIndex);
    }
    
    // Fill remaining slots up to 5 rows with other rows
    for (let i = 0; i < allRows.length && previewRowsWithOriginalNames.length < 5; i++) {
      if (!usedIndicesForPreview.has(i)) {
        previewRowsWithOriginalNames.push(allRows[i]);
        usedIndicesForPreview.add(i);
      }
    }
    
    // Ensure we have at least one inflow and one outflow example
    // If we don't, try to find them even if we have to replace some rows
    if (previewRowsWithOriginalNames.length > 0) {
      // Check if we have both inflow and outflow examples
      let hasInflowExample = false;
      let hasOutflowExample = false;
      
      for (const row of previewRowsWithOriginalNames) {
        const numericValues = [];
        for (const col of originalColumnNames) {
          const val = (row[col] || '').toString().trim();
          const numVal = val ? Number(val.replace(/[$,\s]/g, '')) : 0;
          if (numVal > 0) {
            numericValues.push({ col, val: numVal });
          }
        }
        
        // If row has exactly one numeric value, it could be either inflow or outflow
        // We'll consider it as a potential example
        if (numericValues.length === 1) {
          if (!hasInflowExample) hasInflowExample = true;
          if (!hasOutflowExample) hasOutflowExample = true;
        } else if (numericValues.length >= 2) {
          // Row has multiple numeric columns - good for showing both
          hasInflowExample = true;
          hasOutflowExample = true;
        }
      }
      
      // If we're missing examples, try to add them even if it means going over 5 rows temporarily
      if (!hasInflowExample && inflowRow && inflowRowIndex >= 0) {
        if (!usedIndicesForPreview.has(inflowRowIndex)) {
          previewRowsWithOriginalNames.push(inflowRow);
          usedIndicesForPreview.add(inflowRowIndex);
        }
      }
      
      if (!hasOutflowExample && outflowRow && outflowRowIndex >= 0) {
        if (!usedIndicesForPreview.has(outflowRowIndex)) {
          previewRowsWithOriginalNames.push(outflowRow);
          usedIndicesForPreview.add(outflowRowIndex);
        }
      }
    }
    
    // Limit to 5 rows total, but prioritize keeping inflow and outflow examples
    let finalPreviewRows = [];
    const finalUsedIndices = new Set();
    
    // First, ensure we include inflow and outflow rows if we have them
    if (inflowRow && inflowRowIndex >= 0) {
      finalPreviewRows.push(inflowRow);
      finalUsedIndices.add(inflowRowIndex);
    }
    if (outflowRow && outflowRowIndex >= 0 && outflowRowIndex !== inflowRowIndex) {
      finalPreviewRows.push(outflowRow);
      finalUsedIndices.add(outflowRowIndex);
    }
    
    // Then add other rows up to 5 total
    for (const row of previewRowsWithOriginalNames) {
      if (finalPreviewRows.length >= 5) break;
      const rowIndex = allRows.indexOf(row);
      if (rowIndex >= 0 && !finalUsedIndices.has(rowIndex)) {
        finalPreviewRows.push(row);
        finalUsedIndices.add(rowIndex);
      }
    }
    
    // If we still have space and haven't reached 5, add any remaining rows
    for (let i = 0; i < allRows.length && finalPreviewRows.length < 5; i++) {
      if (!finalUsedIndices.has(i)) {
        finalPreviewRows.push(allRows[i]);
        finalUsedIndices.add(i);
      }
    }
    
    // Final limit to 5 rows
    finalPreviewRows = finalPreviewRows.slice(0, 5);
    
    // Generate display names for dropdown by finding first non-empty value in each column
    // ONLY from the preview rows so display names match what's visible
    const displayColumnNames = [];
    const columnNameMapping = {}; // Maps display names to original names
    
    for (let colIndex = 0; colIndex < originalColumnNames.length; colIndex++) {
      const originalName = originalColumnNames[colIndex];
      let displayName = originalName;
      
      // If column name is empty or looks like data, find first non-empty value from preview rows
      if (!originalName || originalName.trim() === '' ||
          /^\d{4}-\d{2}-\d{2}/.test(originalName) || 
          /^\d{2}\/\d{2}\/\d{4}/.test(originalName) ||
          !isNaN(Number(originalName)) ||
          (originalName.length > 20)) {
        
        // Find first preview row with a non-empty value in this column
        for (const row of finalPreviewRows) {
          const value = row[originalName];
          if (value !== undefined && value !== null && value.toString().trim() && 
              value.toString().trim() !== originalName && value.toString().trim().toLowerCase() !== 'none') {
            const trimmedValue = value.toString().trim();
            // Use shortened value if reasonable length, otherwise use generic name
            if (trimmedValue.length > 0 && trimmedValue.length <= 40) {
              displayName = trimmedValue.length > 30 ? trimmedValue.substring(0, 30) + '...' : trimmedValue;
            } else {
              displayName = `Column ${colIndex + 1}`;
            }
            break;
          }
        }
        
        // If still no better name found, use generic
        if (displayName === originalName || !displayName || displayName.trim() === '') {
          displayName = `Column ${colIndex + 1}`;
        }
      }
      
      displayColumnNames.push(displayName);
      columnNameMapping[displayName] = originalName; // Map display name to original
    }
    
    // Update preview rows to use display names as keys (for frontend display)
    const previewRowsWithDisplayNames = finalPreviewRows.map(row => {
      const newRow = {};
      originalColumnNames.forEach((originalName, colIndex) => {
        const displayName = displayColumnNames[colIndex];
        newRow[displayName] = row[originalName];
      });
      return newRow;
    });
    
    // Use display names for the columns array returned
    const columnNames = displayColumnNames;
    
    // Create column index mapping: field -> column index
    // This will be used to store which column index corresponds to which field
    // Format: { 0: 'date', 1: 'name', 2: 'outflow', 3: 'inflow' } or similar
    // We'll build this when the user maps fields, but for now return the structure
    
    // The preview rows are already selected and converted to use display names
    // Just return them directly
    return {
      columns: columnNames,
      preview: previewRowsWithDisplayNames,
      columnNameMapping: columnNameMapping, // Map display names to original names (for backward compatibility)
      columnIndices: originalColumnNames.map((_, index) => index) // Array of indices [0, 1, 2, ...]
    };
  } catch (error) {
    console.error('CSV preview error:', error);
    throw error;
  }
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
