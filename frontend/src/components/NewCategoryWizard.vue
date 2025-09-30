<template>
  <div class="new-category-wizard">
    <h2>New Category Rule Wizard</h2>
    
    <!-- Step 1: Rule Creation Form -->
    <div v-if="step === 1" class="step">
      <h3>Step 1: Create New Rule</h3>
      <form @submit.prevent="previewRule" class="rule-form">
        <div class="form-group">
          <label for="category">Category:</label>
          <select id="category" v-model="ruleForm.category" required>
            <option value="">Select a category</option>
            <option value="guilt_free">Guilt Free</option>
            <option value="short_term_savings">Short Term Savings</option>
            <option value="fixed_costs">Fixed Costs</option>
            <option value="investments">Investments</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="match_type">Match Type:</label>
          <select id="match_type" v-model="ruleForm.match_type" required>
            <option value="">Select match type</option>
            <option value="exact">Exact Match</option>
            <option value="contains">Contains</option>
            <option value="regex">Regular Expression</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="pattern">Pattern:</label>
          <input 
            id="pattern" 
            v-model="ruleForm.pattern" 
            type="text" 
            required 
            :placeholder="getPatternPlaceholder()"
          />
          <small class="help-text">{{ getPatternHelp() }}</small>
        </div>
        
        <div class="form-group">
          <label for="explain">Explanation (optional):</label>
          <input 
            id="explain" 
            v-model="ruleForm.explain" 
            type="text" 
            placeholder="Why this rule exists"
          />
        </div>
        
        <div class="form-actions">
          <button type="submit" :disabled="!isFormValid || loading">
            {{ loading ? 'Previewing...' : 'Preview Rule Impact' }}
          </button>
        </div>
      </form>
    </div>
    
    <!-- Step 2: Preview Affected Transactions -->
    <div v-if="step === 2" class="step">
      <h3>Step 2: Review Affected Transactions</h3>
      
      <div class="preview-summary">
        <p><strong>Rule:</strong> {{ ruleForm.match_type }} "{{ ruleForm.pattern }}" → {{ ruleForm.category }}</p>
        <p><strong>Affected Transactions:</strong> {{ previewData.count }} total</p>
        <p><strong>Would Change:</strong> {{ changedCount }} transactions</p>
      </div>
      
      <div v-if="previewData.affectedTransactions.length > 0" class="transactions-preview">
        <h4>Affected Transactions:</h4>
        <div class="table-container">
          <table border="1" cellpadding="6">
            <thead>
              <tr>
                <th>Date</th>
                <th>Account</th>
                <th>Name</th>
                <th>Amount</th>
                <th>Current Category</th>
                <th>New Category</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="tx in previewData.affectedTransactions" 
                :key="tx.id"
                :class="{ 'would-change': tx.wouldChange }"
              >
                <td>{{ tx.date }}</td>
                <td>{{ tx.account_name }}</td>
                <td>{{ tx.name }}</td>
                <td>{{ Number(tx.amount).toFixed(2) }}</td>
                <td>{{ tx.currentCategory || '(none)' }}</td>
                <td>{{ tx.newCategory }}</td>
                <td>
                  <span v-if="tx.wouldChange" class="change-indicator">✓</span>
                  <span v-else class="no-change">-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <div v-else class="no-transactions">
        <p>No transactions would be affected by this rule.</p>
      </div>
      
      <div class="form-actions">
        <button @click="step = 1" class="secondary">Back to Edit Rule</button>
        <button @click="createRule" :disabled="loading" class="primary">
          {{ loading ? 'Creating...' : 'Create Rule' }}
        </button>
      </div>
    </div>
    
    <!-- Step 3: Success -->
    <div v-if="step === 3" class="step">
      <h3>Rule Created Successfully!</h3>
      <div class="success-message">
        <p>Your new categorization rule has been created and will take precedence over existing rules.</p>
        <p><strong>Rule ID:</strong> {{ createdRuleId }}</p>
        <p><strong>Affected:</strong> {{ previewData.count }} transactions</p>
      </div>
      
      <div class="form-actions">
        <button @click="resetWizard" class="primary">Create Another Rule</button>
        <button @click="$emit('close')" class="secondary">Close Wizard</button>
      </div>
    </div>
    
    <!-- Error Display -->
    <div v-if="error" class="error-message">
      <p>{{ error }}</p>
      <button @click="error = null">Dismiss</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import api from './api.js'

const emit = defineEmits(['close'])

const step = ref(1)
const loading = ref(false)
const error = ref(null)
const createdRuleId = ref(null)

const ruleForm = ref({
  category: '',
  match_type: '',
  pattern: '',
  explain: ''
})

const previewData = ref({
  affectedTransactions: [],
  count: 0,
  rule: null
})

const isFormValid = computed(() => {
  return ruleForm.value.category && 
         ruleForm.value.match_type && 
         ruleForm.value.pattern.trim()
})

const changedCount = computed(() => {
  return previewData.value.affectedTransactions.filter(tx => tx.wouldChange).length
})

function getPatternPlaceholder() {
  switch (ruleForm.value.match_type) {
    case 'exact': return 'e.g., "STARBUCKS"'
    case 'contains': return 'e.g., "AMZN"'
    case 'regex': return 'e.g., "\\bTORONTO\\s*HYDRO\\b"'
    default: return 'Enter pattern'
  }
}

function getPatternHelp() {
  switch (ruleForm.value.match_type) {
    case 'exact': return 'Must match exactly (case-insensitive)'
    case 'contains': return 'Transaction name/description must contain this text'
    case 'regex': return 'Regular expression pattern (case-insensitive)'
    default: return ''
  }
}

async function previewRule() {
  if (!isFormValid.value) return
  
  loading.value = true
  error.value = null
  
  try {
    const result = await api.previewRule(ruleForm.value)
    previewData.value = result
    step.value = 2
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to preview rule'
  } finally {
    loading.value = false
  }
}

async function createRule() {
  loading.value = true
  error.value = null
  
  try {
    const result = await api.createRule(ruleForm.value)
    createdRuleId.value = result.ruleId
    step.value = 3
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to create rule'
  } finally {
    loading.value = false
  }
}

function resetWizard() {
  step.value = 1
  ruleForm.value = {
    category: '',
    match_type: '',
    pattern: '',
    explain: ''
  }
  previewData.value = {
    affectedTransactions: [],
    count: 0,
    rule: null
  }
  createdRuleId.value = null
  error.value = null
}
</script>

<style scoped>
.new-category-wizard {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.step {
  background: #f9f9f9;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.rule-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group label {
  font-weight: bold;
}

.form-group input,
.form-group select {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.help-text {
  color: #666;
  font-size: 12px;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.form-actions button {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.form-actions button.primary {
  background: #007bff;
  color: white;
}

.form-actions button.secondary {
  background: #6c757d;
  color: white;
}

.form-actions button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.preview-summary {
  background: #e9ecef;
  padding: 16px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.preview-summary p {
  margin: 4px 0;
}

.transactions-preview {
  margin-bottom: 20px;
}

.table-container {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

th {
  background: #f8f9fa;
  position: sticky;
  top: 0;
  z-index: 1;
}

tr.would-change {
  background: #fff3cd;
}

.change-indicator {
  color: #28a745;
  font-weight: bold;
}

.no-change {
  color: #6c757d;
}

.no-transactions {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}

.success-message {
  background: #d4edda;
  border: 1px solid #c3e6cb;
  color: #155724;
  padding: 16px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.error-message {
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
  padding: 16px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.error-message button {
  background: #dc3545;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 8px;
}
</style>
