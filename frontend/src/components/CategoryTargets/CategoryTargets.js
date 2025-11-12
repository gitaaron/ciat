import { ref, computed, onMounted, watch } from 'vue'
import api from '../api.js'
import { CATEGORY_NAMES, CATEGORY_COLORS, CATEGORY_STEPS } from '../../config/categories.js'

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
      if (transactions.value.length === 0) {
        return { start: null, end: null, months: 0, years: 0 }
      }
      
      const dates = transactions.value
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
    
    // Calculate actual spending by category
    const actualSpending = computed(() => {
      const spending = {}
      CATEGORY_STEPS.forEach(category => {
        spending[category] = transactions.value
          .filter(tx => tx.category === category && tx.inflow === 0)
          .reduce((sum, tx) => sum + Number(tx.amount), 0)
      })
      return spending
    })
    
    // Calculate target amounts based on monthly net income
    const targetAmounts = computed(() => {
      const amounts = {}
      CATEGORY_STEPS.forEach(category => {
        amounts[category] = (monthlyNetIncome.value * targets.value[category]) / 100
      })
      return amounts
    })
    
    // Calculate surplus/deficit for each category
    const categoryAnalysis = computed(() => {
      const analysis = {}
      CATEGORY_STEPS.forEach(category => {
        const actual = actualSpending.value[category]
        const target = targetAmounts.value[category]
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
    
    // Calculate historical averages
    const historicalAverages = computed(() => {
      const averages = {}
      CATEGORY_STEPS.forEach(category => {
        const categoryTransactions = transactions.value
          .filter(tx => tx.category === category && tx.inflow === 0)
        
        if (categoryTransactions.length === 0) {
          averages[category] = 0
          return
        }
        
        // Group by month and calculate monthly averages
        const monthlyTotals = {}
        categoryTransactions.forEach(tx => {
          const month = tx.date.slice(0, 7) // YYYY-MM
          if (!monthlyTotals[month]) {
            monthlyTotals[month] = 0
          }
          monthlyTotals[month] += Number(tx.amount)
        })
        
        const monthlyValues = Object.values(monthlyTotals)
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
    
    // Load targets from localStorage
    const loadTargets = () => {
      const saved = localStorage.getItem('categoryTargets')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          targets.value = { ...targets.value, ...parsed }
        } catch (error) {
          console.error('Error loading saved targets:', error)
        }
      }
    }
    
    // Save targets to localStorage
    const saveTargets = () => {
      localStorage.setItem('categoryTargets', JSON.stringify(targets.value))
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
          // Simulate a small delay for better UX
          await new Promise(resolve => setTimeout(resolve, 500))
          
          targets.value = { ...tempTargets.value }
          saveTargets()
          editing.value = false
          tempTargets.value = {}
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
    
    onMounted(() => {
      loadTargets()
      loadTransactions()
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
      actualSpending,
      targetAmounts,
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
