import { ref, reactive, computed, onMounted } from 'vue'
import api from '../api.js'

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

    // Calculate total surplus from transactions
    const totalSurplus = computed(() => {
      const totalInflow = transactions.value
        .filter(tx => {
          const inflow = tx.inflow
          return inflow === 1 || inflow === true || inflow === '1'
        })
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
      
      const totalOutflow = transactions.value
        .filter(tx => {
          const inflow = tx.inflow
          return !(inflow === 1 || inflow === true || inflow === '1')
        })
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
      
      return totalInflow - totalOutflow
    })

    // Calculate total cost of all bucket list items
    const totalCost = computed(() => {
      return items.value.reduce((sum, item) => sum + Number(item.estimatedCost || 0), 0)
    })

    // Calculate affordability for each item (cascading)
    const itemsWithAffordability = computed(() => {
      let remainingSurplus = totalSurplus.value
      
      return items.value.map((item) => {
        const cost = item.estimatedCost || 0
        const newRemaining = remainingSurplus - cost
        const canAfford = newRemaining >= 0
        
        // Update remaining for next item
        remainingSurplus = newRemaining
        
        return {
          ...item,
          remainingSurplus: newRemaining,
          canAfford
        }
      })
    })

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
      loadTransactions
    }
  }
}

