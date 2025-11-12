/**
 * Calculate date range from an array of transactions
 * @param {Array} transactions - Array of transaction objects with a 'date' property
 * @returns {Object} Object with start, end, months, and years properties
 */
export function calculateDateRange(transactions) {
  if (transactions.length === 0) {
    return { start: null, end: null, months: 0, years: 0 }
  }
  
  const dates = transactions
    .map(tx => tx.date)
    .filter(date => date)
    .sort()
  
  if (dates.length === 0) {
    return { start: null, end: null, months: 0, years: 0 }
  }
  
  const startDate = new Date(dates[0])
  const endDate = new Date(dates[dates.length - 1])
  
  // Calculate total days between dates
  const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24) // milliseconds to days
  
  // Total months as a decimal (using average days per month: 365.25 / 12 = 30.4375)
  const totalMonths = totalDays / 30.4375
  
  // Total years as a decimal (accounting for leap years)
  const totalYears = totalDays / 365.25
  
  return {
    start: dates[0],
    end: dates[dates.length - 1],
    months: Math.max(totalMonths, 0.1), // Minimum 0.1 to avoid division by zero
    years: Math.max(totalYears, 0.01) // Minimum 0.01 to avoid division by zero
  }
}

