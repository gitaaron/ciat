import { calculateDateRange } from './dateRange.js'
import { CATEGORY_STEPS } from '../config/categories.js'

/**
 * Calculate category deviations for all categories (same calculation used in CategoryTargets)
 * Returns deviations for all categories, with investments inverted
 * 
 * @param {Array} transactions - Array of transaction objects
 * @param {Object} targets - Category targets object with percentages for each category
 * @param {Object} dateRangeProps - Optional object with startDate and endDate props
 * @returns {Object} Object with deviation values for each category
 */
export function calculateCategoryDeviations(transactions, targets, dateRangeProps = null) {
  // Calculate total net income from transactions categorized as 'income'
  const totalNetIncome = transactions
    .filter(tx => tx.category === 'income')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
  
  // Calculate date range from props or transactions
  let dateRange
  if (dateRangeProps?.startDate && dateRangeProps?.endDate) {
    const startDate = new Date(dateRangeProps.startDate)
    const endDate = new Date(dateRangeProps.endDate)
    
    // Calculate total days between dates
    const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24) // milliseconds to days
    
    // Total months as a decimal (using average days per month: 365.25 / 12 = 30.4375)
    const totalMonths = totalDays / 30.4375
    
    dateRange = {
      months: Math.max(totalMonths, 0.1) // Minimum 0.1 to avoid division by zero
    }
  } else {
    // Fall back to calculating from transactions
    const calculatedRange = calculateDateRange(transactions)
    dateRange = {
      months: calculatedRange.months
    }
  }
  
  // Calculate monthly net income
  const monthlyNetIncome = dateRange.months > 0 ? totalNetIncome / dateRange.months : 0
  
  // Calculate deviations for all categories
  const deviations = {}
  CATEGORY_STEPS.forEach(category => {
    // Calculate monthly target for this category
    const monthlyTarget = (monthlyNetIncome * (targets[category] || 0)) / 100
    
    // Calculate total target (monthly target * number of months)
    const totalTarget = monthlyTarget * dateRange.months
    
    // Calculate total actual for this category (outflows - inflows)
    // Match CategoryTargets logic: inflow === 1 means inflow, inflow === 0 means outflow
    const categoryTransactions = transactions.filter(tx => tx.category === category)
    const inflows = categoryTransactions
      .filter(tx => tx.inflow === 1)
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
    const outflows = categoryTransactions
      .filter(tx => tx.inflow === 0)
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
    const totalActual = outflows - inflows
    
    // Calculate deviation (target - actual)
    let difference = totalTarget - totalActual
    
    // For investments, invert the deviation (multiply by -1)
    if (category === 'investments') {
      difference = difference * -1
    }
    
    deviations[category] = difference
  })
  
  return deviations
}

/**
 * Calculate short term savings deviation (convenience function)
 * This is the difference between target and actual spending for short_term_savings category
 * 
 * @param {Array} transactions - Array of transaction objects
 * @param {Object} targets - Category targets object with short_term_savings percentage
 * @param {Object} dateRangeProps - Optional object with startDate and endDate props
 * @returns {number} The deviation value (target - actual) for short_term_savings
 */
export function calculateShortTermSavingsDeviation(transactions, targets, dateRangeProps = null) {
  const deviations = calculateCategoryDeviations(transactions, targets, dateRangeProps)
  return deviations.short_term_savings
}

/**
 * Calculate monthly deviation for short_term_savings
 * This calculates: (monthly target) - (monthly actual)
 * Uses the same calculation method as CategoryTargets component
 * 
 * @param {Array} transactions - Array of transaction objects (should already be filtered by date if dateRangeProps provided)
 * @param {Object} targets - Category targets object with short_term_savings percentage
 * @param {Object} dateRangeProps - Optional object with startDate and endDate (YYYY-MM-DD format)
 *                                  If not provided, uses last 12 months from today
 * @returns {number} Monthly deviation (target monthly - actual monthly)
 */
export function calculateMonthlyDeviation(transactions, targets, dateRangeProps = null) {
  if (transactions.length === 0) return 0
  
  // Determine date range
  let dateRangeForCalc
  if (dateRangeProps?.startDate && dateRangeProps?.endDate) {
    // Use provided date range
    dateRangeForCalc = dateRangeProps
  } else {
    // Default to last 12 months from today (not from 1st of month)
    const today = new Date()
    const endDate = today
    const startDate = new Date(today)
    startDate.setMonth(startDate.getMonth() - 12)
    dateRangeForCalc = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    }
  }
  
  // Use calculateCategoryDeviations which handles the calculation the same way as CategoryTargets
  // It filters transactions internally and calculates correctly
  const deviations = calculateCategoryDeviations(transactions, targets, dateRangeForCalc)
  const totalDeviation = deviations.short_term_savings
  
  // Calculate the number of months for averaging
  const startDate = new Date(dateRangeForCalc.startDate)
  const endDate = new Date(dateRangeForCalc.endDate)
  const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24)
  const actualMonths = Math.max(totalDays / 30.4375, 0.1)
  
  // Monthly deviation = total deviation / months
  // But wait, we want monthly target - monthly actual, not total deviation / months
  // Let me recalculate properly...
  
  // Filter transactions from the date range (same as CategoryTargets does)
  const filteredTransactions = transactions.filter(tx => {
    if (!tx.date) return false
    return tx.date >= dateRangeForCalc.startDate && tx.date <= dateRangeForCalc.endDate
  })
  
  if (filteredTransactions.length === 0) return 0
  
  // Calculate total net income from income transactions (same as CategoryTargets)
  const totalNetIncome = filteredTransactions
    .filter(tx => tx.category === 'income')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
  
  // Calculate monthly net income
  const monthlyNetIncome = actualMonths > 0 ? totalNetIncome / actualMonths : 0
  
  // Calculate monthly target for short_term_savings
  const monthlyTarget = (monthlyNetIncome * (targets.short_term_savings || 0)) / 100
  
  // Calculate total actual for short_term_savings (outflows - inflows) - same as CategoryTargets
  const categoryTransactions = filteredTransactions.filter(tx => tx.category === 'short_term_savings')
  const inflows = categoryTransactions
    .filter(tx => tx.inflow === 1)
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
  const outflows = categoryTransactions
    .filter(tx => tx.inflow === 0)
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
  const totalActual = outflows - inflows
  
  // Calculate monthly actual (same method as CategoryTargets: totalActual / months)
  const monthlyActual = actualMonths > 0 ? totalActual / actualMonths : 0
  
  // Monthly deviation = monthly target - monthly actual
  return monthlyTarget - monthlyActual
}

/**
 * Calculate average monthly deviation for short_term_savings over last N months
 * (Legacy function - kept for backwards compatibility)
 * 
 * @param {Array} transactions - Array of transaction objects
 * @param {Object} targets - Category targets object with short_term_savings percentage
 * @param {number} months - Number of months to look back (default: 12)
 * @returns {number} Average monthly deviation (deviation / months)
 */
export function calculateAverageMonthlyDeviation(transactions, targets, months = 12) {
  // Create date range props for last N months from today
  const today = new Date()
  const endDate = today
  const startDate = new Date(today)
  startDate.setMonth(startDate.getMonth() - months)
  const dateRangeProps = {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  }
  // Use the new monthly deviation calculation
  return calculateMonthlyDeviation(transactions, targets, dateRangeProps)
}


