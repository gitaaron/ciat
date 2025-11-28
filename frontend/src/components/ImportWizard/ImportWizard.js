import { ref, computed, nextTick } from 'vue'
import api from '../api.js'
import { CATEGORY_STEPS, CATEGORY_NAMES } from '../../config/categories.js'
import ManageRules from '../RulesReview/ManageRules.vue'
import TransactionReview from '../TransactionReview/TransactionReview.vue'
import AccountManager from '../AccountManager/AccountManager.vue'
import FieldMapping from '../FieldMapping/FieldMapping.vue'
import FinalBalanceDialog from '../shared/FinalBalanceDialog.vue'
import { getUnmatchedTransactions, applyRulesWithDetails, getTransactionsForRule } from '../../utils/ruleMatcher.js'
import { showError, showSuccess, showWarning, showInfo, showDeleteConfirm, showInfoDialog } from '../../utils/notifications.js'

// Simple hash function for transaction hashing (matches backend logic)
// Use account_name instead of account_id for stable hashing across DB recreations
function txHash({ external_id, account_name, date, name, description, amount, inflow }) {
  const raw = JSON.stringify({ external_id, account_name, date, name, description, amount, inflow })
  // Simple hash using string manipulation (for browser compatibility)
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).slice(0, 32)
}

export default {
  name: 'ImportWizard',
  components: {
    ManageRules,
    TransactionReview,
    AccountManager,
    FieldMapping,
    FinalBalanceDialog
  },
  props: {
    accounts: Array,
    debugMode: {
      type: Boolean,
      default: false
    },
    debugStep: {
      type: Number,
      default: 1
    }
  },
  emits: ['refresh-accounts', 'import-complete'],
  setup(props, { emit }) {
    const step = ref(1) // 1: file selection, 2: account assignment, 2.5: field mapping (CSV only, if needed), 3: rules review, 4: transaction review, 5: complete
    const files = ref([])
    const fileAnalysis = ref([])
    const filesByAccount = ref(new Map()) // Map<accountId, File[]>
    const previewsByAccount = ref(new Map()) // Map<accountId, preview[]>
    const usedRules = ref([])
    const autoRules = ref(null)
    const newRules = ref([])
    const allTransactions = ref([])
    const systemRules = ref([])
    const manualOverrides = ref({}) // Store manual overrides for rule application
    
    // Field mapping state
    const csvPreview = ref(null) // { columns: [], preview: [] }
    const fieldMapping = ref(null) // { date, name, inflow, outflow }
    const showFieldMappingStep = ref(false) // Show field mapping step before processing
    const pendingFileForProcessing = ref(null) // File waiting to be processed after field mapping
    const pendingAccountForProcessing = ref(null) // Account waiting to be processed after field mapping
    const pendingImportResult = ref(null) // Import result stored when checking for new transactions
    const fieldMappingComponent = ref(null) // Reference to FieldMapping component
    
    // Final balance dialog state
    const showFinalBalanceDialog = ref(false)
    const pendingTransactionsForBalance = ref([]) // Transactions to calculate balance from
    const initialBalanceTransaction = ref(null) // Calculated initial balance transaction
    
    // Centralized rule matching results
    const existingRuleMatches = ref(new Map())
    const newRuleMatches = ref(new Map())
    const autoRuleMatches = ref(new Map())
    const isDragOver = ref(false)
    const processing = ref(false)
    const ruleSaving = ref(new Set()) // Track which rules are being saved
    const currentCategoryStep = ref(0) // 0: fixed, 1: investments, 2: guilt_free, 3: short_term
    const categorySteps = CATEGORY_STEPS
    const categoryStepNames = CATEGORY_STEPS.map(step => CATEGORY_NAMES[step])
    
    /**
     * Centralized function to compute all rule matches with proper priority handling
     * This ensures no transaction double-counting and respects rule priorities
     */
    function computeAllRuleMatches() {
      if (!allTransactions.value || allTransactions.value.length === 0) {
        return
      }

      // Get all rules from different sources
      const existingRules = usedRules.value || []
      const newRulesList = newRules.value || []
      const autoRulesList = autoRules.value?.rules?.filter(r => !r.applied) || []
      const systemRulesList = systemRules.value || []

      // Combine all rules and sort by priority
      const allRules = [
        ...existingRules.map(rule => ({ ...rule, source: 'existing' })),
        ...newRulesList.map(rule => ({ ...rule, source: 'new' })),
        ...autoRulesList.map(rule => ({ ...rule, source: 'auto' })),
        ...systemRulesList.map(rule => ({ ...rule, source: 'system' }))
      ].sort((a, b) => {
        // Sort by priority (highest first)
        if (b.priority !== a.priority) return b.priority - a.priority
        // If same priority, most recent wins
        const aTime = new Date(a.updated_at || a.created_at || 0).getTime()
        const bTime = new Date(b.updated_at || b.created_at || 0).getTime()
        return bTime - aTime
      })

      // Use centralized rule matching logic
      // Pass skipSort=true since rules are already sorted above
      // Include manual overrides if available
      const result = applyRulesWithDetails(allTransactions.value, allRules, { 
        skipSort: true,
        manualOverrides: manualOverrides.value || {}
      });
      
      // Update previewsByAccount with fully categorized transactions
      // Group categorized transactions by account_id
      // Transactions from API should have account_id, but we'll use hash lookup as fallback
      const hashToAccount = new Map()
      for (const [accountId, transactions] of previewsByAccount.value) {
        for (const transaction of transactions) {
          if (transaction.hash) {
            hashToAccount.set(transaction.hash, accountId)
          }
        }
      }
      
      const transactionsByAccount = new Map()
      for (const transaction of result.categorizedTransactions) {
        // Use account_id from transaction (should be present from API), or fallback to hash lookup
        const accountId = transaction.account_id || hashToAccount.get(transaction.hash)
        if (accountId) {
          if (!transactionsByAccount.has(accountId)) {
            transactionsByAccount.set(accountId, [])
          }
          transactionsByAccount.get(accountId).push(transaction)
        } else {
          console.warn('Transaction missing account_id and not found in hash map:', transaction.hash)
        }
      }
      
      // Update previewsByAccount with fully categorized transactions
      previewsByAccount.value.clear()
      for (const [accountId, transactions] of transactionsByAccount) {
        previewsByAccount.value.set(accountId, transactions)
      }
      
      // Separate matches by rule source
      // Create new Maps to ensure Vue reactivity detects the changes
      const newExistingMatches = new Map()
      const newNewMatches = new Map()
      const newAutoMatches = new Map()
      
      for (const [ruleId, matchingTransactions] of result.ruleMatches) {
        const rule = allRules.find(r => r.id === ruleId)
        if (!rule) {
          console.warn('computeAllRuleMatches: Rule not found in allRules:', ruleId)
          continue
        }
        
        switch (rule.source) {
          case 'existing':
            newExistingMatches.set(ruleId, matchingTransactions)
            break
          case 'new':
            newNewMatches.set(ruleId, matchingTransactions)
            break
          case 'auto':
            newAutoMatches.set(ruleId, matchingTransactions)
            break
        }
      }
      
      // Replace the entire Map refs to ensure Vue detects the changes
      existingRuleMatches.value = newExistingMatches
      newRuleMatches.value = newNewMatches
      autoRuleMatches.value = newAutoMatches
    }

    // Debug mode: override step if debugStep prop is provided
    if (props.debugMode && props.debugStep) {
      step.value = props.debugStep
    }
    
    // Debug mode: initialize mock data
    if (props.debugMode) {
      // Set up mock files and analysis
      files.value = [new File(['mock data'], 'test.csv', { type: 'text/csv' })]
      fileAnalysis.value = [{
        filename: 'test.csv',
        size: 1024,
        format: 'csv',
        formatDisplayName: 'CSV',
        isSupported: true,
        suggestedAccount: { account: { id: 1, name: 'Test Account' }, score: 0.8 },
        confidence: 0.8,
        suggestedName: 'Test Account'
      }]
      
      // Set up mock account assignment
      filesByAccount.value.set(1, files.value)
      
      // Set up mock transactions from shared_visa_aventura.csv
      // In debug mode, fetch transactions from the stub server which returns
      // the actual transactions from shared_visa_aventura.csv
      ;(async () => {
        try {
          // Create a mock FormData with test.csv to trigger the stub server
          const formData = new FormData()
          formData.append('file', new File(['test'], 'test.csv', { type: 'text/csv' }))
          formData.append('account_id', '1')
          
          const response = await api.importTransactions(formData)
          const mockTransactions = response.preview || []
          
          previewsByAccount.value.set(1, mockTransactions)
          allTransactions.value = mockTransactions
        } catch (error) {
          console.error('Error loading debug transactions from stub server:', error)
          // Fallback to empty array if API call fails
          previewsByAccount.value.set(1, [])
          allTransactions.value = []
        }
      })()
      
      // Set up mock auto rules
      autoRules.value = {
        rules: [
          {
            id: 'auto_stub_1',
            match_type: 'contains',
            pattern: 'york square',
            category: 'fixed_costs',
            support: 2,
            applied: false,
            enabled: true,
            explain: 'auto',
            source: 'frequency_analysis',
            priority: 500,
            labels: [],
            actualMatches: 2,
            matchingTransactions: ['test1', 'test5']
          },
          {
            id: 'auto_stub_2',
            match_type: 'contains',
            pattern: 'smoque bones',
            category: 'guilt_free',
            support: 1,
            applied: false,
            enabled: true,
            explain: 'auto',
            source: 'frequency_analysis',
            priority: 500,
            labels: [],
            actualMatches: 1,
            matchingTransactions: ['test2']
          },
          {
            id: 'auto_stub_3',
            match_type: 'contains',
            pattern: 'amazon channels',
            category: 'fixed_costs',
            support: 1,
            applied: false,
            enabled: true,
            explain: 'auto',
            source: 'frequency_analysis',
            priority: 500,
            labels: [],
            actualMatches: 1,
            matchingTransactions: ['test4']
          },
          {
            id: 'auto_stub_4',
            match_type: 'contains',
            pattern: 'jian hing',
            category: 'fixed_costs',
            support: 1,
            applied: false,
            enabled: true,
            explain: 'auto',
            source: 'frequency_analysis',
            priority: 500,
            labels: [],
            actualMatches: 1,
            matchingTransactions: ['test3']
          }
        ],
        analysis: {},
        stats: {
          totalTransactions: 5,
          rulesGenerated: 4,
          frequencyRules: 4,
          mccRules: 0,
          merchantIdRules: 0,
          recurringRules: 0,
          marketplaceRules: 0,
          exceptionRules: 0,
          rulesWithMatches: 4,
          rulesFilteredOut: 0
        },
        previews: []
      }
      
      // Compute rule matches for debug mode
      computeAllRuleMatches()
    }


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
        showWarning('Please drop a CSV or QFX file only')
        return
      }
      
      if (droppedFiles.length > 1) {
        showWarning('Please drop only one file at a time')
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
        showWarning('Please select a CSV or QFX file only')
        return
      }
      
      if (selectedFiles.length > 1) {
        showWarning('Please select only one file at a time')
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
        showError('Error analyzing files: ' + error.message)
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
      
      try {
        // First, import the file to check if there are any new transactions
        // This check happens BEFORE field mapping so we can show the "no new transactions" dialog immediately
        for (const [accountId, accountFiles] of filesByAccount.value) {
          const file = accountFiles[0]
          
          try {
            // Import transactions to check for duplicates
            const res = await api.importCSV(accountId, file)
            const rawTransactions = res.preview || []
            
            // Check if no new transactions were imported
            const hasNoNewTransactions = rawTransactions.length === 0 || 
                                        (res.newTransactions !== undefined && res.newTransactions === 0) ||
                                        (res.totalTransactions !== undefined && res.duplicatesSkipped !== undefined && 
                                         res.totalTransactions > 0 && res.duplicatesSkipped === res.totalTransactions)
            
            if (hasNoNewTransactions) {
              processing.value = false
              
              // Show dialog and reset import interface after user closes it
              await showInfoDialog(
                'All transactions in this file have already been imported. There are no new transactions to add.',
                'No New Transactions',
                'Back to Import'
              )
              
              // Reset the import interface
              resetImport()
              return
            }
            
            // There are new transactions, so continue with the flow
            // Store the import result for later use
            pendingFileForProcessing.value = file
            pendingAccountForProcessing.value = accountId
            pendingImportResult.value = res
          } catch (error) {
            console.error('Error importing file:', error)
            showError('Error importing file: ' + error.message)
            processing.value = false
            return
          }
        }
        
        // Now check if we need field mapping for CSV files (only if there are new transactions)
        for (const [accountId, accountFiles] of filesByAccount.value) {
          const file = accountFiles[0]
          const account = props.accounts.find(a => a.id === accountId)
          
          // If CSV file and account has no field mapping, show field mapping step
          if (file.name.toLowerCase().endsWith('.csv') && account && !account.field_mapping) {
            try {
              // Preview CSV for field mapping
              const preview = await api.previewCSV(file)
              csvPreview.value = preview
              fieldMapping.value = null
              showFieldMappingStep.value = true
              processing.value = false
              return // Wait for user to confirm field mapping
            } catch (error) {
              console.error('Error previewing CSV:', error)
              showError('Error previewing CSV: ' + error.message)
            }
          }
        }
        
        // No field mapping needed, proceed with processing
        await doProcessAllFiles()
      } catch (error) {
        console.error('Error in processAllFiles:', error)
        showError('Error processing files: ' + error.message)
        processing.value = false
      }
    }
    
    async function doProcessAllFiles() {
      processing.value = true
      previewsByAccount.value.clear()
      usedRules.value = []
      
      try {
        // Process the single file
        for (const [accountId, accountFiles] of filesByAccount.value) {
          const file = accountFiles[0] // Only one file now
          try {
            // Use the import result if we already have it (from processAllFiles check)
            // Otherwise import again
            let res = pendingImportResult.value
            if (!res) {
              res = await api.importCSV(accountId, file)
            }
            // Clear the pending result after using it
            pendingImportResult.value = null
            
            let rawTransactions = res.preview || []
            
            // Add initial balance transaction if it exists (for first import)
            if (initialBalanceTransaction.value) {
              // Insert at the beginning so it's the earliest transaction
              rawTransactions = [initialBalanceTransaction.value, ...rawTransactions]
              // Clear it after using
              initialBalanceTransaction.value = null
            }
            
            // Load existing rules and system rules from backend
            const existingRules = await api.getRules()
            const systemRulesList = await api.getSystemRules()
            systemRules.value = systemRulesList
            
            // Load manual overrides from backend (highest priority)
            manualOverrides.value = await api.getManualOverrides()
            
            const allRules = [...existingRules, ...systemRulesList]
            
            // Apply rules to transactions using centralized logic with manual overrides
            const ruleMatchingResult = applyRulesWithDetails(rawTransactions, allRules, {
              manualOverrides: manualOverrides.value || {}
            })
            const categorizedTransactions = ruleMatchingResult.categorizedTransactions
            
            // Get unmatched transactions for auto rule generation (use allRules to include system rule)
            const unmatchedTransactions = getUnmatchedTransactions(rawTransactions, allRules)
            
            // Generate auto rules for unmatched transactions
            // Send raw transactions so auto rule generator can learn from actual transaction patterns
            let autoRulesResult = null
            if (unmatchedTransactions.length >= 0) {
              try {
                autoRulesResult = await api.generateAutoRules(rawTransactions)
              } catch (error) {
                console.warn('Auto rule generation failed:', error)
              }
            }
            
            // Store the categorized transactions
            previewsByAccount.value.set(accountId, categorizedTransactions)
            
            // Store the existing rules (without transactions - they'll come from centralized matching)
            usedRules.value = existingRules
            
            // Store auto rules
            autoRules.value = autoRulesResult
            
            // Store raw transactions for AutoGeneratedRulesReview to work with
            allTransactions.value = rawTransactions
            
            // Compute all rule matches with proper priority handling
            computeAllRuleMatches()
            
            // Filter rules to only show those with matches
            usedRules.value = usedRules.value.filter(rule => {
              const matches = existingRuleMatches.value.get(rule.id) || []
              return matches.length > 0
            })
            
            // Auto rules are now filtered in the backend - no frontend filtering needed
            
            // Note: newRules.value starts empty, so no filtering needed here
          } catch (error) {
            console.error(`Error processing file ${file.name}:`, error)
            showError(`Error processing file ${file.name}: ${error.message}`)
          }
        }
        
        // Go to combined rules review step
        step.value = 3 // Combined rules review step
        currentCategoryStep.value = 0
      } catch (error) {
        console.error('Error processing file:', error)
        showError('Error processing file: ' + error.message)
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
          // Import all transactions (transfers are now labeled, not filtered out)
          if (preview.length > 0) {
            console.log('commitAllImports: Committing imports:', preview.length)
            await api.commitImport(preview)
            totalImported += preview.length
          }
        }
        
        // Clear everything
        files.value = []
        fileAnalysis.value = []
        filesByAccount.value.clear()
        previewsByAccount.value.clear()
        step.value = 5
        
        showSuccess(`Import complete! ${totalImported} transactions imported.`)
        
        // Emit import complete event
        emit('import-complete')
        
        // Reset after a delay
        setTimeout(() => {
          step.value = 1
          currentCategoryStep.value = 0
        }, 2000)
        
      } catch (error) {
        console.error('Error committing imports:', error)
        showError('Error committing imports: ' + error.message)
      } finally {
        processing.value = false
      }
    }

    async function handleFieldMappingConfirmed(mapping) {
      // mapping is index-based format: { 0: 'date', 1: 'name', 2: 'outflow', 3: 'inflow' }
      // Get it from the component if not provided directly
      const indexMapping = mapping || fieldMappingComponent.value?.getIndexMapping?.() || {}
      
      console.log('Field mapping confirmed:', {
        indexMapping,
        csvColumns: csvPreview.value?.columns
      })
      
      // Store the index-based mapping
      fieldMapping.value = indexMapping
      
      // Save mapping to account (using index-based mapping)
      if (pendingAccountForProcessing.value && indexMapping) {
        try {
          await api.updateAccountFieldMapping(pendingAccountForProcessing.value, indexMapping)
          showSuccess('Field mapping saved to account')
          // Refresh accounts to get updated field_mapping
          await emit('refresh-accounts')
        } catch (error) {
          console.error('Error saving field mapping:', error)
          showWarning('Field mapping could not be saved, but will be used for this import')
        }
      }
      
      // Hide field mapping step
      showFieldMappingStep.value = false
      // Wait for the dialog to close before proceeding
      await nextTick()
      // Add a small delay to ensure persistent dialog closes completely
      await new Promise(resolve => setTimeout(resolve, 150))
      
      // Check if this is the first import for the account
      if (pendingAccountForProcessing.value) {
        try {
          const hasTransactions = await api.accountHasTransactions(pendingAccountForProcessing.value)
          if (!hasTransactions.hasTransactions) {
            // This is the first import - we need to get the transactions first to show the dialog
            // Import the file to get the transactions
            const res = await api.importCSV(pendingAccountForProcessing.value, pendingFileForProcessing.value)
            const rawTransactions = res.preview || []
            
            if (rawTransactions.length > 0) {
              // Store transactions and show final balance dialog
              pendingTransactionsForBalance.value = rawTransactions
              pendingImportResult.value = res
              showFinalBalanceDialog.value = true
              return // Wait for user to confirm final balance
            }
          }
        } catch (error) {
          console.error('Error checking if account has transactions:', error)
          // Continue with normal flow if check fails
        }
      }
      
      // Not first import or no transactions, proceed normally
      await doProcessAllFiles()
    }
    
    async function handleFieldMappingSkip() {
      // Skip field mapping, use defaults (no mapping)
      fieldMapping.value = null
      showFieldMappingStep.value = false
      // Wait for the dialog to close before proceeding
      await nextTick()
      // Add a small delay to ensure persistent dialog closes completely
      await new Promise(resolve => setTimeout(resolve, 150))
      
      // Check if this is the first import for the account
      if (pendingAccountForProcessing.value) {
        try {
          const hasTransactions = await api.accountHasTransactions(pendingAccountForProcessing.value)
          if (!hasTransactions.hasTransactions) {
            // This is the first import - we need to get the transactions first to show the dialog
            // Import the file to get the transactions
            const res = await api.importCSV(pendingAccountForProcessing.value, pendingFileForProcessing.value)
            const rawTransactions = res.preview || []
            
            if (rawTransactions.length > 0) {
              // Store transactions and show final balance dialog
              pendingTransactionsForBalance.value = rawTransactions
              pendingImportResult.value = res
              showFinalBalanceDialog.value = true
              return // Wait for user to confirm final balance
            }
          }
        } catch (error) {
          console.error('Error checking if account has transactions:', error)
          // Continue with normal flow if check fails
        }
      }
      
      // Not first import or no transactions, proceed normally
      await doProcessAllFiles()
    }
    
    async function handleFinalBalanceConfirmed(balanceData) {
      // Calculate initial balance transaction
      const { finalBalance, initialBalance, earliestDate } = balanceData
      
      // Calculate transaction sum to verify
      const transactionSum = pendingTransactionsForBalance.value.reduce((sum, tx) => {
        return sum + (parseFloat(tx.amount) || 0)
      }, 0)
      
      // Create initial balance transaction
      // The amount should be the initial balance (which is finalBalance - transactionSum)
      // If initialBalance is positive, it's an inflow; if negative, it's an outflow
      // Use account_name instead of account_id for stable hashing across DB recreations
      const accountName = getAccountName(pendingAccountForProcessing.value)
      const initialTx = {
        account_id: pendingAccountForProcessing.value,
        date: earliestDate,
        name: 'Initial Balance',
        description: 'Initial balance transaction to match final balance',
        amount: initialBalance, // This will be positive for inflow, negative for outflow
        inflow: initialBalance >= 0 ? 1 : 0, // 1 for inflow, 0 for outflow
        category: 'transfer', // Initial balance is typically a transfer
        category_source: 'manual',
        category_explain: `Initial balance to achieve final balance of $${finalBalance.toFixed(2)}`,
        labels: ['initial_balance'],
        hash: txHash({
          external_id: null,
          account_name: accountName,
          date: earliestDate,
          name: 'Initial Balance',
          description: 'Initial balance transaction to match final balance',
          amount: initialBalance,
          inflow: initialBalance >= 0 ? 1 : 0
        })
      }
      
      // Store the initial balance transaction
      initialBalanceTransaction.value = initialTx
      
      // Close dialog and proceed with processing
      showFinalBalanceDialog.value = false
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 150))
      await doProcessAllFiles()
    }
    
    function handleFinalBalanceCancel() {
      // User cancelled - reset and go back
      showFinalBalanceDialog.value = false
      pendingTransactionsForBalance.value = []
      pendingImportResult.value = null
      initialBalanceTransaction.value = null
      resetImport()
    }
    
    function resetImport() {
      files.value = []
      fileAnalysis.value = []
      filesByAccount.value.clear()
      previewsByAccount.value.clear()
      usedRules.value = []
      newRules.value = []
      csvPreview.value = null
      fieldMapping.value = null
      showFieldMappingStep.value = false
      pendingFileForProcessing.value = null
      pendingAccountForProcessing.value = null
      pendingImportResult.value = null
      showFinalBalanceDialog.value = false
      pendingTransactionsForBalance.value = []
      initialBalanceTransaction.value = null
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

    function handleRulesRefresh() {
      // Handle rules refresh from PreexistingRulesReview component
      // Recompute all rule matches to refresh UI when rules are edited
      computeAllRuleMatches()
    }

    function handleRuleEdited(payload) {
      const { ruleId, matchChanged, updatedRule } = payload || {}
      if (!ruleId) return

      // If only category/labels changed, skip recompute and just update local state
      if (!matchChanged) {
        // Update rule in whichever collection it belongs to
        const updateInArray = (arr) => {
          const idx = arr.findIndex(r => r.id === ruleId)
          if (idx !== -1) {
            arr[idx] = { ...arr[idx], ...updatedRule }
            return true
          }
          return false
        }
        if (!updateInArray(usedRules.value)) {
          if (!updateInArray(newRules.value)) {
            if (autoRules.value?.rules) {
              updateInArray(autoRules.value.rules)
            }
          }
        }
        return
      }

      // Snapshot previous matches to detect clobbered rules
      const prevExisting = new Map(existingRuleMatches.value)
      const prevNew = new Map(newRuleMatches.value)
      const prevAuto = new Map(autoRuleMatches.value)

      // Update the rule in-place in the appropriate collection
      let editedRulePriority = updatedRule?.priority
      const updateInArray = (arr) => {
        const idx = arr.findIndex(r => r.id === ruleId)
        if (idx !== -1) {
          editedRulePriority = arr[idx]?.priority ?? editedRulePriority
          arr[idx] = { ...arr[idx], ...updatedRule }
          return true
        }
        return false
      }
      let found = updateInArray(usedRules.value)
      if (!found) found = updateInArray(newRules.value)
      if (!found && autoRules.value?.rules) found = updateInArray(autoRules.value.rules)

      // Recompute matches after match-affecting edit
      computeAllRuleMatches()

      // Helper to get total matches for a rule across maps
      const getTotalMatchesForRule = (id) => {
        let total = 0
        total += (existingRuleMatches.value.get(id) || []).length
        total += (newRuleMatches.value.get(id) || []).length
        total += (autoRuleMatches.value.get(id) || []).length
        return total
      }

      // If edited rule now matches nothing, ask to delete
      const totalNow = getTotalMatchesForRule(ruleId)
      if (totalNow === 0) {
        showDeleteConfirm(
          'This rule no longer matches any transactions after your edit. Do you want to remove it?',
          'Remove Empty Rule?'
        ).then((confirmed) => {
          if (confirmed) {
            // Remove from whichever array contains it
            const removeFromArray = (arr) => {
              const idx = arr.findIndex(r => r.id === ruleId)
              if (idx !== -1) arr.splice(idx, 1)
            }
            removeFromArray(usedRules.value)
            removeFromArray(newRules.value)
            if (autoRules.value?.rules) removeFromArray(autoRules.value.rules)
            // Recompute after removal
            computeAllRuleMatches()
          }
        })
      }

      // Remove subsequent rules that lost all matches due to clobbering
      const collectClobbered = (prevMap, currMap, candidates) => {
        for (const [id, prevMatches] of prevMap.entries()) {
          const prevCount = prevMatches.length
          const currCount = (currMap.get(id) || []).length
          if (prevCount > 0 && currCount === 0) candidates.add(id)
        }
      }
      const clobbered = new Set()
      collectClobbered(prevExisting, existingRuleMatches.value, clobbered)
      collectClobbered(prevNew, newRuleMatches.value, clobbered)
      collectClobbered(prevAuto, autoRuleMatches.value, clobbered)

      // If priority is available, only remove those with lower priority than the edited rule
      const removeIfLowerPriority = (arr) => {
        for (let i = arr.length - 1; i >= 0; i--) {
          const r = arr[i]
          if (clobbered.has(r.id)) {
            if (typeof editedRulePriority === 'number' && typeof r.priority === 'number') {
              if (r.priority < editedRulePriority) arr.splice(i, 1)
            } else {
              // If priorities undefined, assume subsequent and remove
              arr.splice(i, 1)
            }
          }
        }
      }
      removeIfLowerPriority(usedRules.value)
      removeIfLowerPriority(newRules.value)
      if (autoRules.value?.rules) removeIfLowerPriority(autoRules.value.rules)

      // Final recompute after removals
      computeAllRuleMatches()
    }

    function handleRuleCanceled(payload) {
      const { ruleId, revertedRule } = payload || {}
      if (!ruleId) return

      // Update rule in whichever collection it belongs to with reverted state
      const updateInArray = (arr) => {
        const idx = arr.findIndex(r => r.id === ruleId)
        if (idx !== -1) {
          arr[idx] = { ...arr[idx], ...revertedRule }
          return true
        }
        return false
      }
      
      if (!updateInArray(usedRules.value)) {
        if (!updateInArray(newRules.value)) {
          if (autoRules.value?.rules) {
            updateInArray(autoRules.value.rules)
          }
        }
      }
    }

    function handleRuleSaveStart(payload) {
      const { ruleId } = payload || {}
      if (ruleId) {
        ruleSaving.value.add(ruleId)
      }
    }

    function handleRuleSaveEnd(payload) {
      const { ruleId } = payload || {}
      if (ruleId) {
        ruleSaving.value.delete(ruleId)
      }
    }

    function isRuleSaving(ruleId) {
      return ruleSaving.value.has(ruleId)
    }

    function addNewRule(rule) {
      // Validate that the rule matches at least one transaction
      // Include manual overrides if available
      const testMatches = applyRulesWithDetails(allTransactions.value, [rule], {
        manualOverrides: manualOverrides.value || {}
      })
      const matchingTransactions = testMatches.ruleMatches.get(rule.id) || []
      
      if (matchingTransactions.length === 0) {
        showWarning('This rule does not match any of the currently imported transactions. Please adjust the pattern or create the rule later.')
        return
      }
      
      const newRuleData = {
        ...rule,
        created_during_import: true,
        hasChanges: true, // Mark as having changes to persist
        isNew: true // Mark as new rule
      }
      
      newRules.value.push(newRuleData)
      
      // Recompute all rule matches with proper priority handling
      computeAllRuleMatches()
      
      // Filter new rules to only keep those with matches
      newRules.value = newRules.value.filter(r => {
        const matches = newRuleMatches.value.get(r.id) || []
        return matches.length > 0
      })
    }

    function clearNewRules() {
      // Clear new rules when starting a new import
      newRules.value = []
    }

    function handleCombinedRulesSkip() {
      // Skip rules review and go to complete step
      step.value = 5
    }

    // Function moved to before debug mode initialization

    async function handleSaveRules() {
      processing.value = true
      
      try {
        // Collect all rules with hasChanges: true from all sources
        const allRulesToSave = []
        
        // Get edited pre-existing rules
        const editedExistingRules = usedRules.value.filter(rule => rule.hasChanges)
        allRulesToSave.push(...editedExistingRules.map(rule => ({ ...rule, isNew: false })))
        
        // Get new rules
        const newRulesToSave = newRules.value.filter(rule => rule.hasChanges)
        allRulesToSave.push(...newRulesToSave.map(rule => ({ ...rule, isNew: true })))
        
        // Get auto-generated rules that haven't been applied yet (they should be saved)
        const autoRulesToSave = autoRules.value?.rules?.filter(rule => !rule.applied) || []
        allRulesToSave.push(...autoRulesToSave.map(rule => ({ ...rule, isNew: true })))
        
        console.log('handleSaveRules: Saving rules to backend:', allRulesToSave)
        
        // Save all rules with changes
        for (const rule of allRulesToSave) {
          try {
            if (rule.isNew) {
              // Remove flags before sending to backend
              const { hasChanges, isNew, ...ruleToSave } = rule
              const savedRule = await api.createRule(ruleToSave)
              console.log('handleSaveRules: Created new rule:', savedRule)
              
              // Mark auto-generated rules as applied
              if (autoRules.value?.rules) {
                const autoRule = autoRules.value.rules.find(r => r.id === rule.id)
                if (autoRule) {
                  autoRule.applied = true
                }
              }
            } else {
              // Remove flags before sending to backend
              const { hasChanges, isNew, ...ruleToSave } = rule
              await api.updateRule(rule.id, ruleToSave)
              console.log('handleSaveRules: Updated existing rule:', rule.id)
            }
          } catch (error) {
            console.error('Error saving rule:', error)
            // Continue with other rules even if one fails
          }
        }
        
        console.log('handleSaveRules: Rules saved successfully')
      } catch (error) {
        console.error('Error in handleSaveRules:', error)
        showError('Error saving rules: ' + error.message)
      } finally {
        processing.value = false
      }
    }

    function goToTransactionReview() {
      // Ensure previewsByAccount is up to date (should already be from computeAllRuleMatches)
      // No need to recompute - previewsByAccount is already maintained by computeAllRuleMatches
      // Navigate to Transaction Review step
      step.value = 4
    }

    async function handleSaveAndImport() {
      // First save rules, then import transactions
      await handleSaveRules()
      await commitAllImports()
    }

    async function handleImportTransactions() {
      // Use existing commitAllImports() logic
      await commitAllImports()
    }
    
    // Check if field mapping is complete (all required fields mapped)
    const isFieldMappingComplete = computed(() => {
      if (!fieldMapping.value || typeof fieldMapping.value !== 'object') return false
      
      const values = Object.values(fieldMapping.value)
      return values.includes('date') && values.includes('name') && 
             values.includes('inflow') && values.includes('outflow')
    })

    return {
      // Props
      props,
      // Reactive data
      step,
      files,
      fileAnalysis,
      filesByAccount,
      previewsByAccount,
      usedRules,
      autoRules,
      newRules,
      allTransactions,
      csvPreview,
      fieldMapping,
      showFieldMappingStep,
      pendingFileForProcessing,
      pendingAccountForProcessing,
      existingRuleMatches,
      newRuleMatches,
      autoRuleMatches,
      isDragOver,
      processing,
      ruleSaving,
      currentCategoryStep,
      categorySteps,
      categoryStepNames,
      totalFiles,
      totalTransactions,
      currentCategoryTransactions,
      hasMoreCategories,
      hasPreviousCategories,
      allFilesAssigned,
      getCurrentAccountId,
      getAccountName,
      getFileFormat,
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
      handleRulesRefresh,
      handleRuleEdited,
      handleRuleCanceled,
      handleRuleSaveStart,
      handleRuleSaveEnd,
      isRuleSaving,
      addNewRule,
      clearNewRules,
      handleCombinedRulesSkip,
      handleSaveRules,
      handleImportTransactions,
      handleSaveAndImport,
      goToTransactionReview,
      goBackToRules: () => { step.value = 3 },
      handleFieldMappingConfirmed,
      handleFieldMappingSkip,
      fieldMappingComponent,
      isFieldMappingComplete,
      showFinalBalanceDialog,
      pendingTransactionsForBalance,
      handleFinalBalanceConfirmed,
      handleFinalBalanceCancel
    }
  }
}
