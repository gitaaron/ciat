import { ref } from 'vue'
import api from '../api.js'

export default {
  name: 'AccountManager',
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
      formatDate
    }
  }
}
