<template>
  <div 
    class="rule-item"
    :class="[
      ruleType,
      { 
        editing: isEditing,
        expanded: isExpanded
      }
    ]"
  >
    <div class="rule-main">
      <div class="rule-content">
        <!-- Rule Header with Actions -->
        <div class="rule-header">
          <div class="rule-pattern">
            <span class="rule-type-badge" :class="rule.match_type || rule.type || 'existing'">{{ rule.match_type || rule.type || 'existing' }}</span>
            <code class="pattern">{{ rule.pattern }}</code>
            <span v-if="rule.isNewRule" class="new-rule-badge">NEW</span>
            <span v-if="rule.priority" class="priority-badge">Priority: {{ rule.priority }}</span>
          </div>
          <div class="rule-actions">
            <div class="rule-category">
              <span class="category-badge" :class="rule.category">{{ getCategoryName(rule.category) }}</span>
            </div>
            <div class="action-buttons">
              <button 
                class="action-btn edit-btn" 
                @click="startEditing"
                :disabled="isEditing"
                title="Edit rule"
              >
                ✏️
              </button>
              <button 
                class="action-btn remove-btn" 
                @click="removeRule"
                title="Remove rule"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>

        <!-- Editing Mode -->
        <div v-if="isEditing" class="rule-editing">
          <div class="edit-form">
            <div class="edit-row">
              <label>Type:</label>
              <select v-model="editData.match_type" class="edit-input">
                <option value="contains">Contains</option>
                <option value="regex">Regex</option>
                <option value="exact">Exact</option>
                <option v-if="ruleType === 'auto-rule'" value="mcc">MCC</option>
              </select>
            </div>
            <div class="edit-row">
              <label>Pattern:</label>
              <input 
                v-model="editData.pattern" 
                class="edit-input pattern-input"
                placeholder="Enter pattern..."
              >
            </div>
            <div class="edit-row">
              <label>Category:</label>
              <select v-model="editData.category" class="edit-input">
                <option 
                  v-for="option in categoryOptions" 
                  :key="option.value" 
                  :value="option.value"
                >
                  {{ option.title }}
                </option>
              </select>
            </div>
            <div class="edit-actions">
              <button 
                class="btn btn-sm btn-primary" 
                @click="saveEdit"
                :disabled="isSaving"
              >
                <span v-if="isSaving">Saving...</span>
                <span v-else>Save</span>
              </button>
              <button 
                class="btn btn-sm btn-secondary" 
                @click="cancelEdit"
                :disabled="isSaving"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        <!-- Normal View -->
        <div v-else class="rule-details">
          <div class="rule-stats">
            <span class="stat">
              <strong>{{ getTransactionCount() }}</strong> transactions
            </span>
            <span v-if="rule.explain" class="stat">
              <strong>{{ rule.explain }}</strong>
            </span>
            <span v-if="rule.source" class="stat source">
              {{ rule.source }}
            </span>
          </div>
        </div>

        <!-- Expanded Transactions View -->
        <div v-if="isExpanded" class="rule-transactions">
          <div class="transactions-header">
            <span>{{ getTransactionHeaderText() }}</span>
            <button 
              class="btn btn-sm btn-secondary" 
              @click="toggleExpanded"
            >
              📖 Collapse
            </button>
          </div>
          <div class="transactions-list">
            <div 
              v-for="transaction in getTransactions()" 
              :key="transaction.id"
              class="transaction-item"
            >
              <span class="merchant">{{ transaction.name }}</span>
              <span class="amount">{{ formatAmount(transaction.amount) }}</span>
              <span class="date">{{ formatDate(transaction.date) }}</span>
              <span v-if="transaction.account_id" class="account">{{ getAccountName(transaction.account_id) }}</span>
              <span 
                v-if="transaction.wouldChange"
                class="category-change"
                :class="{ changed: transaction.wouldChange }"
              >
                {{ transaction.wouldChange ? '→ ' + getCategoryName(transaction.newCategory) : getCategoryName(transaction.currentCategory) }}
              </span>
              <button 
                v-if="showCreateRuleButton"
                class="create-rule-btn"
                @click="createRuleFromTransaction(transaction)"
                title="Create rule from this transaction"
              >
                ➕ Create Rule
              </button>
            </div>
          </div>
        </div>

        <!-- Sample Match (when not expanded) -->
        <div v-else class="rule-preview">
          <div class="preview-header">
            <span>Sample match:</span>
            <div class="preview-count-container">
              <span class="preview-count">{{ getTransactionCount() }} total transactions</span>
              <button 
                class="action-btn expand-btn" 
                @click="toggleExpanded"
                :title="isExpanded ? 'Collapse' : 'Show transactions'"
              >
                <span>📄 Expand</span>
              </button>
            </div>
          </div>
          <div class="preview-list">
            <div 
              v-for="transaction in getSampleTransactions()" 
              :key="transaction.id"
              class="preview-item"
            >
              <span class="merchant">{{ transaction.name }}</span>
              <span class="amount">{{ formatAmount(transaction.amount) }}</span>
              <span class="date">{{ formatDate(transaction.date) }}</span>
              <span v-if="transaction.account_id" class="account">{{ getAccountName(transaction.account_id) }}</span>
              <span 
                v-if="transaction.wouldChange"
                class="category-change"
                :class="{ changed: transaction.wouldChange }"
              >
                {{ transaction.wouldChange ? '→ ' + getCategoryName(transaction.newCategory) : getCategoryName(transaction.currentCategory) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { CATEGORY_SELECT_OPTIONS, getCategoryName } from '../config/categories.js'

export default {
  name: 'RuleItem',
  props: {
    rule: {
      type: Object,
      required: true
    },
    ruleType: {
      type: String,
      required: true,
      validator: value => ['existing-rule', 'auto-rule', 'new-rule'].includes(value)
    },
    accounts: {
      type: Array,
      default: () => []
    },
    isExpanded: {
      type: Boolean,
      default: false
    },
    isEditing: {
      type: Boolean,
      default: false
    },
    applying: {
      type: Boolean,
      default: false
    },
    isSaving: {
      type: Boolean,
      default: false
    },
    showCreateRuleButton: {
      type: Boolean,
      default: false
    }
  },
  emits: ['edit', 'save-edit', 'cancel-edit', 'remove', 'toggle-expanded', 'create-rule'],
  data() {
    return {
      editData: {
        match_type: '',
        pattern: '',
        category: '',
        explain: '',
        labels: []
      }
    }
  },
  computed: {
    categoryOptions() {
      return CATEGORY_SELECT_OPTIONS
    }
  },
  methods: {
    getCategoryName(category) {
      return getCategoryName(category)
    },

    getAccountName(accountId) {
      const account = this.accounts.find(a => a.id === accountId)
      return account ? account.name : 'Unknown Account'
    },

    formatAmount(amount) {
      if (amount === null || amount === undefined || isNaN(amount)) return '$0.00'
      return `$${Number(amount).toFixed(2)}`
    },

    formatDate(dateString) {
      if (!dateString) return 'Unknown'
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return 'Unknown'
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    },

    getTransactionCount() {
      // For auto-generated rules, use the actual frequency from backend analysis
      if (this.ruleType === 'auto-rule' && this.rule.frequency) {
        return this.rule.frequency
      }
      // For existing rules, use the transaction list length
      return this.rule.transactions?.length || 0
    },

    getTransactionHeaderText() {
      if (this.ruleType === 'existing-rule') {
        return `Matching transactions (${this.getTransactionCount()} total):`
      } else if (this.ruleType === 'new-rule') {
        return `New rule matches (${this.getTransactionCount()} total):`
      } else {
        return `All matching transactions (${this.getTransactionCount()} total):`
      }
    },

    getTransactions() {
      return this.rule.transactions || []
    },

    getSampleTransactions() {
      return (this.rule.transactions || []).slice(0, 1)
    },

    startEditing() {
      this.editData = {
        match_type: this.rule.match_type || this.rule.type,
        pattern: this.rule.pattern,
        category: this.rule.category,
        explain: this.rule.explain || '',
        labels: this.rule.labels || []
      }
      this.$emit('edit', this.rule)
    },

    saveEdit() {
      this.$emit('save-edit', this.rule, this.editData)
    },

    cancelEdit() {
      this.$emit('cancel-edit', this.rule)
    },

    removeRule() {
      this.$emit('remove', this.rule)
    },


    toggleExpanded() {
      this.$emit('toggle-expanded', this.rule)
    },

    createRuleFromTransaction(transaction) {
      this.$emit('create-rule', transaction, this.rule)
    }
  }
}
</script>

<style scoped>
/* Import the styles for RuleItem */
@import './RuleItem.css';
</style>
