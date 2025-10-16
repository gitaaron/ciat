<template>
  <v-card>
    <v-card-title class="text-h5">
      <v-icon left>mdi-cog</v-icon>
      Category Rules Management
    </v-card-title>

    <v-card-text>
      <v-card variant="outlined" class="mb-4">
        <v-card-title class="text-h6">
          <v-icon left>mdi-format-list-bulleted</v-icon>
          Existing Rules ({{ rules.length }})
        </v-card-title>
        <v-card-text>
          <v-alert type="info" variant="outlined" class="mb-4">
            Rules are applied in order of precedence (highest priority first, then most recent)
          </v-alert>
          
          
          <v-alert
            v-if="rules.length === 0"
            type="warning"
            variant="outlined"
            class="text-center"
          >
            No rules created yet. Use the "New Category Rule" wizard to create your first rule.
          </v-alert>
          
          <!-- Data table with simple configuration -->
          <v-data-table
            v-else
            :headers="[
              { title: 'Priority', key: 'priority' },
              { title: 'Category', key: 'category' },
              { title: 'Match Type', key: 'match_type' },
              { title: 'Pattern', key: 'pattern' },
              { title: 'Explanation', key: 'explain' },
              { title: 'Status', key: 'enabled' },
              { title: 'Actions', key: 'actions' }
            ]"
            :items="sortedRules"
            class="elevation-1"
          >
            <template v-slot:item.enabled="{ item }">
              <v-btn
                @click="toggleRule(item)"
                :color="item.enabled ? 'success' : 'error'"
                size="small"
                variant="outlined"
              >
                {{ item.enabled ? 'Enabled' : 'Disabled' }}
              </v-btn>
            </template>
            
            <template v-slot:item.actions="{ item }">
              <div class="d-flex flex-column ga-2 py-4">
                <v-btn 
                  @click="editRule(item)" 
                  color="primary" 
                  size="small"
                  variant="outlined"
                  block
                >
                  <v-icon left>mdi-pencil</v-icon>
                  Edit
                </v-btn>
                <v-btn 
                  @click="deleteRule(item)" 
                  color="error" 
                  size="small"
                  variant="outlined"
                  block
                >
                  <v-icon left>mdi-delete</v-icon>
                  Delete
                </v-btn>
              </div>
            </template>
          </v-data-table>
        </v-card-text>
      </v-card>
      
      <v-row>
        <v-col cols="12" sm="6">
          <v-btn
            @click="$emit('create-new')"
            color="primary"
            block
          >
            <v-icon left>mdi-plus</v-icon>
            Create New Rule
          </v-btn>
        </v-col>
        <v-col cols="12" sm="6">
          <v-btn
            @click="refreshRules"
            :loading="loading"
            color="secondary"
            variant="outlined"
            block
          >
            <v-icon left>mdi-refresh</v-icon>
            Refresh
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

  <!-- Edit Rule Dialog -->
  <v-dialog v-model="showEditDialog" max-width="600">
    <v-card>
      <v-card-title class="text-h6">
        <v-icon left color="primary">mdi-pencil</v-icon>
        Edit Rule
      </v-card-title>
      
      <v-card-text>
        <v-form class="mb-4">
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
      </v-card-text>
      
      <v-card-actions>
        <v-spacer />
        <v-btn
          @click="cancelEdit"
        >
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          :loading="saving"
          @click="saveRule"
        >
          <v-icon left>mdi-content-save</v-icon>
          Save Rule
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from './api.js'
import MultiLabelSelector from './MultiLabelSelector.vue'

const emit = defineEmits(['create-new'])

const rules = ref([])
const loading = ref(false)
const error = ref(null)
const editingRule = ref(null)
const editForm = ref({
  category: '',
  match_type: '',
  pattern: '',
  explain: '',
  labels: []
})
const saving = ref(false)
const showEditDialog = ref(false)

const matchTypes = [
  { value: 'exact', label: 'Exact Match' },
  { value: 'contains', label: 'Contains' },
  { value: 'regex', label: 'Regular Expression' }
]

const categorySteps = ['fixed_costs', 'investments', 'guilt_free', 'short_term_savings']
const categoryStepNames = ['Fixed Costs', 'Investments', 'Guilt Free', 'Short Term Savings']

const sortedRules = computed(() => {
  return [...rules.value].sort((a, b) => {
    // First sort by priority (highest first)
    if (b.priority !== a.priority) return b.priority - a.priority;
    // If same priority, most recent wins
    const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
    const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
    return bTime - aTime;
  });
});

async function loadRules() {
  loading.value = true
  error.value = null
  
  try {
    rules.value = await api.getRules()
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to load rules'
  } finally {
    loading.value = false
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
  showEditDialog.value = true
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
    showEditDialog.value = false
    editingRule.value = null
    await loadRules()
  } catch (err) {
    console.error('Error updating rule:', err)
    error.value = 'Error updating rule: ' + err.message
  } finally {
    saving.value = false
  }
}

function cancelEdit() {
  editingRule.value = null
  showEditDialog.value = false
  editForm.value = {
    category: '',
    match_type: '',
    pattern: '',
    explain: '',
    labels: []
  }
}

async function toggleRule(rule) {
  try {
    // For pattern rules, use pattern: prefix, for user rules use the id directly
    const ruleId = rule.type === 'pattern' 
      ? `pattern:${rule.id}` 
      : rule.id
    
    await api.toggleRule(ruleId, !rule.enabled)
    await loadRules()
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to toggle rule'
  }
}

async function deleteRule(rule) {
  if (!confirm(`Are you sure you want to delete this rule?\n\nPattern: ${rule.pattern}\nCategory: ${rule.category}`)) {
    return
  }
  
  try {
    await api.deleteRule(rule.id)
    await loadRules()
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to delete rule'
  }
}

function refreshRules() {
  loadRules()
}

function formatDate(dateString) {
  if (!dateString) return 'Unknown'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleDateString()
}

function getItemKey(item) {
  // Use the id if it exists, otherwise create a unique key from pattern and category
  return item.id || `${item.pattern}_${item.category}_${item.priority}`
}

onMounted(loadRules)
</script>

