<template>
  <div class="auto-rules-review">
    <div class="header">
      <h3>🤖 Auto-Generated Rules</h3>
      <p class="subtitle">
        We've analyzed your transactions and found {{ autoRules?.rules?.length || 0 }} potential rules to help categorize future transactions.
      </p>
    </div>

    <div v-if="!autoRules" class="no-rules">
      <p>No auto-generated rules available for this import.</p>
    </div>

    <div v-else class="rules-content">
      <!-- Statistics -->
      <div class="stats">
        <div class="stat-item">
          <span class="stat-number">{{ autoRules.stats?.totalTransactions || 0 }}</span>
          <span class="stat-label">Transactions Analyzed</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">{{ autoRules.stats?.rulesGenerated || 0 }}</span>
          <span class="stat-label">Rules Generated</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">{{ effectiveRules.length }}</span>
          <span class="stat-label">Available</span>
        </div>
      </div>

      <!-- Rule Types Breakdown -->
      <div class="rule-types">
        <div class="rule-type" v-if="autoRules.stats?.frequencyRules > 0">
          <span class="type-label">Frequency-based:</span>
          <span class="type-count">{{ autoRules.stats.frequencyRules }}</span>
        </div>
        <div class="rule-type" v-if="autoRules.stats?.storePattern > 0">
          <span class="type-label">Store patterns:</span>
          <span class="type-count">{{ autoRules.stats.storePattern }}</span>
        </div>
        <div class="rule-type" v-if="autoRules.stats?.mccRules > 0">
          <span class="type-label">MCC-based:</span>
          <span class="type-count">{{ autoRules.stats.mccRules }}</span>
        </div>
        <div class="rule-type" v-if="autoRules.stats?.recurringRules > 0">
          <span class="type-label">Recurring:</span>
          <span class="type-count">{{ autoRules.stats.recurringRules }}</span>
        </div>
        <div class="rule-type" v-if="autoRules.stats?.marketplaceRules > 0">
          <span class="type-label">Marketplace:</span>
          <span class="type-count">{{ autoRules.stats.marketplaceRules }}</span>
        </div>
      </div>

      <!-- Rules List -->
      <div class="rules-list" ref="rulesContainer">
        <div class="rules-header">
          <div class="view-toggle">
            <button 
              class="toggle-btn" 
              :class="{ active: viewMode === 'list' }"
              @click="viewMode = 'list'"
            >
              List
            </button>
            <button 
              class="toggle-btn" 
              :class="{ active: viewMode === 'preview' }"
              @click="viewMode = 'preview'"
            >
              Preview
            </button>
          </div>
        </div>

        <div class="rules-container">
          <div 
            v-for="rule in effectiveRules" 
            :key="rule.id"
            class="rule-item"
            :class="{ 
              editing: editingRule === rule.id,
              expanded: expandedRules.includes(rule.id)
            }"
          >
            <div class="rule-main">

              <div class="rule-content">
                <!-- Rule Header with Actions -->
                <div class="rule-header">
                  <div class="rule-pattern">
                    <span class="rule-type-badge" :class="rule.type">{{ rule.type }}</span>
                    <code class="pattern">{{ rule.pattern }}</code>
                    <span v-if="rule.isNewRule" class="new-rule-badge">NEW</span>
                  </div>
                  <div class="rule-actions">
                    <div class="rule-category">
                      <span class="category-badge" :class="rule.category">{{ getCategoryName(rule.category) }}</span>
                    </div>
                    <div class="action-buttons">
                      <button 
                        class="action-btn edit-btn" 
                        @click="startEditing(rule)"
                        :disabled="editingRule !== null"
                        title="Edit rule"
                      >
                        ✏️
                      </button>
                      <button 
                        class="action-btn expand-btn" 
                        @click="toggleExpanded(rule.id)"
                        :title="expandedRules.includes(rule.id) ? 'Collapse' : 'Show all transactions'"
                      >
                        {{ expandedRules.includes(rule.id) ? '📖' : '📄' }}
                      </button>
                      <button 
                        class="action-btn remove-btn" 
                        @click="removeRule(rule.id)"
                        title="Remove rule"
                      >
                        🗑️
                      </button>
                      <button 
                        class="action-btn apply-btn" 
                        @click="applySingleRule(rule)"
                        :disabled="applying"
                        title="Apply this rule"
                      >
                        {{ applying ? '⏳' : '✅' }} Apply
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Editing Mode -->
                <div v-if="editingRule === rule.id" class="rule-editing">
                  <div class="edit-form">
                    <div class="edit-row">
                      <label>Type:</label>
                      <select v-model="editingData.type" class="edit-input">
                        <option value="contains">Contains</option>
                        <option value="regex">Regex</option>
                        <option value="exact">Exact</option>
                        <option value="mcc">MCC</option>
                      </select>
                    </div>
                    <div class="edit-row">
                      <label>Pattern:</label>
                      <input 
                        v-model="editingData.pattern" 
                        class="edit-input pattern-input"
                        placeholder="Enter pattern..."
                      >
                    </div>
                    <div class="edit-row">
                      <label>Category:</label>
                      <select v-model="editingData.category" class="edit-input">
                        <option value="fixed_costs">Fixed Costs</option>
                        <option value="investments">Investments</option>
                        <option value="guilt_free">Guilt Free</option>
                        <option value="short_term_savings">Short Term Savings</option>
                        <option value="">Uncategorized</option>
                      </select>
                    </div>
                    <div class="edit-actions">
                      <button class="btn btn-sm btn-primary" @click="saveEdit(rule.id)">Save</button>
                      <button class="btn btn-sm btn-secondary" @click="cancelEdit">Cancel</button>
                    </div>
                  </div>
                </div>

                <!-- Normal View -->
                <div v-else class="rule-details">
                  <div class="rule-stats">
                    <span class="stat">
                      <strong>{{ rule.frequency }}</strong> occurrences
                    </span>
                    <span class="stat">
                      <strong>{{ Math.round(rule.confidence * 100) }}%</strong> confidence
                    </span>
                    <span class="stat">
                      <strong>{{ rule.priority || 'N/A' }}</strong> priority
                    </span>
                    <span class="stat source">
                      {{ rule.source }}
                    </span>
                  </div>
                  <p class="rule-explanation">{{ rule.explain }}</p>
                </div>

                <!-- Expanded Transactions View -->
                <div v-if="expandedRules.includes(rule.id)" class="rule-transactions">
                  <div class="transactions-header">
                    <span>All matching transactions ({{ getPreviewCount(rule.id) }} total):</span>
                    <button 
                      class="btn btn-sm btn-secondary" 
                      @click="toggleExpanded(rule.id)"
                    >
                      Collapse
                    </button>
                  </div>
                  <div class="transactions-list">
                    <div 
                      v-for="match in getAllMatches(rule.id)" 
                      :key="match.id"
                      class="transaction-item"
                    >
                      <span class="merchant">{{ match.name }}</span>
                      <span class="amount">{{ formatAmount(match.amount) }}</span>
                      <span class="date">{{ formatDate(match.date) }}</span>
                      <span 
                        class="category-change"
                        :class="{ changed: match.wouldChange }"
                      >
                        {{ match.wouldChange ? '→ ' + getCategoryName(match.newCategory) : getCategoryName(match.currentCategory) }}
                      </span>
                      <button 
                        class="create-rule-btn"
                        @click="createRuleFromTransaction(match, rule)"
                        title="Create rule from this transaction"
                      >
                        ➕ Create Rule
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Preview Mode (when not expanded) -->
                <div v-else-if="viewMode === 'preview'" class="rule-preview">
                  <div class="preview-header">
                    <span>Sample matches:</span>
                    <span class="preview-count">{{ getPreviewCount(rule.id) }} transactions</span>
                  </div>
                  <div class="preview-list">
                    <div 
                      v-for="match in getPreviewMatches(rule.id)" 
                      :key="match.id"
                      class="preview-item"
                    >
                      <span class="merchant">{{ match.name }}</span>
                      <span class="amount">{{ formatAmount(match.amount) }}</span>
                      <span class="date">{{ formatDate(match.date) }}</span>
                      <span 
                        class="category-change"
                        :class="{ changed: match.wouldChange }"
                      >
                        {{ match.wouldChange ? '→ ' + getCategoryName(match.newCategory) : getCategoryName(match.currentCategory) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="actions">
        <button 
          class="btn btn-secondary" 
          @click="$emit('skip')"
        >
          Skip Auto Rules
        </button>
        <div class="actions-info">
          <p>Click the "Apply" button on any rule to create it and categorize matching transactions.</p>
        </div>
      </div>
    </div>

    <!-- Create Rule Dialog -->
    <div v-if="showCreateRuleDialog" class="dialog-overlay" @click="cancelCreateRule">
      <div class="dialog" @click.stop>
        <div class="dialog-header">
          <h3>Create New Rule</h3>
          <button class="close-btn" @click="cancelCreateRule">×</button>
        </div>
        
        <div class="dialog-content">
          <div class="transaction-info">
            <h4>From Transaction:</h4>
            <p><strong>Merchant:</strong> {{ createRuleTransaction?.name }}</p>
            <p><strong>Amount:</strong> {{ formatAmount(createRuleTransaction?.amount) }}</p>
            <p><strong>Date:</strong> {{ formatDate(createRuleTransaction?.date) }}</p>
          </div>
          
          <div class="rule-form">
            <div class="form-row">
              <label>Match Type:</label>
              <select v-model="createRuleData.type" class="form-input">
                <option value="contains">Contains</option>
                <option value="regex">Regex</option>
                <option value="exact">Exact</option>
              </select>
            </div>
            
            <div class="form-row">
              <label>Pattern:</label>
              <input 
                v-model="createRuleData.pattern" 
                class="form-input pattern-input"
                placeholder="Enter pattern to match..."
                :class="{ 'regex-input': createRuleData.type === 'regex' }"
              >
              <small class="form-help">
                <span v-if="createRuleData.type === 'contains'">Text that must be contained in the merchant name</span>
                <span v-else-if="createRuleData.type === 'regex'">Regular expression pattern</span>
                <span v-else-if="createRuleData.type === 'exact'">Exact merchant name match</span>
              </small>
              <div v-if="createRuleData.pattern" class="pattern-preview">
                <strong>Preview:</strong> This rule will match transactions containing "<code>{{ createRuleData.pattern }}</code>"
              </div>
            </div>
            
            <div class="form-row">
              <label>Category:</label>
              <select v-model="createRuleData.category" class="form-input">
                <option value="fixed_costs">Fixed Costs</option>
                <option value="investments">Investments</option>
                <option value="guilt_free">Guilt Free</option>
                <option value="short_term_savings">Short Term Savings</option>
                <option value="">Uncategorized</option>
              </select>
            </div>
          </div>
        </div>
        
        <div class="dialog-actions">
          <button class="btn btn-secondary" @click="cancelCreateRule">Cancel</button>
          <button class="btn btn-primary" @click="saveNewRule">Create Rule</button>
        </div>
      </div>
    </div>

    <!-- Snack Message -->
    <div v-if="showSnack" class="snack-message">
      {{ snackMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import api from './api.js'

const props = defineProps({
  autoRules: Object,
  transactions: Array
})

// Debug logging
console.log('AutoRulesReview props:', {
  autoRules: props.autoRules,
  hasAutoRules: !!props.autoRules,
  hasRules: !!props.autoRules?.rules,
  rulesLength: props.autoRules?.rules?.length,
  transactions: props.transactions?.length
})

const emit = defineEmits(['skip', 'applied'])

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

function getPreviewCount(ruleId) {
  // Check if it's a new rule
  const newRule = newRules.value.find(r => r.id === ruleId)
  if (newRule) {
    return 1 // New rules show 1 match
  }
  
  // For existing rules, return the filtered count
  return getAllMatches(ruleId).length
}

function getPreviewMatches(ruleId) {
  const preview = props.autoRules.previews?.find(p => p.rule.id === ruleId)
  return preview?.matches || []
}

function getAllMatches(ruleId) {
  // Check if it's a new rule
  const newRule = newRules.value.find(r => r.id === ruleId)
  if (newRule) {
    // For new rules, we need to simulate matches
    // This is a simplified version - in a real implementation, you'd want to
    // recalculate matches based on the new rule pattern
    return [{
      id: newRule.transactionId,
      name: createRuleTransaction.value?.name || 'Unknown',
      amount: createRuleTransaction.value?.amount || 0,
      date: createRuleTransaction.value?.date || new Date().toISOString(),
      currentCategory: createRuleTransaction.value?.currentCategory,
      newCategory: newRule.category,
      wouldChange: createRuleTransaction.value?.currentCategory !== newRule.category
    }]
  }
  
  // For existing rules, filter out transactions that are now covered by higher priority rules
  const preview = props.autoRules.previews?.find(p => p.rule.id === ruleId)
  if (!preview) return []
  
  // Get all new rules that have higher priority
  const higherPriorityRules = newRules.value.filter(newRule => newRule.priority > 200)
  
  // Filter out transactions that would be matched by higher priority rules
  const filteredMatches = preview.matches.filter(match => {
    // Check if this transaction would be matched by any higher priority rule
    return !higherPriorityRules.some(higherRule => {
      const normalized = match.name.toLowerCase()
      switch (higherRule.type) {
        case 'contains':
          return normalized.includes(higherRule.pattern)
        case 'exact':
          return normalized === higherRule.pattern
        case 'regex':
          try {
            return new RegExp(higherRule.pattern, 'i').test(normalized)
          } catch (e) {
            return false
          }
        default:
          return false
      }
    })
  })
  
  return filteredMatches
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

function createRuleFromTransaction(transaction, parentRule) {
  // Store the transaction and parent rule for the dialog
  createRuleTransaction.value = transaction
  createRuleParent.value = parentRule
  
  // Initialize the create rule data with defaults
  createRuleData.value = {
    type: 'contains',
    pattern: transaction.name.toLowerCase(),
    category: transaction.currentCategory || transaction.newCategory || 'guilt_free'
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
    confidence: 1.0,
    frequency: 1,
    priority: 300, // Highest priority for user-created rules
    source: 'user_created',
    explain: `User-created rule from transaction: "${createRuleTransaction.value.name}"`,
    actualMatches: 1,
    coverage: 0,
    isNewRule: true,
    parentRuleId: createRuleParent.value?.id,
    transactionId: createRuleTransaction.value.id
  }
  
  // Add to new rules list (will appear at top due to effectiveRules ordering)
  newRules.value.push(newRule)
  
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
  return `$${Math.abs(Number(amount)).toFixed(2)}`
}

function showSnackMessage(message) {
  snackMessage.value = message
  showSnack.value = true
  setTimeout(() => {
    showSnack.value = false
  }, 4000)
}


</script>

<style scoped>
.auto-rules-review {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  text-align: center;
  margin-bottom: 30px;
}

.header h3 {
  margin: 0 0 10px 0;
  color: #2c3e50;
  font-size: 24px;
}

.subtitle {
  color: #7f8c8d;
  margin: 0;
  font-size: 16px;
}

.no-rules {
  text-align: center;
  padding: 40px;
  color: #7f8c8d;
}

.stats {
  display: flex;
  justify-content: center;
  gap: 30px;
  margin-bottom: 30px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.stat-item {
  text-align: center;
}

.stat-number {
  display: block;
  font-size: 24px;
  font-weight: bold;
  color: #2c3e50;
}

.stat-label {
  font-size: 14px;
  color: #7f8c8d;
}

.rule-types {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin-bottom: 30px;
  justify-content: center;
}

.rule-type {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #e9ecef;
  border-radius: 20px;
  font-size: 14px;
}

.type-label {
  color: #6c757d;
}

.type-count {
  font-weight: bold;
  color: #2c3e50;
}

.rules-list {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
}

.rules-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
}

.select-all {
  display: flex;
  align-items: center;
}

.view-toggle {
  display: flex;
  gap: 5px;
}

.toggle-btn {
  padding: 8px 16px;
  border: 1px solid #dee2e6;
  background: white;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.toggle-btn:first-child {
  border-radius: 4px 0 0 4px;
}

.toggle-btn:last-child {
  border-radius: 0 4px 4px 0;
}

.toggle-btn.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.rules-container {
  max-height: 600px;
  overflow-y: auto;
}

.rule-item {
  border-bottom: 1px solid #f1f3f4;
  transition: background-color 0.2s;
}

.rule-item:hover {
  background: #f8f9fa;
}


.rule-main {
  display: flex;
  align-items: flex-start;
  padding: 20px;
  gap: 15px;
}

.rule-checkbox {
  margin-top: 5px;
}

.rule-content {
  flex: 1;
}

.rule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.rule-pattern {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rule-type-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
}

.rule-type-badge.contains {
  background: #d4edda;
  color: #155724;
}

.rule-type-badge.regex {
  background: #d1ecf1;
  color: #0c5460;
}

.rule-type-badge.exact {
  background: #f8d7da;
  color: #721c24;
}

.rule-type-badge.mcc {
  background: #fff3cd;
  color: #856404;
}

.pattern {
  background: #f8f9fa;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
}

.category-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
}

.category-badge.fixed_costs {
  background: #e3f2fd;
  color: #1976d2;
}

.category-badge.investments {
  background: #e8f5e8;
  color: #388e3c;
}

.category-badge.guilt_free {
  background: #fff3e0;
  color: #f57c00;
}

.category-badge.short_term_savings {
  background: #f3e5f5;
  color: #7b1fa2;
}

.rule-details {
  margin-bottom: 15px;
}

.rule-stats {
  display: flex;
  gap: 20px;
  margin-bottom: 8px;
  font-size: 14px;
}

.stat {
  color: #6c757d;
}

.stat strong {
  color: #2c3e50;
}

.stat.source {
  font-style: italic;
  color: #6c757d;
}

.rule-explanation {
  margin: 0;
  color: #6c757d;
  font-size: 14px;
  line-height: 1.4;
}

.rule-preview {
  margin-top: 15px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 6px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: bold;
  color: #2c3e50;
}

.preview-count {
  color: #6c757d;
  font-weight: normal;
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-item {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1.5fr;
  gap: 15px;
  padding: 8px 12px;
  background: white;
  border-radius: 4px;
  font-size: 13px;
  align-items: center;
}

.merchant {
  font-weight: 500;
  color: #2c3e50;
}

.amount {
  text-align: right;
  color: #6c757d;
}

.date {
  color: #6c757d;
}

.category-change {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 3px;
  background: #e9ecef;
  color: #6c757d;
}

.category-change.changed {
  background: #d4edda;
  color: #155724;
}

.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #dee2e6;
}

.actions-info {
  flex: 1;
  margin-left: 20px;
}

.actions-info p {
  margin: 0;
  color: #6c757d;
  font-size: 14px;
  font-style: italic;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn.loading {
  position: relative;
  color: transparent;
}

.btn.loading::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  border: 2px solid transparent;
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: translate(-50%, -50%) rotate(0deg); }
  100% { transform: translate(-50%, -50%) rotate(360deg); }
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 14px;
  gap: 8px;
}

.checkbox-label input[type="checkbox"] {
  display: none;
}

.checkmark {
  width: 18px;
  height: 18px;
  border: 2px solid #dee2e6;
  border-radius: 3px;
  position: relative;
  transition: all 0.2s;
}

.checkbox-label input[type="checkbox"]:checked + .checkmark {
  background: #007bff;
  border-color: #007bff;
}

.checkbox-label input[type="checkbox"]:checked + .checkmark::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 2px;
  width: 4px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.checkbox-label input[type="checkbox"]:indeterminate + .checkmark {
  background: #007bff;
  border-color: #007bff;
}

.checkbox-label input[type="checkbox"]:indeterminate + .checkmark::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 7px;
  width: 8px;
  height: 2px;
  background: white;
}

/* Rule Actions */
.rule-actions {
  display: flex;
  align-items: center;
  gap: 15px;
}

.action-buttons {
  display: flex;
  gap: 5px;
}

.action-btn {
  background: none;
  border: none;
  padding: 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  opacity: 0.7;
}

.action-btn:hover {
  opacity: 1;
  background: #f8f9fa;
}

.action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.edit-btn:hover {
  background: #e3f2fd;
}

.expand-btn:hover {
  background: #f3e5f5;
}

.remove-btn:hover {
  background: #ffebee;
}

.apply-btn {
  background: #28a745 !important;
  color: white !important;
  font-weight: 500;
  padding: 6px 12px !important;
  border-radius: 4px;
  font-size: 12px;
}

.apply-btn:hover {
  background: #218838 !important;
  transform: translateY(-1px);
}

.apply-btn:disabled {
  background: #6c757d !important;
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Editing Mode */
.rule-editing {
  margin-top: 15px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 2px solid #007bff;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.edit-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.edit-row label {
  min-width: 80px;
  font-weight: 500;
  color: #2c3e50;
}

.edit-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-size: 14px;
}

.pattern-input {
  font-family: 'Courier New', monospace;
}

.edit-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.btn-sm {
  padding: 8px 16px;
  font-size: 14px;
}

/* Expanded Transactions */
.rule-transactions {
  margin-top: 15px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.transactions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  font-weight: bold;
  color: #2c3e50;
}

.transactions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.transaction-item:hover {
  background: #f8f9fa;
}

/* Rule States */
.rule-item.editing {
  border: 2px solid #007bff;
  background: #f8f9fa;
}

.rule-item.expanded {
  border: 1px solid #dee2e6;
}

.rule-item.removed {
  opacity: 0.5;
  text-decoration: line-through;
}

/* New Rule Badge */
.new-rule-badge {
  background: #28a745;
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: bold;
  text-transform: uppercase;
  margin-left: 8px;
}

/* Create Rule Button */
.create-rule-btn {
  background: #17a2b8;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.create-rule-btn:hover {
  background: #138496;
  transform: translateY(-1px);
}

.create-rule-btn:active {
  transform: translateY(0);
}

/* Update transaction item grid to accommodate the button */
.transaction-item {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1.5fr auto;
  gap: 15px;
  padding: 12px 16px;
  background: white;
  border-radius: 6px;
  font-size: 14px;
  align-items: center;
  border: 1px solid #e9ecef;
}

/* Create Rule Dialog */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #dee2e6;
}

.dialog-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 20px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6c757d;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f8f9fa;
  color: #2c3e50;
}

.dialog-content {
  padding: 20px;
}

.transaction-info {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 6px;
  margin-bottom: 20px;
}

.transaction-info h4 {
  margin: 0 0 10px 0;
  color: #2c3e50;
  font-size: 16px;
}

.transaction-info p {
  margin: 5px 0;
  color: #6c757d;
  font-size: 14px;
}

.rule-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-row label {
  font-weight: 500;
  color: #2c3e50;
  font-size: 14px;
}

.form-input {
  padding: 10px 12px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.pattern-input {
  font-family: 'Courier New', monospace;
}

.regex-input {
  font-family: 'Courier New', monospace;
  background: #f8f9fa;
}

.form-help {
  color: #6c757d;
  font-size: 12px;
  margin-top: 4px;
}

.pattern-preview {
  background: #e3f2fd;
  padding: 8px 12px;
  border-radius: 4px;
  margin-top: 8px;
  font-size: 13px;
  color: #1976d2;
}

.pattern-preview code {
  background: #bbdefb;
  padding: 2px 4px;
  border-radius: 2px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 20px;
  border-top: 1px solid #dee2e6;
  background: #f8f9fa;
  border-radius: 0 0 8px 8px;
}

/* Snack Message */
.snack-message {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #2c3e50;
  color: white;
  padding: 12px 24px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  font-size: 14px;
  font-weight: 500;
  z-index: 1001;
  animation: snackSlideIn 0.3s ease-out;
  max-width: 90%;
  text-align: center;
}

@keyframes snackSlideIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>
