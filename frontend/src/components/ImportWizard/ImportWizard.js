import { ref, computed } from 'vue'
import api from '../api.js'
import RulesReview from '../RulesReview/RulesReview.vue'
import AutoRulesReview from '../AutoRulesReview/AutoRulesReview.vue'

export default {
  name: 'ImportWizard',
  components: {
    RulesReview,
    AutoRulesReview
  },
  props: {
    accounts: Array
  },
  emits: ['refresh-accounts', 'import-complete'],
  setup(props, { emit }) {
    const newAccount = ref('')
    const step = ref(1) // 1: file selection, 2: account assignment, 3: auto rules, 4: review, 5: complete
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
    const files = ref([])
    const fileAnalysis = ref([])
    const filesByAccount = ref(new Map()) // Map<accountId, File[]>
    const previewsByAccount = ref(new Map()) // Map<accountId, preview[]>
    const usedRules = ref([])
    const autoRules = ref(null)
    const allTransactions = ref([])
    const isDragOver = ref(false)
    const processing = ref(false)
    const currentCategoryStep = ref(0) // 0: fixed, 1: investments, 2: guilt_free, 3: short_term
    const categorySteps = ['fixed_costs', 'investments', 'guilt_free', 'short_term_savings']
    const categoryStepNames = ['Fixed Costs', 'Investments', 'Guilt Free', 'Short Term Savings']

    // Validation rules for account names
    const accountNameRules = [
      v => !!v || 'Account name is required',
      v => (v && v.trim().length >= 2) || 'Account name must be at least 2 characters',
      v => (v && v.trim().length <= 50) || 'Account name must be less than 50 characters'
    ]

    const totalFiles = computed(() => files.value.length)

    const totalTransactions = computed(() => {
      let total = 0
      for (const preview of previewsByAccount.value.values()) {
        total += preview.length
      }
      return total
    })

    const currentCategoryTransactions = computed(() => {
      const allTransactions = []
      for (const preview of previewsByAccount.value.values()) {
        allTransactions.push(...preview)
      }
      return allTransactions.filter(tx => 
        !tx.ignore && 
        tx.category === categorySteps[currentCategoryStep.value]
      )
    })

    const hasMoreCategories = computed(() => {
      return currentCategoryStep.value < categorySteps.length - 1
    })

    const hasPreviousCategories = computed(() => {
      return currentCategoryStep.value > 0
    })

    const allFilesAssigned = computed(() => {
      return fileAnalysis.value.every((analysis, index) => {
        return getCurrentAccountId(index) !== null
      })
    })

    function getCurrentAccountId(fileIndex) {
      const file = files.value[fileIndex]
      for (const [accountId, accountFiles] of filesByAccount.value) {
        if (accountFiles.includes(file)) {
          return accountId
        }
      }
      return null
    }

    function getAccountName(accountId) {
      const account = props.accounts.find(a => a.id === accountId)
      return account ? account.name : 'Unknown Account'
    }

    function getFileFormat(filename) {
      const ext = filename.toLowerCase().split('.').pop()
      switch (ext) {
        case 'csv':
          return 'CSV'
        case 'qfx':
        case 'ofx':
          return 'QFX'
        default:
          return ext.toUpperCase()
      }
    }

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

    function handleDragOver(e) {
      e.preventDefault()
      isDragOver.value = true
    }

    function handleDragLeave(e) {
      e.preventDefault()
      isDragOver.value = false
    }

    function handleDrop(e) {
      e.preventDefault()
      isDragOver.value = false
      
      const droppedFiles = Array.from(e.dataTransfer.files).filter(file => {
        const filename = file.name.toLowerCase()
        return filename.endsWith('.csv') || filename.endsWith('.qfx') || filename.endsWith('.ofx')
      })
      
      if (droppedFiles.length === 0) {
        alert('Please drop a CSV or QFX file only')
        return
      }
      
      if (droppedFiles.length > 1) {
        alert('Please drop only one file at a time')
        return
      }
      
      files.value = [droppedFiles[0]] // Only keep the first file
      analyzeFiles()
    }

    function handleFileSelect(e) {
      const selectedFiles = Array.from(e.target.files).filter(file => {
        const filename = file.name.toLowerCase()
        return filename.endsWith('.csv') || filename.endsWith('.qfx') || filename.endsWith('.ofx')
      })
      
      if (selectedFiles.length === 0) {
        alert('Please select a CSV or QFX file only')
        return
      }
      
      if (selectedFiles.length > 1) {
        alert('Please select only one file at a time')
        return
      }
      
      files.value = [selectedFiles[0]] // Only keep the first file
      analyzeFiles()
    }

    async function analyzeFiles() {
      if (files.value.length === 0) return
      
      processing.value = true
      try {
        const result = await api.analyzeFiles(files.value)
        fileAnalysis.value = result.analysis
        
        // Auto-assign file based on suggestions
        filesByAccount.value.clear()
        const analysis = fileAnalysis.value[0] // Only one file now
        const file = files.value[0] // Only one file now
        if (file && analysis) {
          const accountId = analysis.suggestedAccount?.id || props.accounts[0]?.id
          if (accountId) {
            filesByAccount.value.set(accountId, [file])
          }
        }
        
        step.value = 2
      } catch (error) {
        console.error('Error analyzing files:', error)
        alert('Error analyzing files: ' + error.message)
      } finally {
        processing.value = false
      }
    }

    function removeFile(fileIndex) {
      files.value = []
      fileAnalysis.value = []
      filesByAccount.value.clear()
    }

    function reassignFile(fileIndex, newAccountId) {
      const file = files.value[fileIndex]
      
      // Clear current assignment and assign to new account
      filesByAccount.value.clear()
      filesByAccount.value.set(newAccountId, [file])
    }

    async function processAllFiles() {
      if (filesByAccount.value.size === 0) return
      
      processing.value = true
      previewsByAccount.value.clear()
      usedRules.value = []
      
      try {
        // Process the single file
        for (const [accountId, accountFiles] of filesByAccount.value) {
          const file = accountFiles[0] // Only one file now
          try {
            const res = await api.importCSV(accountId, file)
            previewsByAccount.value.set(accountId, res.preview)
            
            // Store used rules from the import
            if (res.usedRules) {
              usedRules.value = res.usedRules
            }
            
            // Store auto rules and all transactions
            if (res.autoRules) {
              autoRules.value = res.autoRules
            }
            
            // Collect all transactions for auto rules
            allTransactions.value = res.preview || []
          } catch (error) {
            console.error(`Error processing file ${file.name}:`, error)
            alert(`Error processing file ${file.name}: ${error.message}`)
          }
        }
        
        // Go to auto rules step if we have auto rules, otherwise go to review
        if (autoRules.value && autoRules.value.rules && autoRules.value.rules.length > 0) {
          step.value = 3 // Auto rules step
        } else {
          step.value = 4 // Review step
        }
        currentCategoryStep.value = 0
      } catch (error) {
        console.error('Error processing file:', error)
        alert('Error processing file: ' + error.message)
      } finally {
        processing.value = false
      }
    }

    function nextCategory() {
      if (hasMoreCategories.value) {
        currentCategoryStep.value++
      }
    }

    function previousCategory() {
      if (hasPreviousCategories.value) {
        currentCategoryStep.value--
      }
    }

    async function commitAllImports() {
      processing.value = true
      
      try {
        let totalImported = 0
        
        for (const [accountId, preview] of previewsByAccount.value) {
          const itemsToImport = preview.filter(x => !x.ignore)
          if (itemsToImport.length > 0) {
            await api.commitImport(itemsToImport)
            totalImported += itemsToImport.length
          }
        }
        
        // Clear everything
        files.value = []
        fileAnalysis.value = []
        filesByAccount.value.clear()
        previewsByAccount.value.clear()
        step.value = 4
        
        alert(`Import complete! ${totalImported} transactions imported.`)
        
        // Emit import complete event
        emit('import-complete')
        
        // Reset after a delay
        setTimeout(() => {
          step.value = 1
          currentCategoryStep.value = 0
        }, 2000)
        
      } catch (error) {
        console.error('Error committing imports:', error)
        alert('Error committing imports: ' + error.message)
      } finally {
        processing.value = false
      }
    }

    function resetImport() {
      files.value = []
      fileAnalysis.value = []
      filesByAccount.value.clear()
      previewsByAccount.value.clear()
      usedRules.value = []
      step.value = 1
      currentCategoryStep.value = 0
    }

    function handleRulesCommit() {
      commitAllImports()
    }

    function handleRulesCancel() {
      resetImport()
    }

    function handleRefreshRules() {
      // Refresh rules by reprocessing the import
      processAllFiles()
    }

    function handleAutoRulesSkip() {
      // Skip auto rules and go to review step
      step.value = 4
    }

    function handleAutoRulesApplied(result) {
      console.log('Auto rules applied:', result)
      // Go to review step after applying auto rules
      step.value = 4
    }

    return {
      newAccount,
      step,
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
      files,
      fileAnalysis,
      filesByAccount,
      previewsByAccount,
      usedRules,
      autoRules,
      allTransactions,
      isDragOver,
      processing,
      currentCategoryStep,
      categorySteps,
      categoryStepNames,
      accountNameRules,
      totalFiles,
      totalTransactions,
      currentCategoryTransactions,
      hasMoreCategories,
      hasPreviousCategories,
      allFilesAssigned,
      getCurrentAccountId,
      getAccountName,
      getFileFormat,
      addAccount,
      startEdit,
      cancelEdit,
      saveAccount,
      confirmDelete,
      deleteAccount,
      formatDate,
      handleDragOver,
      handleDragLeave,
      handleDrop,
      handleFileSelect,
      analyzeFiles,
      removeFile,
      reassignFile,
      processAllFiles,
      nextCategory,
      previousCategory,
      commitAllImports,
      resetImport,
      handleRulesCommit,
      handleRulesCancel,
      handleRefreshRules,
      handleAutoRulesSkip,
      handleAutoRulesApplied
    }
  }
}
