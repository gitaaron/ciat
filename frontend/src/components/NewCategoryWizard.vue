<template>
  <v-card>
      <v-card-title class="text-h5">
        <v-icon left>mdi-plus-circle</v-icon>
        New Category Rule Wizard
      </v-card-title>
      
    
    <!-- Step 1: Rule Creation Form -->
    <v-card-text v-if="step === 1">
      <!-- Simple step indicator instead of stepper -->
      <v-chip color="primary" class="mb-4">
        Step 1 of 3: Create Rule
      </v-chip>

      <v-form @submit.prevent="previewRule">
        <v-row>
          <v-col cols="12" md="6">
            <v-select
              v-model="ruleForm.category"
              :items="[
                { title: 'Select a category', value: '' },
                { title: 'Guilt Free', value: 'guilt_free' },
                { title: 'Short Term Savings', value: 'short_term_savings' },
                { title: 'Fixed Costs', value: 'fixed_costs' },
                { title: 'Investments', value: 'investments' }
              ]"
              item-title="title"
              item-value="value"
              label="Category"
              variant="outlined"
              required
            />
          </v-col>
          
          <v-col cols="12" md="6">
            <v-select
              v-model="ruleForm.match_type"
              :items="[
                { title: 'Select match type', value: '' },
                { title: 'Exact Match', value: 'exact' },
                { title: 'Contains', value: 'contains' },
                { title: 'Regular Expression', value: 'regex' }
              ]"
              item-title="title"
              item-value="value"
              label="Match Type"
              variant="outlined"
              required
            />
          </v-col>
        </v-row>
        
        <v-row>
          <v-col cols="12">
            <v-text-field
              v-model="ruleForm.pattern"
              :placeholder="getPatternPlaceholder()"
              :hint="getPatternHelp()"
              label="Pattern"
              variant="outlined"
              required
              persistent-hint
            />
          </v-col>
        </v-row>
        
        <v-row>
          <v-col cols="12">
            <v-text-field
              v-model="ruleForm.explain"
              label="Explanation (optional)"
              placeholder="Why this rule exists"
              variant="outlined"
            />
          </v-col>
        </v-row>
        
        <v-row>
          <v-col cols="12">
            <v-btn
              type="submit"
              :disabled="!isFormValid || loading"
              :loading="loading"
              color="primary"
              size="large"
              block
            >
              <v-icon left>mdi-eye</v-icon>
              {{ loading ? 'Previewing...' : 'Preview Rule Impact' }}
            </v-btn>
          </v-col>
        </v-row>
      </v-form>
    </v-card-text>
    
    <!-- Step 2: Preview Affected Transactions -->
    <v-card-text v-if="step === 2">
      <!-- Simple step indicator -->
      <v-chip color="primary" class="mb-4">
        Step 2 of 3: Preview Impact
      </v-chip>
      
      <v-alert type="info" variant="outlined" class="mb-4">
        <div>
          <p><strong>Rule:</strong> {{ ruleForm.match_type }} "{{ ruleForm.pattern }}" → {{ ruleForm.category }}</p>
          <p><strong>Affected Transactions:</strong> {{ previewData.count }} total</p>
          <p><strong>Would Change:</strong> {{ changedCount }} transactions</p>
        </div>
      </v-alert>
      
      <v-card v-if="previewData.affectedTransactions.length > 0" variant="outlined" class="mb-4">
        <v-card-title class="text-h6">
          <v-icon left>mdi-format-list-bulleted</v-icon>
          Affected Transactions
        </v-card-title>
        <v-card-text>
          <v-data-table
            :headers="[
              { title: 'Date', key: 'date', sortable: true },
              { title: 'Account', key: 'account_name', sortable: true },
              { title: 'Name', key: 'name', sortable: true },
              { title: 'Amount', key: 'amount', sortable: true },
              { title: 'Current Category', key: 'currentCategory', sortable: false },
              { title: 'New Category', key: 'newCategory', sortable: false },
              { title: 'Change', key: 'wouldChange', sortable: false }
            ]"
            :items="previewData.affectedTransactions"
            class="elevation-1"
          >
            <template v-slot:item.amount="{ item }">
              <span class="font-weight-medium">
                ${{ Number(item.amount).toFixed(2) }}
              </span>
            </template>
            
            <template v-slot:item.currentCategory="{ item }">
              {{ item.currentCategory || '(none)' }}
            </template>
            
            <template v-slot:item.newCategory="{ item }">
              <v-chip color="primary" size="small" variant="outlined">
                {{ item.newCategory }}
              </v-chip>
            </template>
            
            <template v-slot:item.wouldChange="{ item }">
              <v-icon v-if="item.wouldChange" color="success">mdi-check</v-icon>
              <v-icon v-else color="grey">mdi-minus</v-icon>
            </template>
          </v-data-table>
        </v-card-text>
      </v-card>
      
      <v-alert
        v-else
        type="info"
        variant="outlined"
        class="mb-4"
      >
        <div>
          <p><strong>No transactions would be affected by this rule.</strong></p>
          <p v-if="previewData.count === 0" class="mb-0">
            This could mean either:
          </p>
          <ul v-if="previewData.count === 0" class="mb-0">
            <li>No transactions have been imported yet</li>
            <li>The rule pattern doesn't match any existing transactions</li>
          </ul>
        </div>
      </v-alert>
      
      <v-row>
        <v-col cols="12" sm="6">
          <v-btn
            @click="step = 1"
            color="secondary"
            variant="outlined"
            block
          >
            <v-icon left>mdi-arrow-left</v-icon>
            Back to Edit Rule
          </v-btn>
        </v-col>
        <v-col cols="12" sm="6">
          <v-btn
            @click="createRule"
            :disabled="loading"
            :loading="loading"
            color="primary"
            block
          >
            <v-icon left>mdi-plus</v-icon>
            {{ loading ? 'Creating...' : 'Create Rule' }}
          </v-btn>
        </v-col>
      </v-row>
    </v-card-text>
    
    <!-- Step 3: Success -->
    <v-card-text v-if="step === 3">
      <!-- Simple step indicator -->
      <v-chip color="success" class="mb-4">
        Step 3 of 3: Complete
      </v-chip>

      <v-card variant="outlined" class="text-center mb-4">
        <v-card-text class="pa-8">
          <v-icon size="80" color="success" class="mb-4">mdi-check-circle</v-icon>
          <h3 class="text-h4 mb-2 text-success">Rule Created Successfully!</h3>
          <v-alert type="success" variant="outlined" class="text-left">
            <p>Your new categorization rule has been created and will take precedence over existing rules.</p>
            <p><strong>Rule ID:</strong> {{ createdRuleId }}</p>
            <p><strong>Affected:</strong> {{ previewData.count }} transactions</p>
          </v-alert>
        </v-card-text>
      </v-card>
      
      <v-row>
        <v-col cols="12" sm="6">
          <v-btn
            @click="resetWizard"
            color="primary"
            block
          >
            <v-icon left>mdi-plus</v-icon>
            Create Another Rule
          </v-btn>
        </v-col>
        <v-col cols="12" sm="6">
          <v-btn
            @click="$emit('close')"
            color="secondary"
            variant="outlined"
            block
          >
            <v-icon left>mdi-close</v-icon>
            Close Wizard
          </v-btn>
        </v-col>
      </v-row>
    </v-card-text>
    
    <!-- Error Display -->
    <v-card-text v-if="error">
      <v-alert
        type="error"
        variant="outlined"
        closable
        @click:close="error = null"
      >
        {{ error }}
      </v-alert>
    </v-card-text>
  </v-card>
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

