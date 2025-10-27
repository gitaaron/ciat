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
    const editing = ref(false)
    const tempTargets = ref({})
    
    // Calculate net income from inflow transactions
    const netIncome = computed(() => {
      return transactions.value
        .filter(tx => tx.inflow === 1)
        .reduce((sum, tx) => sum + Number(tx.amount), 0)
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
    
    // Calculate target amounts based on net income
    const targetAmounts = computed(() => {
      const amounts = {}
      CATEGORY_STEPS.forEach(category => {
        amounts[category] = (netIncome.value * targets.value[category]) / 100
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
        const percentage = netIncome.value > 0 ? (actual / netIncome.value) * 100 : 0
        
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
    const saveChanges = () => {
      if (targetsValid.value) {
        targets.value = { ...tempTargets.value }
        saveTargets()
        editing.value = false
        tempTargets.value = {}
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
      editing,
      netIncome,
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
