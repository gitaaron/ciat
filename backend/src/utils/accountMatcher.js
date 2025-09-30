/**
 * Utility for matching filenames to accounts using string similarity
 */

/**
 * Calculate string similarity using Levenshtein distance
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];
  const len1 = str1.length;
  const len2 = str2.length;

  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[len2][len1];
}

/**
 * Calculate similarity score between 0 and 1
 */
function calculateSimilarity(str1, str2) {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  return maxLength === 0 ? 1 : 1 - (distance / maxLength);
}

/**
 * Extract potential account names from filename
 */
function extractAccountCandidates(filename) {
  // Remove common file extensions and separators
  const cleanName = filename
    .replace(/\.(csv|xlsx?|txt)$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Split by common separators and return potential candidates
  const candidates = cleanName.split(/[\s,]+/).filter(part => part.length > 2);
  
  // Also return the full cleaned name
  candidates.unshift(cleanName);
  
  return [...new Set(candidates)]; // Remove duplicates
}

/**
 * Find best matching account for a filename
 */
export function findBestAccountMatch(filename, accounts, threshold = 0.3) {
  if (!filename || !accounts || accounts.length === 0) {
    return null;
  }

  const candidates = extractAccountCandidates(filename);
  let bestMatch = null;
  let bestScore = 0;

  for (const account of accounts) {
    for (const candidate of candidates) {
      const score = calculateSimilarity(candidate, account.name);
      if (score > bestScore && score >= threshold) {
        bestScore = score;
        bestMatch = account;
      }
    }
  }

  return bestMatch ? { account: bestMatch, score: bestScore } : null;
}

/**
 * Suggest account name based on filename
 */
export function suggestAccountName(filename) {
  const cleanName = filename
    .replace(/\.(csv|xlsx?|txt)$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Capitalize first letter of each word
  return cleanName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
