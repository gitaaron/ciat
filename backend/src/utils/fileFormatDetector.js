/**
 * File format detection utilities
 * Determines the format of uploaded files based on filename extension and content
 */

/**
 * Detect file format based on filename extension
 */
export function detectFormatByExtension(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  
  switch (ext) {
    case 'csv':
      return 'csv';
    case 'qfx':
      return 'qfx';
    case 'ofx':
      return 'qfx'; // QFX and OFX are essentially the same format
    default:
      return 'unknown';
  }
}

/**
 * Detect file format based on content analysis
 * This is a fallback when extension-based detection fails
 */
export function detectFormatByContent(buffer) {
  const text = buffer.toString('utf8', 0, Math.min(1000, buffer.length));
  
  // Check for XML/OFX signature
  if (text.includes('<?xml') || text.includes('<OFX') || text.includes('<ofx')) {
    return 'qfx';
  }
  
  // Check for CSV-like structure (comma or tab separated)
  const lines = text.split('\n').slice(0, 3);
  if (lines.length >= 2) {
    const firstLine = lines[0];
    const secondLine = lines[1];
    
    // Check for common CSV patterns
    if (firstLine.includes(',') && secondLine.includes(',')) {
      return 'csv';
    }
    if (firstLine.includes('\t') && secondLine.includes('\t')) {
      return 'csv';
    }
  }
  
  return 'unknown';
}

/**
 * Get the primary file format for a file
 * Tries extension first, then content analysis
 */
export function detectFileFormat(filename, buffer) {
  const extFormat = detectFormatByExtension(filename);
  
  if (extFormat !== 'unknown') {
    return extFormat;
  }
  
  return detectFormatByContent(buffer);
}

/**
 * Check if a file format is supported
 */
export function isSupportedFormat(format) {
  return ['csv', 'qfx'].includes(format);
}

/**
 * Get human-readable format name
 */
export function getFormatDisplayName(format) {
  switch (format) {
    case 'csv':
      return 'CSV (Comma/Tab Delimited)';
    case 'qfx':
      return 'QFX (Quicken File Format)';
    default:
      return 'Unknown Format';
  }
}
