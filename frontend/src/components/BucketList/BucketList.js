import { ref, reactive, computed, onMounted } from 'vue'
import api from '../api.js'
import { calculateShortTermSavingsDeviation } from '../../utils/shortTermSavingsDeviation.js'

export default {
  setup() {
    const items = ref([])
    const showDialog = ref(false)
    const showDeleteDialog = ref(false)
    const editingItem = ref(null)
    const itemToDelete = ref(null)
    const formValid = ref(false)
    const formRef = ref(null)
    const transactions = ref([])
    const loading = ref(false)
    const targets = ref({
      fixed_costs: 35,
      investments: 10,
      guilt_free: 40,
      short_term_savings: 15
    })
    const targetSavingsPercentage = ref(10) // Default 10%
    const showTargetSavingsDialog = ref(false)
    const editingTargetSavings = ref(false)

    const formData = reactive({
      name: '',
      description: '',
      estimatedCost: null
    })

    const rules = {
      required: (value) => {
        if (!value || !value.trim()) {
          return 'This field is required'
        }
        return true
      }
    }

    function formatCurrency(amount) {
      if (!amount && amount !== 0) return 'N/A'
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount)
    }

    // Calculate total surplus using the same calculation as short term savings deviation
    const totalSurplus = computed(() => {
      return calculateShortTermSavingsDeviation(transactions.value, targets.value)
    })

    // Calculate total cost of all bucket list items
    const totalCost = computed(() => {
      return items.value.reduce((sum, item) => sum + Number(item.estimatedCost || 0), 0)
    })

    // Calculate monthly spend (target short term monthly for last 6 months)
    const monthlySpend = computed(() => {
      if (transactions.value.length === 0) return 0
      
      // Get the date 6 months ago from today
      const today = new Date()
      const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, 1)
      const startDate = sixMonthsAgo.toISOString().split('T')[0]
      const endDate = today.toISOString().split('T')[0]
      
      // Filter transactions from last 6 months
      const last6MonthsTransactions = transactions.value.filter(tx => {
        if (!tx.date) return false
        return tx.date >= startDate && tx.date <= endDate
      })
      
      if (last6MonthsTransactions.length === 0) return 0
      
      // Calculate total net income from income transactions in last 6 months
      const totalNetIncome = last6MonthsTransactions
        .filter(tx => tx.category === 'income')
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
      
      // Calculate actual number of months in the date range (up to 6 months)
      const start = new Date(startDate)
      const end = new Date(endDate)
      const totalDays = (end - start) / (1000 * 60 * 60 * 24) // milliseconds to days
      const actualMonths = Math.max(totalDays / 30.4375, 0.1) // Minimum 0.1 to avoid division by zero
      const months = Math.min(actualMonths, 6) // Cap at 6 months
      
      // Calculate monthly net income
      const monthlyNetIncome = months > 0 ? totalNetIncome / months : 0
      
      // Calculate monthly target for short_term_savings
      const monthlyTarget = (monthlyNetIncome * (targets.value.short_term_savings || 0)) / 100
      
      return monthlyTarget
    })

    // Calculate target savings (monthly spend * targetSavingsPercentage / 100)
    const targetSavings = computed(() => {
      return (monthlySpend.value * targetSavingsPercentage.value) / 100
    })

    // Calculate affordability for each item (cascading)
    const itemsWithAffordability = computed(() => {
      let remainingSurplus = totalSurplus.value
      
      return items.value.map((item) => {
        const cost = item.estimatedCost || 0
        const newRemaining = remainingSurplus - cost
        const canAfford = newRemaining >= 0
        
        // Calculate months to afford if remaining is negative
        let monthsToAfford = null
        if (newRemaining < 0 && targetSavings.value > 0) {
          monthsToAfford = Math.ceil(Math.abs(newRemaining) / targetSavings.value)
        }
        
        // Update remaining for next item
        remainingSurplus = newRemaining
        
        return {
          ...item,
          remainingSurplus: newRemaining,
          canAfford,
          monthsToAfford
        }
      })
    })

    // Load category targets
    async function loadTargets() {
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

    // Load target savings percentage
    async function loadTargetSavings() {
      try {
        const saved = await api.getTargetSavings()
        if (saved && typeof saved.percentage === 'number') {
          targetSavingsPercentage.value = saved.percentage
        }
      } catch (error) {
        console.error('Error loading target savings:', error)
        // Keep default if loading fails
      }
    }

    // Save target savings percentage
    async function saveTargetSavings() {
      try {
        loading.value = true
        await api.saveTargetSavings(targetSavingsPercentage.value)
        editingTargetSavings.value = false
        showTargetSavingsDialog.value = false
      } catch (error) {
        console.error('Error saving target savings:', error)
        // Keep dialog open on error so user can retry
      } finally {
        loading.value = false
      }
    }

    // Start editing target savings
    function startEditingTargetSavings() {
      editingTargetSavings.value = true
      showTargetSavingsDialog.value = true
    }

    // Cancel editing target savings
    function cancelEditingTargetSavings() {
      editingTargetSavings.value = false
      showTargetSavingsDialog.value = false
      // Reload to reset any changes
      loadTargetSavings()
    }

    // Load transactions to calculate surplus
    async function loadTransactions() {
      try {
        loading.value = true
        transactions.value = await api.listTransactions({})
      } catch (error) {
        console.error('Error loading transactions:', error)
        transactions.value = []
      } finally {
        loading.value = false
      }
    }

    async function loadItems() {
      try {
        loading.value = true
        const data = await api.getBucketListItems()
        // Map database field names to frontend field names
        items.value = data.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          estimatedCost: item.estimated_cost,
          createdAt: item.created_at
        }))
      } catch (error) {
        console.error('Error loading bucket list items:', error)
        items.value = []
      } finally {
        loading.value = false
      }
    }

    function openAddDialog() {
      editingItem.value = null
      formData.name = ''
      formData.description = ''
      formData.estimatedCost = null
      showDialog.value = true
    }

    function openEditDialog(item) {
      editingItem.value = item
      formData.name = item.name
      formData.description = item.description || ''
      formData.estimatedCost = item.estimatedCost || null
      showDialog.value = true
    }

    function closeDialog() {
      showDialog.value = false
      editingItem.value = null
      formData.name = ''
      formData.description = ''
      formData.estimatedCost = null
      if (formRef.value) {
        formRef.value.resetValidation()
      }
    }

    async function saveItem() {
      if (!formValid.value) return

      try {
        loading.value = true
        if (editingItem.value) {
          // Update existing item
          const updated = await api.updateBucketListItem(editingItem.value.id, {
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            estimatedCost: formData.estimatedCost || null
          })
          // Map database field names to frontend field names
          const index = items.value.findIndex(item => item.id === editingItem.value.id)
          if (index !== -1) {
            items.value[index] = {
              id: updated.id,
              name: updated.name,
              description: updated.description,
              estimatedCost: updated.estimated_cost,
              createdAt: updated.created_at
            }
          }
        } else {
          // Add new item
          const newItem = await api.createBucketListItem({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            estimatedCost: formData.estimatedCost || null
          })
          // Map database field names to frontend field names
          items.value.push({
            id: newItem.id,
            name: newItem.name,
            description: newItem.description,
            estimatedCost: newItem.estimated_cost,
            createdAt: newItem.created_at
          })
        }
        closeDialog()
      } catch (error) {
        console.error('Error saving bucket list item:', error)
        // Keep dialog open on error so user can retry
      } finally {
        loading.value = false
      }
    }

    function confirmDelete(item) {
      itemToDelete.value = item
      showDeleteDialog.value = true
    }

    async function deleteItem() {
      if (itemToDelete.value) {
        try {
          loading.value = true
          await api.deleteBucketListItem(itemToDelete.value.id)
          const index = items.value.findIndex(item => item.id === itemToDelete.value.id)
          if (index !== -1) {
            items.value.splice(index, 1)
          }
        } catch (error) {
          console.error('Error deleting bucket list item:', error)
        } finally {
          loading.value = false
        }
      }
      showDeleteDialog.value = false
      itemToDelete.value = null
    }

    return {
      items,
      showDialog,
      showDeleteDialog,
      editingItem,
      itemToDelete,
      formData,
      formValid,
      formRef,
      rules,
      formatCurrency,
      loadItems,
      openAddDialog,
      openEditDialog,
      closeDialog,
      saveItem,
      confirmDelete,
      deleteItem,
      transactions,
      loading,
      totalSurplus,
      totalCost,
      itemsWithAffordability,
      loadTransactions,
      loadTargets,
      monthlySpend,
      targetSavings,
      targetSavingsPercentage,
      showTargetSavingsDialog,
      editingTargetSavings,
      loadTargetSavings,
      saveTargetSavings,
      startEditingTargetSavings,
      cancelEditingTargetSavings
    }
  }
}

