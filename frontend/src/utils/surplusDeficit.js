/**
 * Utility functions for calculating and formatting surplus/deficit values
 */

/**
 * Calculate net amount (surplus/deficit) from inflow and outflow
 * @param {number} totalInflow - Total inflow amount
 * @param {number} totalOutflow - Total outflow amount
 * @returns {number} Net amount (inflow - outflow)
 */
export function calculateNetAmount(totalInflow, totalOutflow) {
  return totalInflow - totalOutflow
}

/**
 * Get the label for surplus/deficit based on net amount
 * @param {number} netAmount - Net amount (positive = surplus, negative = deficit)
 * @returns {string} "Total Surplus" or "Total Deficit"
 */
export function getSurplusDeficitLabel(netAmount) {
  return netAmount >= 0 ? 'Total Surplus' : 'Total Deficit'
}

/**
 * Get the CSS class for surplus/deficit based on net amount
 * @param {number} netAmount - Net amount (positive = surplus, negative = deficit)
 * @returns {string} "stat-surplus" or "stat-deficit"
 */
export function getSurplusDeficitClass(netAmount) {
  return netAmount >= 0 ? 'stat-surplus' : 'stat-deficit'
}

/**
 * Check if the net amount represents a surplus
 * @param {number} netAmount - Net amount
 * @returns {boolean} True if surplus (>= 0), false if deficit
 */
export function isSurplus(netAmount) {
  return netAmount >= 0
}

/**
 * Format currency value for display with proper number formatting
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string (e.g., "+$1,234.56" or "-$1,234.56")
 */
export function formatCurrencyValue(amount) {
  const formatted = new Intl.NumberFormat('en-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Math.abs(amount))
  return (amount >= 0 ? '+' : '') + '$' + formatted
}

