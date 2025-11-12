import { ref, computed, onMounted, watch } from 'vue'
import api from '../api.js'
import { CATEGORY_NAMES, CATEGORY_COLORS, CATEGORY_STEPS } from '../../config/categories.js'
import { calculateDateRange } from '../../utils/dateRange.js'

export default {
  name: 'CategoryTargets',
  setup() {
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
    
    // Calculate total net income from inflow transactions
    const totalNetIncome = computed(() => {
      return transactions.value
        .filter(tx => tx.inflow === 1)
        .reduce((sum, tx) => sum + Number(tx.amount), 0)
    })
    
    // Calculate date range from all transactions
    const dateRange = computed(() => {
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
    
    // Calculate surplus/deficit for each category (using monthly values)
    const categoryAnalysis = computed(() => {
      const analysis = {}
      CATEGORY_STEPS.forEach(category => {
        const actual = monthlyActual.value[category]
        const target = monthlyTarget.value[category]
        const difference = target - actual
        const percentage = monthlyNetIncome.value > 0 ? (actual / monthlyNetIncome.value) * 100 : 0
        
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
        transactions.value = await api.listTransactions()
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
    
    // Format percentage
    const formatPercentage = (value) => {
      return `${value.toFixed(1)}%`
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
      updateTarget,
      formatCurrency,
      formatPercentage
    }
  }
}
