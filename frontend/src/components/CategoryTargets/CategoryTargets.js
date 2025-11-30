import { ref, computed, onMounted, watch } from 'vue'
import api from '../api.js'
import { CATEGORY_NAMES, CATEGORY_COLORS, CATEGORY_STEPS } from '../../config/categories.js'
import { calculateDateRange } from '../../utils/dateRange.js'
import { calculateCategoryDeviations } from '../../utils/shortTermSavingsDeviation.js'

export default {
  name: 'CategoryTargets',
  setup(props = {}) {
    const targets = ref({
      fixed_costs: 35,
      investments: 10,
      guilt_free: 40,
      short_term_savings: 15
    })
    
    const transactions = ref([])
    const loading = ref(true)
    const saving = ref(false)
    const editing = ref(false)
    const tempTargets = ref({})
    
    // Calculate total net income from transactions categorized as 'income'
    const totalNetIncome = computed(() => {
      return transactions.value
        .filter(tx => tx.category === 'income')
        .reduce((sum, tx) => sum + Number(tx.amount), 0)
    })
    
    // Calculate date range from selected date range props, or fall back to transactions
    const dateRange = computed(() => {
      // If startDate and endDate props are provided, calculate range from those
      if (props?.startDate && props?.endDate) {
        const startDate = new Date(props.startDate)
        const endDate = new Date(props.endDate)
        
        // Calculate total days between dates
        const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24) // milliseconds to days
        
        // Total months as a decimal (using average days per month: 365.25 / 12 = 30.4375)
        const totalMonths = totalDays / 30.4375
        
        // Total years as a decimal (accounting for leap years)
        const totalYears = totalDays / 365.25
        
        return {
          start: props.startDate,
          end: props.endDate,
          months: Math.max(totalMonths, 0.1), // Minimum 0.1 to avoid division by zero
          years: Math.max(totalYears, 0.01) // Minimum 0.01 to avoid division by zero
        }
      }
      
      // Fall back to calculating from transactions
      return calculateDateRange(transactions.value)
    })
    
    // Calculate monthly net income (total divided by number of months)
    const monthlyNetIncome = computed(() => {
      if (dateRange.value.months === 0) return 0
      return totalNetIncome.value / dateRange.value.months
    })
    
    // Calculate annual net income (total divided by number of years)
    const annualNetIncome = computed(() => {
      if (dateRange.value.years === 0) return 0
      return totalNetIncome.value / dateRange.value.years
    })
    
    // Calculate total actual spending by category (outflows - inflows, not averaged)
    // Actual values are now based on percentage of transactions categorized as 'income'
    const totalActual = computed(() => {
      const spending = {}
      CATEGORY_STEPS.forEach(category => {
        const categoryTransactions = transactions.value.filter(tx => tx.category === category)
        const inflows = categoryTransactions
          .filter(tx => tx.inflow === 1)
          .reduce((sum, tx) => sum + Number(tx.amount), 0)
        const outflows = categoryTransactions
          .filter(tx => tx.inflow === 0)
          .reduce((sum, tx) => sum + Number(tx.amount), 0)
        spending[category] = outflows - inflows
      })
      return spending
    })
    
    // Calculate monthly actual spending (derived from totalActual)
    const monthlyActual = computed(() => {
      const spending = {}
      CATEGORY_STEPS.forEach(category => {
        spending[category] = dateRange.value.months > 0 
          ? totalActual.value[category] / dateRange.value.months 
          : 0
      })
      return spending
    })
    
    // Calculate the most recent full month in the date range
    const lastMonthRange = computed(() => {
      let endDate
      if (props?.endDate) {
        endDate = new Date(props.endDate)
      } else if (transactions.value.length > 0) {
        const dates = transactions.value
          .map(tx => tx.date)
          .filter(date => date)
          .sort()
        if (dates.length > 0) {
          endDate = new Date(dates[dates.length - 1])
        }
      }
      
      if (!endDate) return null
      
      // Get the last day of the current month (the month that endDate is in)
      const lastDayOfCurrentMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0)
      const endDateDay = endDate.getDate()
      const lastDayOfMonth = lastDayOfCurrentMonth.getDate()
      
      // If endDate is the last day of its month, use the current month
      // Otherwise, use the previous month
      let lastMonthStart, lastMonthEnd
      if (endDateDay === lastDayOfMonth) {
        // Use the current month (it's complete)
        lastMonthStart = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
        lastMonthEnd = lastDayOfCurrentMonth
      } else {
        // Use the previous month
        lastMonthStart = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1)
        lastMonthEnd = new Date(endDate.getFullYear(), endDate.getMonth(), 0)
      }
      
      // Ensure the month is within the date range
      const rangeStart = props?.startDate ? new Date(props.startDate) : null
      if (rangeStart) {
        const rangeStartDate = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate())
        const lastMonthStartDate = new Date(lastMonthStart.getFullYear(), lastMonthStart.getMonth(), lastMonthStart.getDate())
        if (lastMonthStartDate < rangeStartDate) {
          return null
        }
      }
      
      return {
        start: lastMonthStart.toISOString().split('T')[0],
        end: lastMonthEnd.toISOString().split('T')[0]
      }
    })
    
    // Calculate last month actual spending per category
    const lastMonthActual = computed(() => {
      const spending = {}
      
      if (!lastMonthRange.value) {
        CATEGORY_STEPS.forEach(category => {
          spending[category] = 0
        })
        return spending
      }
      
      const startDate = lastMonthRange.value.start
      const endDate = lastMonthRange.value.end
      
      CATEGORY_STEPS.forEach(category => {
        // Filter transactions for this category within the last month's date range
        const categoryTransactions = transactions.value.filter(tx => {
          if (tx.category !== category) return false
          const txDate = tx.date
          if (!txDate) return false
          // Compare dates as strings (YYYY-MM-DD format) - this works correctly for ISO date strings
          // txDate, startDate, and endDate are all in YYYY-MM-DD format
          return txDate >= startDate && txDate <= endDate
        })
        
        const inflows = categoryTransactions
          .filter(tx => tx.inflow === 1)
          .reduce((sum, tx) => sum + Number(tx.amount), 0)
        const outflows = categoryTransactions
          .filter(tx => tx.inflow === 0)
          .reduce((sum, tx) => sum + Number(tx.amount), 0)
        
        spending[category] = outflows - inflows
      })
      
      return spending
    })
    
    // Calculate last month's net income (income transactions in that specific month)
    const lastMonthNetIncome = computed(() => {
      if (!lastMonthRange.value) return 0
      
      const startDate = lastMonthRange.value.start
      const endDate = lastMonthRange.value.end
      
      return transactions.value
        .filter(tx => {
          if (tx.category !== 'income') return false
          const txDate = tx.date
          if (!txDate) return false
          return txDate >= startDate && txDate <= endDate
        })
        .reduce((sum, tx) => sum + Number(tx.amount), 0)
    })
    
    // Calculate last month target amounts based on last month's net income
    const lastMonthTarget = computed(() => {
      const amounts = {}
      CATEGORY_STEPS.forEach(category => {
        amounts[category] = (lastMonthNetIncome.value * targets.value[category]) / 100
      })
      return amounts
    })
    
    // Calculate monthly target amounts based on monthly net income
    const monthlyTarget = computed(() => {
      const amounts = {}
      CATEGORY_STEPS.forEach(category => {
        amounts[category] = (monthlyNetIncome.value * targets.value[category]) / 100
      })
      return amounts
    })
    
    // Calculate total target amounts (monthly target * number of months)
    const totalTarget = computed(() => {
      const amounts = {}
      CATEGORY_STEPS.forEach(category => {
        amounts[category] = monthlyTarget.value[category] * dateRange.value.months
      })
      return amounts
    })
    
    // Keep targetAmounts for backward compatibility
    const targetAmounts = computed(() => monthlyTarget.value)
    
    // Calculate surplus/deficit for each category (using shared utility function)
    const categoryAnalysis = computed(() => {
      const dateRangeProps = props?.startDate && props?.endDate 
        ? { startDate: props.startDate, endDate: props.endDate }
        : null
      const deviations = calculateCategoryDeviations(transactions.value, targets.value, dateRangeProps)
      
      const analysis = {}
      CATEGORY_STEPS.forEach(category => {
        const actual = totalActual.value[category]
        const target = totalTarget.value[category]
        const difference = deviations[category]
        const percentage = totalNetIncome.value > 0 ? (actual / totalNetIncome.value) * 100 : 0
        
        analysis[category] = {
          actual,
          target,
          difference,
          percentage,
          isSurplus: difference > 0,
          isDeficit: difference < 0
        }
      })
      return analysis
    })
    
    // Calculate historical averages (inflows - outflows per month, then averaged)
    const historicalAverages = computed(() => {
      const averages = {}
      CATEGORY_STEPS.forEach(category => {
        const categoryTransactions = transactions.value
          .filter(tx => tx.category === category)
        
        if (categoryTransactions.length === 0) {
          averages[category] = 0
          return
        }
        
        // Group by month and calculate monthly net (inflows - outflows)
        const monthlyTotals = {}
        categoryTransactions.forEach(tx => {
          const month = tx.date.slice(0, 7) // YYYY-MM
          if (!monthlyTotals[month]) {
            monthlyTotals[month] = { inflows: 0, outflows: 0 }
          }
          if (tx.inflow === 1) {
            monthlyTotals[month].inflows += Number(tx.amount)
          } else {
            monthlyTotals[month].outflows += Number(tx.amount)
          }
        })
        
        // Calculate net for each month (inflows - outflows)
        const monthlyValues = Object.values(monthlyTotals).map(month => month.inflows - month.outflows)
        averages[category] = monthlyValues.length > 0 
          ? monthlyValues.reduce((sum, val) => sum + val, 0) / monthlyValues.length
          : 0
      })
      return averages
    })
    
    // Check if targets sum to 100%
    const targetsValid = computed(() => {
      const total = Object.values(targets.value).reduce((sum, val) => sum + val, 0)
      return Math.abs(total - 100) < 0.01
    })
    
    // Load transactions
    const loadTransactions = async () => {
      try {
        loading.value = true
        const params = {}
        if (props?.startDate) params.start = props.startDate
        if (props?.endDate) params.end = props.endDate
        transactions.value = await api.listTransactions(params)
      } catch (error) {
        console.error('Error loading transactions:', error)
      } finally {
        loading.value = false
      }
    }
    
    // Load targets from backend
    const loadTargets = async () => {
      try {
        const saved = await api.getCategoryTargets()
        if (saved) {
          targets.value = { ...targets.value, ...saved }
        }
      } catch (error) {
        console.error('Error loading saved targets:', error)
        // Keep defaults if loading fails
      }
    }
    
    // Save targets to backend
    const saveTargets = async () => {
      try {
        await api.saveCategoryTargets(targets.value)
      } catch (error) {
        console.error('Error saving targets:', error)
        throw error // Re-throw so saveChanges can handle it
      }
    }
    
    // Start editing
    const startEditing = () => {
      editing.value = true
      tempTargets.value = { ...targets.value }
    }
    
    // Cancel editing
    const cancelEditing = () => {
      editing.value = false
      tempTargets.value = {}
    }
    
    // Save changes
    const saveChanges = async () => {
      if (targetsValid.value) {
        try {
          saving.value = true
          
          targets.value = { ...tempTargets.value }
          await saveTargets()
          editing.value = false
          tempTargets.value = {}
        } catch (error) {
          console.error('Failed to save targets:', error)
          // Optionally show error to user - for now just log it
        } finally {
          saving.value = false
        }
      }
    }
    
    // Reset to calculated defaults
    const resetToDefaults = async () => {
      try {
        saving.value = true
        const defaults = await api.getDefaultCategoryTargets()
        
        if (editing.value) {
          // If editing, update tempTargets
          tempTargets.value = { ...defaults }
        } else {
          // If not editing, update targets directly and save
          targets.value = { ...defaults }
          await saveTargets()
        }
      } catch (error) {
        console.error('Failed to reset to defaults:', error)
        // Optionally show error to user - for now just log it
      } finally {
        saving.value = false
      }
    }
    
    // Update target value
    const updateTarget = (category, value) => {
      const numValue = Math.max(0, Math.min(100, Number(value) || 0))
      tempTargets.value[category] = numValue
    }
    
    // Format currency
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD'
      }).format(amount)
    }
    
    // Format percentage (remove trailing zeros)
    const formatPercentage = (value) => {
      const formatted = value.toFixed(5)
      // Remove trailing zeros and trailing decimal point
      const trimmed = formatted.replace(/\.?0+$/, '')
      return `${trimmed}%`
    }
    
    onMounted(async () => {
      await loadTargets()
      await loadTransactions()
    })
    
    // Watch for transaction changes
    watch(() => transactions.value, () => {
      // Recalculate when transactions change
    })
    
    return {
      targets,
      tempTargets,
      transactions,
      loading,
      saving,
      editing,
      totalNetIncome,
      monthlyNetIncome,
      annualNetIncome,
      dateRange,
      monthlyActual,
      totalActual,
      lastMonthActual,
      lastMonthTarget,
      targetAmounts,
      monthlyTarget,
      totalTarget,
      categoryAnalysis,
      historicalAverages,
      targetsValid,
      CATEGORY_NAMES,
      CATEGORY_COLORS,
      CATEGORY_STEPS,
      loadTransactions,
      startEditing,
      cancelEditing,
      saveChanges,
      resetToDefaults,
      updateTarget,
      formatCurrency,
      formatPercentage
    }
  }
}
