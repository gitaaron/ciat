import { ref, computed } from 'vue'
import api from '../api.js'
import FieldMapping from '../FieldMapping/FieldMapping.vue'

export default {
  name: 'AccountManager',
  components: {
    FieldMapping
  },
  props: {
    accounts: Array
  },
  emits: ['refresh-accounts'],
  setup(props, { emit }) {
    const newAccount = ref('')
    const creating = ref(false)
    const createError = ref('')
    const createForm = ref(null)
    const editingAccount = ref(null)
    const editAccountName = ref('')
    const editError = ref('')
    const updating = ref(false)
    const deleteDialog = ref(false)
    const accountToDelete = ref(null)
    const deleting = ref(false)
    const deleteError = ref('')
    
    // Field mapping dialog state
    const fieldMappingDialog = ref(false)
    const accountForFieldMapping = ref(null)
    const csvPreviewForMapping = ref(null)
    const fieldMappingValue = ref(null)
    const savingFieldMapping = ref(false)

    // Validation rules for account names
    const accountNameRules = [
      v => !!v || 'Account name is required',
      v => (v && v.trim().length >= 2) || 'Account name must be at least 2 characters',
      v => (v && v.trim().length <= 50) || 'Account name must be less than 50 characters'
    ]

    async function addAccount() {
      if (!newAccount.value.trim()) return
      
      creating.value = true
      createError.value = ''
      
      try {
        await api.createAccount(newAccount.value.trim())
        newAccount.value = ''
        // Reset form validation state
        if (createForm.value) {
          createForm.value.resetValidation()
        }
        await emit('refresh-accounts')
      } catch (error) {
        createError.value = error.response?.data?.error || 'Failed to create account'
      } finally {
        creating.value = false
      }
    }

    function startEdit(account) {
      editingAccount.value = account.id
      editAccountName.value = account.name
      editError.value = ''
    }

    function cancelEdit() {
      editingAccount.value = null
      editAccountName.value = ''
      editError.value = ''
    }

    async function saveAccount(accountId) {
      if (!editAccountName.value.trim()) return
      
      updating.value = true
      editError.value = ''
      
      try {
        await api.updateAccount(accountId, editAccountName.value.trim())
        editingAccount.value = null
        editAccountName.value = ''
        await emit('refresh-accounts')
      } catch (error) {
        editError.value = error.response?.data?.error || 'Failed to update account'
      } finally {
        updating.value = false
      }
    }

    function confirmDelete(account) {
      accountToDelete.value = account
      deleteError.value = ''
      deleteDialog.value = true
    }

    async function deleteAccount() {
      if (!accountToDelete.value) return
      
      deleting.value = true
      deleteError.value = ''
      
      try {
        await api.deleteAccount(accountToDelete.value.id)
        deleteDialog.value = false
        accountToDelete.value = null
        await emit('refresh-accounts')
      } catch (error) {
        deleteError.value = error.response?.data?.error || 'Failed to delete account'
      } finally {
        deleting.value = false
      }
    }

    function formatDate(dateString) {
      if (!dateString) return 'Unknown'
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return 'Unknown'
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    }
    
    async function openFieldMappingDialog(account) {
      accountForFieldMapping.value = account
      fieldMappingValue.value = account.field_mapping || null
      csvPreviewForMapping.value = null
      fieldMappingDialog.value = true
    }
    
    function closeFieldMappingDialog() {
      fieldMappingDialog.value = false
      accountForFieldMapping.value = null
      csvPreviewForMapping.value = null
      fieldMappingValue.value = null
    }
    
    async function handleCSVUploadForMapping(event) {
      const file = event.target.files[0]
      if (!file || !file.name.toLowerCase().endsWith('.csv')) {
        return
      }
      
      try {
        const preview = await api.previewCSV(file)
        csvPreviewForMapping.value = preview
        
        // Convert existing index-based mapping to display format for the FieldMapping component
        // Saved mapping format: { 0: 'date', 1: 'name', 2: 'outflow', 3: 'inflow' }
        if (accountForFieldMapping.value?.field_mapping) {
          const existingMapping = accountForFieldMapping.value.field_mapping
          
          // Convert index-based mapping to field->column format for initialMapping prop
          // The component expects: { date: 'ColumnName1', name: 'ColumnName2', ... }
          const fieldMapping = {}
          for (const [indexStr, field] of Object.entries(existingMapping)) {
            const index = parseInt(indexStr, 10)
            if (!isNaN(index) && index >= 0 && index < preview.columns.length) {
              const displayColumnName = preview.columns[index]
              if (displayColumnName) {
                fieldMapping[field] = displayColumnName
              }
            }
          }
          fieldMappingValue.value = fieldMapping
        } else {
          fieldMappingValue.value = null // Reset mapping to allow auto-detection
        }
      } catch (error) {
        console.error('Error previewing CSV:', error)
        alert('Error previewing CSV: ' + error.message)
      }
    }
    
    async function saveFieldMapping() {
      if (!accountForFieldMapping.value || !fieldMappingValue.value) return
      
      // Get index-based mapping from the component
      // fieldMappingValue is in field->column format, we need to convert to index-based
      const indexMapping = {}
      for (const [field, displayColumn] of Object.entries(fieldMappingValue.value)) {
        if (displayColumn) {
          const columnIndex = csvPreviewForMapping.value?.columns?.indexOf(displayColumn)
          if (columnIndex >= 0) {
            indexMapping[columnIndex] = field
          }
        }
      }
      
      savingFieldMapping.value = true
      try {
        await api.updateAccountFieldMapping(accountForFieldMapping.value.id, indexMapping)
        closeFieldMappingDialog()
        await emit('refresh-accounts')
      } catch (error) {
        console.error('Error saving field mapping:', error)
        alert('Error saving field mapping: ' + error.message)
      } finally {
        savingFieldMapping.value = false
      }
    }

    // Check if field mapping is complete (all required fields mapped)
    const isFieldMappingComplete = computed(() => {
      if (!fieldMappingValue.value || typeof fieldMappingValue.value !== 'object') return false
      
      // fieldMappingValue is in field->column format from the component
      // Check if all required fields are present
      return !!(fieldMappingValue.value.date && fieldMappingValue.value.name && 
                fieldMappingValue.value.inflow && fieldMappingValue.value.outflow)
    })

    return {
      // Reactive data
      newAccount,
      creating,
      createError,
      createForm,
      editingAccount,
      editAccountName,
      editError,
      updating,
      deleteDialog,
      accountToDelete,
      deleting,
      deleteError,
      accountNameRules,
      // Methods
      addAccount,
      startEdit,
      cancelEdit,
      saveAccount,
      confirmDelete,
      deleteAccount,
      formatDate,
      fieldMappingDialog,
      accountForFieldMapping,
      csvPreviewForMapping,
      fieldMappingValue,
      savingFieldMapping,
      openFieldMappingDialog,
      closeFieldMappingDialog,
      handleCSVUploadForMapping,
      saveFieldMapping,
      isFieldMappingComplete
    }
  }
}
