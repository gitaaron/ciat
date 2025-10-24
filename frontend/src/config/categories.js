/**
 * Global category configuration
 * Centralized mapping of category keys to display names, icons, and colors
 */

export const CATEGORY_NAMES = {
  'fixed_costs': 'Fixed Costs',
  'investments': 'Investments', 
  'guilt_free': 'Guilt Free',
  'short_term_savings': 'Short Term Savings',
  'uncategorized': 'Uncategorized'
}

export const CATEGORY_ICONS = {
  'fixed_costs': 'mdi-home',
  'investments': 'mdi-trending-up',
  'guilt_free': 'mdi-heart',
  'short_term_savings': 'mdi-piggy-bank',
  'uncategorized': 'mdi-folder'
}

export const CATEGORY_COLORS = {
  'fixed_costs': 'blue',
  'investments': 'green',
  'guilt_free': 'pink',
  'short_term_savings': 'orange',
  'uncategorized': 'grey'
}

export const CATEGORY_STEPS = ['fixed_costs', 'investments', 'guilt_free', 'short_term_savings']

export const CATEGORY_OPTIONS = [
  { title: 'All Categories', value: '' },
  { title: CATEGORY_NAMES.fixed_costs, value: 'fixed_costs' },
  { title: CATEGORY_NAMES.investments, value: 'investments' },
  { title: CATEGORY_NAMES.guilt_free, value: 'guilt_free' },
  { title: CATEGORY_NAMES.short_term_savings, value: 'short_term_savings' },
  { title: CATEGORY_NAMES.uncategorized, value: 'uncategorized' }
]

export const CATEGORY_SELECT_OPTIONS = [
  { title: 'Select a category', value: '' },
  { title: CATEGORY_NAMES.guilt_free, value: 'guilt_free' },
  { title: CATEGORY_NAMES.short_term_savings, value: 'short_term_savings' },
  { title: CATEGORY_NAMES.fixed_costs, value: 'fixed_costs' },
  { title: CATEGORY_NAMES.investments, value: 'investments' }
]

// Helper functions
export function getCategoryName(category) {
  return CATEGORY_NAMES[category] || category
}

export function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || 'mdi-folder'
}

export function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || 'grey'
}
