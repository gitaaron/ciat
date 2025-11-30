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

