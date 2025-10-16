import { ref, computed, watch, onMounted } from 'vue'
import api from '../api.js'
import MultiLabelSelector from '../MultiLabelSelector.vue'

export default {
  name: 'AutoRulesReview',
  components: {
    MultiLabelSelector
  },
  props: {
    autoRules: Object,
    transactions: Array
  },
  emits: ['skip', 'applied'],
  setup(props, { emit }) {
    // Debug logging
    console.log('AutoRulesReview props:', {
      autoRules: props.autoRules,
      hasAutoRules: !!props.autoRules,
      hasRules: !!props.autoRules?.rules,
      rulesLength: props.autoRules?.rules?.length,
      transactions: props.transactions?.length
    })

    const viewMode = ref('list')
    const applying = ref(false)
    const editingRule = ref(null)
    const editingData = ref({})
    const expandedRules = ref([])
    const modifiedRules = ref(new Map()) // Track rule modifications
    const newRules = ref([]) // Track newly created rules from transactions
    const showCreateRuleDialog = ref(false)
    const createRuleData = ref({})
    const createRuleTransaction = ref(null)
    const createRuleParent = ref(null)
    const snackMessage = ref('')
    const showSnack = ref(false)
    const rulesContainer = ref(null)

    // Reactive data for rule statistics
    const ruleFrequencies = ref(new Map())
    const ruleExplanations = ref(new Map())
    const rulePreviewCounts = ref(new Map())
    const ruleMatches = ref(new Map())

    // Function to update all rule statistics
    async function updateRuleStatistics() {
      const allRules = [...newRules.value, ...(props.autoRules?.rules || [])]
      
      for (const rule of allRules) {
        try {
          const frequency = await getCurrentFrequency(rule.id)
          const explanation = await getCurrentExplanation(rule)
          const previewCount = await getPreviewCount(rule.id)
          const matches = await getAllMatches(rule.id)
          
          ruleFrequencies.value.set(rule.id, frequency)
          ruleExplanations.value.set(rule.id, explanation)
          rulePreviewCounts.value.set(rule.id, previewCount)
          ruleMatches.value.set(rule.id, matches)
        } catch (error) {
          console.error(`Error updating statistics for rule ${rule.id}:`, error)
        }
      }
    }

    // Watch for changes in rules and update statistics
    watch([() => props.autoRules, newRules], async () => {
      await updateRuleStatistics()
    }, { deep: true })

    // Update statistics when component mounts
    onMounted(async () => {
      await updateRuleStatistics()
    })

    // Get the effective rules (new rules first, then original + modifications)
    const effectiveRules = computed(() => {
      if (!props.autoRules?.rules) return []
      
      const originalRules = props.autoRules.rules
        .map(rule => {
          const modified = modifiedRules.value.get(rule.id)
          if (modified === null) return null // Removed rule
          return modified || rule // Modified rule or original
        })
        .filter(rule => rule !== null)
      
      // New rules go first with highest priority, then original rules
      return [...newRules.value, ...originalRules]
    })

    const categoryNames = {
      'fixed_costs': 'Fixed Costs',
      'investments': 'Investments', 
      'guilt_free': 'Guilt Free',
      'short_term_savings': 'Short Term Savings'
    }

    function getCategoryName(category) {
      return categoryNames[category] || category
    }

    async function applySingleRule(rule) {
      if (applying.value) return
      
      applying.value = true
      try {
        // Apply just this single rule
        const result = await api.applyAutoRules([rule], props.transactions)
        
        // Show success message
        showSnackMessage(`✅ Rule applied: "${rule.pattern}" → ${getCategoryName(rule.category)} (${result.applied} transactions categorized)`)
        
        // Remove the applied rule from the list
        if (rule.isNewRule) {
          const index = newRules.value.findIndex(r => r.id === rule.id)
          if (index > -1) {
            newRules.value.splice(index, 1)
          }
        } else {
          // Mark original rule as applied
          modifiedRules.value.set(rule.id, null)
        }
        
        // Collapse any expanded views
        expandedRules.value = []
        
      } catch (error) {
        console.error('Failed to apply rule:', error)
        showSnackMessage('❌ Failed to apply rule. Please try again.')
      } finally {
        applying.value = false
      }
    }

    async function getPreviewCount(ruleId) {
      // Use the same recalculation logic as getAllMatches
      const ruleMatches = await recalculateRuleMatches()
      const matches = ruleMatches.get(ruleId) || []
      return matches.length
    }

    async function getCurrentFrequency(ruleId) {
      // Get the current number of matches for this rule after recalculation
      const ruleMatches = await recalculateRuleMatches()
      const matches = ruleMatches.get(ruleId) || []
      return matches.length
    }

    async function getCurrentExplanation(rule) {
      const currentMatches = await getCurrentFrequency(rule.id)
      
      // For new rules, use the original explanation
      if (rule.isNewRule) {
        return rule.explain
      }
      
      // For original rules, update the explanation to reflect current state
      if (currentMatches === 0) {
        return `No current matches - all transactions claimed by higher priority rules`
      } else if (currentMatches === 1) {
        return `Currently matches 1 transaction (${currentMatches} of original ${rule.frequency || 0} claimed by higher priority rules)`
      } else {
        return `Currently matches ${currentMatches} transactions (${currentMatches} of original ${rule.frequency || 0} claimed by higher priority rules)`
      }
    }

    async function getPreviewMatches(ruleId) {
      // Use the same recalculation logic for consistency
      const ruleMatches = await recalculateRuleMatches()
      const matches = ruleMatches.get(ruleId) || []
      // Return only the first few matches for preview
      return matches.slice(0, 3)
    }

    // Cache for rule matches to avoid recalculating on every call
    let cachedRuleMatches = null
    let lastCalculationHash = null
    let forceRecalculation = false

    // Re-run rule matching algorithm with priority-based conflict resolution
    async function recalculateRuleMatches() {
      if (!props.autoRules.previews || !props.transactions) return new Map()
      
      // If there are no new rules, just return the original preview data
      if (newRules.value.length === 0) {
        console.log('No new rules, returning original preview data')
        const originalMatches = new Map()
        props.autoRules.previews.forEach(preview => {
          if (preview.rule && preview.matches) {
            originalMatches.set(preview.rule.id, preview.matches)
          }
        })
        return originalMatches
      }
      
      console.log('New rules exist, doing full recalculation')
      
      // Create a hash of the current state to check if we need to recalculate
      const currentHash = JSON.stringify({
        newRulesCount: newRules.value.length,
        newRulesIds: newRules.value.map(r => r.id).sort(),
        originalRulesCount: props.autoRules.rules?.length || 0
      })
      
      // Return cached result if nothing has changed and we're not forcing recalculation
      if (cachedRuleMatches && lastCalculationHash === currentHash && !forceRecalculation) {
        console.log('Using cached rule matches')
        return cachedRuleMatches
      }
      
      console.log('Recalculating rule matches (cache miss or cleared)', {
        hasCachedMatches: !!cachedRuleMatches,
        lastHash: lastCalculationHash,
        currentHash: currentHash,
        hashesMatch: lastCalculationHash === currentHash
      })
      
      // Get all transactions from the original previews
      const allTransactions = []
      props.autoRules.previews.forEach(preview => {
        if (preview.matches) {
          allTransactions.push(...preview.matches)
        }
      })
      
      console.log('Preview transactions count:', allTransactions.length)
      console.log('Props transactions available:', !!props.transactions)
      console.log('Props transactions length:', props.transactions?.length || 0)
      
      // For recalculation with new rules, we need to work with ALL transactions
      // Try to get transactions from props first (current import), then from database
      if (newRules.value.length > 0) {
        if (props.transactions && props.transactions.length > 0) {
          console.log('Using props.transactions for recalculation:', props.transactions.length)
          // Use the transactions from props (current import)
          allTransactions.length = 0 // Clear the array
          allTransactions.push(...props.transactions)
          console.log('All transactions after adding props transactions:', allTransactions.length)
        } else {
          try {
            console.log('Fetching all transactions from database for recalculation')
            const allDbTransactions = await api.listTransactions()
            console.log('Database transactions count:', allDbTransactions.length)
            console.log('Sample database transaction:', allDbTransactions[0])
            console.log('Full API response:', allDbTransactions)
            
            // Use database transactions instead of preview transactions for recalculation
            allTransactions.length = 0 // Clear the array
            allTransactions.push(...allDbTransactions)
            console.log('All transactions after adding database transactions:', allTransactions.length)
          } catch (error) {
            console.error('Error fetching all transactions:', error)
            console.error('Error details:', error.response?.data || error.message)
            // Fall back to preview transactions if database fetch fails
          }
        }
      }
      
      // Remove duplicates based on transaction ID, but be smarter about it
      console.log('Before duplicate removal:', allTransactions.length)
      console.log('Sample transaction IDs:', allTransactions.slice(0, 3).map(tx => ({ id: tx.id, name: tx.name })))
      
      // Check for ID patterns
      const idCounts = {}
      allTransactions.forEach(tx => {
        idCounts[tx.id] = (idCounts[tx.id] || 0) + 1
      })
      console.log('ID frequency analysis:', Object.entries(idCounts).slice(0, 10))
      console.log('Total unique IDs:', Object.keys(idCounts).length)
      
      // If all transactions have the same ID, don't remove duplicates
      // This happens when the database returns the same transaction multiple times
      const uniqueIds = Object.keys(idCounts)
      let uniqueTransactions
      if (uniqueIds.length === 1) {
        console.log('All transactions have the same ID, keeping all transactions')
        console.log('Sample transaction data:', allTransactions.slice(0, 2))
        uniqueTransactions = allTransactions
      } else {
        // Only remove duplicates if there are actually different IDs
        uniqueTransactions = allTransactions.filter((tx, index, self) =>
          index === self.findIndex(t => t.id === tx.id)
        )
      }
      
      console.log('After duplicate removal:', uniqueTransactions.length)
      
      console.log('Recalculating rule matches:', {
        totalTransactions: uniqueTransactions.length,
        newRulesCount: newRules.value.length,
        originalRulesCount: props.autoRules.rules?.length || 0,
        sampleTransactions: uniqueTransactions.slice(0, 3).map(tx => ({ id: tx.id, name: tx.name })),
        allTransactionNames: uniqueTransactions.map(tx => tx.name)
      })
      
      // Combine all rules: new rules first (highest priority), then original rules
      const allRules = [
        ...newRules.value,
        ...props.autoRules.rules
      ]
      
      // Sort by priority (highest first)
      allRules.sort((a, b) => (b.priority || 0) - (a.priority || 0))
      
      console.log('All rules in priority order:', allRules.map(rule => ({
        id: rule.id,
        pattern: rule.pattern,
        type: rule.type,
        priority: rule.priority,
        isNewRule: rule.isNewRule
      })))
      
      // Track which transactions are covered by higher priority rules
      const coveredTransactions = new Set()
      const ruleMatches = new Map()
      
      // Process each rule in priority order
      for (const rule of allRules) {
        const matches = []
        
        for (const tx of uniqueTransactions) {
          // Skip if already covered by higher priority rule
          if (coveredTransactions.has(tx.id)) continue
          
          // Check if transaction matches this rule
          if (transactionMatchesRule(tx, rule)) {
            matches.push({
              ...tx,
              newCategory: rule.category,
              wouldChange: tx.currentCategory !== rule.category
            })
            coveredTransactions.add(tx.id)
          }
        }
        
        if (matches.length > 0) {
          ruleMatches.set(rule.id, matches)
          console.log(`Rule "${rule.pattern}" (${rule.type}, priority: ${rule.priority}) matched ${matches.length} transactions:`, matches.map(m => m.name))
        } else {
          console.log(`Rule "${rule.pattern}" (${rule.type}, priority: ${rule.priority}) matched 0 transactions`)
        }
      }
      
      console.log('Final rule matches summary:', Array.from(ruleMatches.entries()).map(([id, matches]) => ({
        ruleId: id,
        matchCount: matches.length
      })))
      
      // Debug: Show some sample transactions that didn't match any rules
      const unmatchedTransactions = uniqueTransactions.filter(tx => !coveredTransactions.has(tx.id))
      if (unmatchedTransactions.length > 0) {
        console.log(`Found ${unmatchedTransactions.length} unmatched transactions:`, unmatchedTransactions.slice(0, 3).map(tx => tx.name))
      }
      
      // Cache the result
      cachedRuleMatches = ruleMatches
      lastCalculationHash = currentHash
      forceRecalculation = false // Reset the force flag
      
      return ruleMatches
    }

    // Check if a transaction matches a rule
    function transactionMatchesRule(transaction, rule) {
      const normalized = (transaction.name || '').toLowerCase()
      const pattern = (rule.pattern || '').toLowerCase()
      
      let matches = false
      switch (rule.type) {
        case 'contains':
          matches = normalized.includes(pattern)
          break
        case 'exact':
          matches = normalized === pattern
          break
        case 'regex':
          try {
            matches = new RegExp(rule.pattern, 'i').test(normalized)
          } catch (e) {
            matches = false
          }
          break
        case 'mcc':
          matches = transaction.mcc === rule.pattern
          break
        default:
          matches = false
      }
      
      // Debug: Log some matches for the new rule
      if (rule.isNewRule && matches) {
        console.log(`New rule "${rule.pattern}" matched transaction: "${transaction.name}"`)
      }
      
      return matches
    }

    async function getAllMatches(ruleId) {
      // Recalculate all rule matches with priority-based conflict resolution
      const ruleMatches = await recalculateRuleMatches()
      
      // Return matches for this specific rule
      const matches = ruleMatches.get(ruleId) || []
      console.log(`Rule ${ruleId} has ${matches.length} matches after recalculation`)
      return matches
    }

    function startEditing(rule) {
      editingRule.value = rule.id
      editingData.value = {
        type: rule.type,
        pattern: rule.pattern,
        category: rule.category
      }
    }

    function cancelEdit() {
      editingRule.value = null
      editingData.value = {}
    }

    function saveEdit(ruleId) {
      const rule = props.autoRules.rules.find(r => r.id === ruleId)
      if (!rule) return
      
      // Store the modified rule
      modifiedRules.value.set(ruleId, {
        ...rule,
        type: editingData.value.type,
        pattern: editingData.value.pattern,
        category: editingData.value.category,
        explain: `Auto-generated (edited): "${editingData.value.pattern}" ${editingData.value.type} rule`
      })
      
      editingRule.value = null
      editingData.value = {}
    }

    function removeRule(ruleId) {
      if (confirm('Are you sure you want to remove this rule?')) {
        // Mark as removed
        modifiedRules.value.set(ruleId, null)
        
        // Clear the cache since we removed a rule
        cachedRuleMatches = null
        lastCalculationHash = null
        forceRecalculation = true
      }
    }

    function toggleExpanded(ruleId) {
      const index = expandedRules.value.indexOf(ruleId)
      if (index > -1) {
        expandedRules.value.splice(index, 1)
      } else {
        expandedRules.value.push(ruleId)
      }
    }

    // Extract merchant name from transaction name, removing store numbers and common suffixes
    function extractMerchantName(transactionName) {
      if (!transactionName) return ''
      
      // Remove common patterns like store numbers, locations, etc.
      let merchantName = transactionName
      
      // Remove store numbers (e.g., "STARBUCKS #1234" -> "STARBUCKS")
      merchantName = merchantName.replace(/\s*#\d+\s*$/i, '')
      
      // Remove location suffixes (e.g., "STARBUCKS TORONTO ON" -> "STARBUCKS")
      merchantName = merchantName.replace(/\s+(ON|QC|BC|AB|MB|SK|NS|NB|NL|PE|YT|NT|NU)\s*$/i, '')
      
      // Remove common store suffixes
      merchantName = merchantName.replace(/\s+(STORE|LOCATION|SHOP)\s*\d*\s*$/i, '')
      
      // Remove extra whitespace
      merchantName = merchantName.trim()
      
      return merchantName
    }

    function createRuleFromTransaction(transaction, parentRule) {
      // Store the transaction and parent rule for the dialog
      createRuleTransaction.value = transaction
      createRuleParent.value = parentRule
      
      // Initialize the create rule data with defaults
      // Extract just the merchant name, removing common suffixes like store numbers
      const merchantName = extractMerchantName(transaction.name)
      createRuleData.value = {
        type: 'contains',
        pattern: merchantName.toLowerCase(),
        category: transaction.currentCategory || transaction.newCategory || 'guilt_free',
        labels: []
      }
      
      // Show the create rule dialog
      showCreateRuleDialog.value = true
    }

    function saveNewRule() {
      if (!createRuleData.value.pattern.trim()) {
        showSnackMessage('Please enter a pattern for the rule.')
        return
      }
      
      // Generate a unique ID for the new rule
      const newRuleId = `new_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Create a new rule based on the dialog data
      const newRule = {
        id: newRuleId,
        type: createRuleData.value.type,
        pattern: createRuleData.value.pattern.toLowerCase(),
        category: createRuleData.value.category,
        labels: createRuleData.value.labels || [],
        confidence: 1.0,
        frequency: 1,
        priority: 1000, // High priority for user-created rules (matches backend expectation)
        source: 'user_created',
        explain: `User-created rule from transaction: "${createRuleTransaction.value.name}"`,
        actualMatches: 1,
        coverage: 0,
        isNewRule: true,
        parentRuleId: createRuleParent.value?.id,
        transactionId: createRuleTransaction.value.id,
        // Store the transaction data with the rule so we can display it later
        sourceTransaction: {
          id: createRuleTransaction.value.id,
          name: createRuleTransaction.value.name,
          amount: createRuleTransaction.value.amount,
          date: createRuleTransaction.value.date,
          currentCategory: createRuleTransaction.value.currentCategory
        }
      }
      
      // Add to new rules list (will appear at top due to effectiveRules ordering)
      newRules.value.push(newRule)
      
      // Clear the cache since we added a new rule
      console.log('Clearing cache after adding new rule:', newRule.pattern)
      cachedRuleMatches = null
      lastCalculationHash = null
      forceRecalculation = true
      
      // Force an immediate recalculation to ensure the UI updates correctly
      setTimeout(async () => {
        console.log('Forcing recalculation after new rule addition')
        // Ensure cache is definitely cleared and force recalculation
        cachedRuleMatches = null
        lastCalculationHash = null
        forceRecalculation = true
        await recalculateRuleMatches()
      }, 0)
      
      // Collapse all expanded rules
      expandedRules.value = []
      
      // Scroll to top to show the new rule
      setTimeout(() => {
        if (rulesContainer.value) {
          rulesContainer.value.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
      
      // Close the dialog
      showCreateRuleDialog.value = false
      createRuleData.value = {}
      createRuleTransaction.value = null
      createRuleParent.value = null
      
      // Show success snack message
      showSnackMessage(`✅ New rule created: "${newRule.pattern}" → ${getCategoryName(newRule.category)}`)
    }

    function cancelCreateRule() {
      showCreateRuleDialog.value = false
      createRuleData.value = {}
      createRuleTransaction.value = null
      createRuleParent.value = null
    }

    function formatDate(dateStr) {
      if (!dateStr) return 'Unknown Date'
      try {
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return 'Invalid Date'
        return date.toLocaleDateString()
      } catch (e) {
        return 'Invalid Date'
      }
    }

    function formatAmount(amount) {
      if (amount === null || amount === undefined || isNaN(amount)) return '$0.00'
      const numAmount = Number(amount)
      if (isNaN(numAmount)) return '$0.00'
      return `$${Math.abs(numAmount).toFixed(2)}`
    }

    function showSnackMessage(message) {
      snackMessage.value = message
      showSnack.value = true
      setTimeout(() => {
        showSnack.value = false
      }, 4000)
    }

    return {
      viewMode,
      applying,
      editingRule,
      editingData,
      expandedRules,
      modifiedRules,
      newRules,
      showCreateRuleDialog,
      createRuleData,
      createRuleTransaction,
      createRuleParent,
      snackMessage,
      showSnack,
      rulesContainer,
      ruleFrequencies,
      ruleExplanations,
      rulePreviewCounts,
      ruleMatches,
      effectiveRules,
      categoryNames,
      getCategoryName,
      applySingleRule,
      getPreviewCount,
      getCurrentFrequency,
      getCurrentExplanation,
      getPreviewMatches,
      getAllMatches,
      startEditing,
      cancelEdit,
      saveEdit,
      removeRule,
      toggleExpanded,
      extractMerchantName,
      createRuleFromTransaction,
      saveNewRule,
      cancelCreateRule,
      formatDate,
      formatAmount,
      showSnackMessage
    }
  }
}