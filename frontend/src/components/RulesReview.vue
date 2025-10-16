<script setup>
import { ref, computed, watch } from 'vue'
import api from './api.js'
import MultiLabelSelector from './MultiLabelSelector.vue'

const props = defineProps({ 
  usedRules: Array,
  accounts: Array
})

const emit = defineEmits(['commit', 'cancel'])

const currentCategoryStep = ref(0)
const categorySteps = ['fixed_costs', 'investments', 'guilt_free', 'short_term_savings']
const categoryStepNames = ['Fixed Costs', 'Investments', 'Guilt Free', 'Short Term Savings']

const expandedRules = ref(new Set())
const editingRule = ref(null)
const deletingRule = ref(null)
const rulePreview = ref([])
const showPreview = ref(false)
const editForm = ref({
  category: '',
  match_type: '',
  pattern: '',
  explain: '',
  labels: []
})
const saving = ref(false)

const matchTypes = [
  { value: 'exact', label: 'Exact Match' },
  { value: 'contains', label: 'Contains' },
  { value: 'regex', label: 'Regular Expression' }
]

const currentCategoryRules = computed(() => {
  if (!props.usedRules) return []
  
  return props.usedRules
    .filter(rule => rule.category === categorySteps[currentCategoryStep.value])
    .sort((a, b) => {
      // Sort by priority (higher first), then by type (user rules first)
      if (a.priority !== b.priority) return b.priority - a.priority
      if (a.type !== b.type) return a.type === 'user_rule' ? -1 : 1
      return 0
    })
})

const hasMoreCategories = computed(() => {
  return currentCategoryStep.value < categorySteps.length - 1
})

const hasPreviousCategories = computed(() => {
  return currentCategoryStep.value > 0
})

const totalRules = computed(() => {
  return props.usedRules ? props.usedRules.length : 0
})

const totalTransactions = computed(() => {
  if (!props.usedRules) return 0
  return props.usedRules.reduce((sum, rule) => sum + (rule.transactions?.length || 0), 0)
})

function getAccountName(accountId) {
  const account = props.accounts.find(a => a.id === accountId)
  return account ? account.name : 'Unknown Account'
}

function toggleRuleExpansion(ruleId) {
  if (expandedRules.value.has(ruleId)) {
    expandedRules.value.delete(ruleId)
  } else {
    expandedRules.value.add(ruleId)
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

async function editRule(rule) {
  editingRule.value = rule
  editForm.value = {
    category: rule.category,
    match_type: rule.match_type,
    pattern: rule.pattern,
    explain: rule.explain || '',
    labels: rule.labels || []
  }
  await previewRuleImpact(rule)
}

async function deleteRule(rule) {
  deletingRule.value = rule
  await previewRuleImpact(rule)
}

async function previewRuleImpact(rule) {
  try {
    const affected = await api.previewRule({
      category: rule.category,
      match_type: rule.match_type,
      pattern: rule.pattern
    })
    rulePreview.value = affected
    showPreview.value = true
  } catch (error) {
    console.error('Error previewing rule impact:', error)
    alert('Error previewing rule impact: ' + error.message)
  }
}

async function confirmDeleteRule() {
  if (!deletingRule.value) return
  
  try {
    // For pattern rules, use pattern: prefix, for user rules use the id directly
    const ruleId = deletingRule.value.type === 'pattern' 
      ? `pattern:${deletingRule.value.id}` 
      : deletingRule.value.id
    
    await api.deleteRule(ruleId)
    showPreview.value = false
    deletingRule.value = null
    // Refresh the rules by emitting an event
    emit('refresh-rules')
  } catch (error) {
    console.error('Error deleting rule:', error)
    alert('Error deleting rule: ' + error.message)
  }
}

async function saveRule() {
  if (!editingRule.value) return
  
  saving.value = true
  try {
    // For pattern rules, use pattern: prefix, for user rules use the id directly
    const ruleId = editingRule.value.type === 'pattern' 
      ? `pattern:${editingRule.value.id}` 
      : editingRule.value.id
    
    await api.updateRule(ruleId, editForm.value)
    showPreview.value = false
    editingRule.value = null
    // Refresh the rules by emitting an event
    emit('refresh-rules')
  } catch (error) {
    console.error('Error updating rule:', error)
    alert('Error updating rule: ' + error.message)
  } finally {
    saving.value = false
  }
}

function cancelEdit() {
  editingRule.value = null
  showPreview.value = false
  editForm.value = {
    category: '',
    match_type: '',
    pattern: '',
    explain: '',
    labels: []
  }
}

function cancelDelete() {
  deletingRule.value = null
  showPreview.value = false
}

function commitImport() {
  emit('commit')
}

function cancelImport() {
  emit('cancel')
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

</script>

<template>
  <v-card>
    <v-card-title class="text-h6 mb-4">
      <v-icon left>mdi-rule</v-icon>
      Review Rules Used in Import
    </v-card-title>

    <v-card variant="outlined" class="mb-4">
      <v-card-text>
        <v-row class="align-center mb-4">
          <v-col cols="auto">
            <v-btn
              @click="previousCategory"
              :disabled="!hasPreviousCategories"
              color="secondary"
              variant="outlined"
            >
              <v-icon left>mdi-chevron-left</v-icon>
              Previous
            </v-btn>
          </v-col>
          <v-col>
            <v-chip
              color="primary"
              variant="outlined"
              size="large"
              class="text-h6"
            >
              {{ categoryStepNames[currentCategoryStep] }} 
              ({{ currentCategoryRules.length }} rules, {{ currentCategoryRules.reduce((sum, r) => sum + (r.transactions?.length || 0), 0) }} transactions)
            </v-chip>
          </v-col>
          <v-col cols="auto">
            <v-btn
              @click="nextCategory"
              :disabled="!hasMoreCategories"
              color="secondary"
              variant="outlined"
            >
              Next
              <v-icon right>mdi-chevron-right</v-icon>
            </v-btn>
          </v-col>
        </v-row>

        <!-- Rules List -->
        <div v-if="currentCategoryRules.length > 0">
          <v-card
            v-for="rule in currentCategoryRules"
            :key="rule.id || rule.pattern"
            variant="outlined"
            class="mb-3"
          >
            <v-card-title class="d-flex align-center">
              <div class="flex-grow-1">
                <div class="text-h6">{{ rule.pattern }}</div>
                <div class="text-caption text-medium-emphasis">
                  {{ rule.match_type }} • {{ rule.explain }}
                  <span v-if="rule.transactions"> • {{ rule.transactions.length }} transactions</span>
                </div>
              </div>
              
              <div class="d-flex align-center">
                <v-btn
                  @click="toggleRuleExpansion(rule.id || rule.pattern)"
                  :icon="expandedRules.has(rule.id || rule.pattern) ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                  variant="text"
                  size="small"
                  class="mr-2"
                >
                  {{ expandedRules.has(rule.id || rule.pattern) ? 'Collapse' : 'Expand' }}
                </v-btn>
                
                <v-btn
                  @click="editRule(rule)"
                  icon="mdi-pencil"
                  variant="text"
                  size="small"
                  class="mr-2"
                />
                
                <v-btn
                  @click="deleteRule(rule)"
                  icon="mdi-delete"
                  variant="text"
                  size="small"
                  color="error"
                />
              </div>
            </v-card-title>
            
            <!-- Expanded Transactions -->
            <v-card-text v-if="expandedRules.has(rule.id || rule.pattern) && rule.transactions">
              <v-data-table
                :headers="[
                  { title: 'Date', key: 'date', sortable: true },
                  { title: 'Account', key: 'account', sortable: true },
                  { title: 'Name', key: 'name', sortable: true },
                  { title: 'Amount', key: 'amount', sortable: true },
                  { title: 'Type', key: 'type', sortable: true }
                ]"
                :items="rule.transactions"
                class="elevation-1"
                density="compact"
              >
                <template v-slot:item.account="{ item }">
                  {{ getAccountName(item.account_id) }}
                </template>
                
                <template v-slot:item.amount="{ item }">
                  <span class="font-weight-medium">
                    ${{ item.amount !== null && item.amount !== undefined && !isNaN(item.amount) ? Number(item.amount).toFixed(2) : '0.00' }}
                  </span>
                </template>
                
                <template v-slot:item.type="{ item }">
                  <v-chip
                    :color="item.inflow ? 'success' : 'error'"
                    size="small"
                    variant="outlined"
                  >
                    {{ item.inflow ? 'Income' : 'Expense' }}
                  </v-chip>
                </template>
              </v-data-table>
            </v-card-text>
          </v-card>
        </div>

        <v-alert
          v-else
          type="info"
          variant="outlined"
          class="text-center"
        >
          No rules found for {{ categoryStepNames[currentCategoryStep] }}.
        </v-alert>
      </v-card-text>
    </v-card>

    <v-row>
      <v-col cols="12" sm="4">
        <v-btn
          v-if="hasMoreCategories"
          @click="nextCategory"
          color="secondary"
          variant="outlined"
          block
        >
          <v-icon left>mdi-chevron-right</v-icon>
          Next Category
        </v-btn>
        <v-btn
          v-else
          @click="commitImport"
          color="primary"
          block
        >
          <v-icon left>mdi-import</v-icon>
          Import All Transactions
        </v-btn>
      </v-col>
      <v-col cols="12" sm="4">
        <v-btn
          @click="cancelImport"
          color="secondary"
          variant="outlined"
          block
        >
          <v-icon left>mdi-cancel</v-icon>
          Cancel
        </v-btn>
      </v-col>
    </v-row>

    <!-- Rule Preview Dialog -->
    <v-dialog v-model="showPreview" max-width="800">
      <v-card>
        <v-card-title class="text-h6">
          <v-icon left color="warning">mdi-eye</v-icon>
          {{ editingRule ? 'Edit Rule' : 'Rule Impact Preview' }}
        </v-card-title>
        
        <v-card-text>
          <!-- Edit Form -->
          <v-form v-if="editingRule" class="mb-4">
            <v-row>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="editForm.category"
                  :items="categorySteps"
                  :item-title="(item, index) => categoryStepNames[index]"
                  :item-value="(item) => item"
                  label="Category"
                  variant="outlined"
                  density="compact"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="editForm.match_type"
                  :items="matchTypes"
                  item-title="label"
                  item-value="value"
                  label="Match Type"
                  variant="outlined"
                  density="compact"
                />
              </v-col>
            </v-row>
            
            <v-row>
              <v-col cols="12">
                <v-text-field
                  v-model="editForm.pattern"
                  label="Pattern"
                  variant="outlined"
                  density="compact"
                  hint="Enter the text pattern to match against transaction names/descriptions"
                  persistent-hint
                />
              </v-col>
            </v-row>
            
            <v-row>
              <v-col cols="12">
                <v-text-field
                  v-model="editForm.explain"
                  label="Explanation (Optional)"
                  variant="outlined"
                  density="compact"
                  hint="Optional explanation for this rule"
                  persistent-hint
                />
              </v-col>
            </v-row>
            
            <v-row>
              <v-col cols="12">
                <MultiLabelSelector
                  v-model="editForm.labels"
                  label="Labels (Optional)"
                  placeholder="e.g., Coffee, Travel, Work"
                  hint="Optional labels for grouping transactions"
                />
              </v-col>
            </v-row>
          </v-form>
          
          <v-alert
            v-if="deletingRule"
            type="warning"
            variant="tonal"
            class="mb-4"
          >
            <strong>Warning:</strong> This will delete the rule and affect {{ rulePreview.length }} transactions.
          </v-alert>
          
          <v-alert
            v-if="editingRule"
            type="info"
            variant="tonal"
            class="mb-4"
          >
            <strong>Info:</strong> This rule currently affects {{ rulePreview.length }} transactions.
          </v-alert>
          
          <v-data-table
            v-if="rulePreview.length > 0"
            :headers="[
              { title: 'Date', key: 'date', sortable: true },
              { title: 'Account', key: 'account_name', sortable: true },
              { title: 'Name', key: 'name', sortable: true },
              { title: 'Amount', key: 'amount', sortable: true },
              { title: 'Current Category', key: 'currentCategory', sortable: true },
              { title: 'New Category', key: 'newCategory', sortable: true },
              { title: 'Would Change', key: 'wouldChange', sortable: false }
            ]"
            :items="rulePreview"
            class="elevation-1"
            density="compact"
          >
            <template v-slot:item.amount="{ item }">
              <span class="font-weight-medium">
                ${{ item.amount !== null && item.amount !== undefined && !isNaN(item.amount) ? Number(item.amount).toFixed(2) : '0.00' }}
              </span>
            </template>
            
            <template v-slot:item.wouldChange="{ item }">
              <v-chip
                :color="item.wouldChange ? 'warning' : 'success'"
                size="small"
                variant="outlined"
              >
                {{ item.wouldChange ? 'Yes' : 'No' }}
              </v-chip>
            </template>
          </v-data-table>
          
          <v-alert
            v-else
            type="info"
            variant="outlined"
            class="text-center"
          >
            No transactions would be affected by this rule.
          </v-alert>
        </v-card-text>
        
        <v-card-actions>
          <v-spacer />
          <v-btn
            @click="cancelEdit(); cancelDelete()"
          >
            Cancel
          </v-btn>
          <v-btn
            v-if="editingRule"
            color="primary"
            :loading="saving"
            @click="saveRule"
          >
            <v-icon left>mdi-content-save</v-icon>
            Save Rule
          </v-btn>
          <v-btn
            v-if="deletingRule"
            color="error"
            @click="confirmDeleteRule"
          >
            <v-icon left>mdi-delete</v-icon>
            Delete Rule
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<style scoped>
.v-list-item {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.v-list-item:last-child {
  border-bottom: none;
}
</style>
