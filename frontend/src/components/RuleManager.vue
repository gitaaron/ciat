<template>
  <div class="rule-manager">
    <h2>Category Rules Management</h2>
    
    <div class="rules-list">
      <h3>Existing Rules ({{ rules.length }})</h3>
      <p class="help-text">Rules are applied in order of precedence (highest priority first, then most recent)</p>
      
      <div v-if="rules.length === 0" class="no-rules">
        <p>No rules created yet. Use the "New Category Rule" wizard to create your first rule.</p>
      </div>
      
      <div v-else class="rules-table">
        <table border="1" cellpadding="8">
          <thead>
            <tr>
              <th>Priority</th>
              <th>Category</th>
              <th>Match Type</th>
              <th>Pattern</th>
              <th>Explanation</th>
              <th>Created</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="rule in sortedRules" 
              :key="rule.id"
              :class="{ 'disabled': !rule.enabled }"
            >
              <td class="priority">{{ rule.priority }}</td>
              <td class="category">{{ rule.category }}</td>
              <td class="match-type">{{ rule.match_type }}</td>
              <td class="pattern">
                <code>{{ rule.pattern }}</code>
              </td>
              <td class="explanation">{{ rule.explain }}</td>
              <td class="created">
                {{ formatDate(rule.created_at) }}
              </td>
              <td class="status">
                <span :class="rule.enabled ? 'enabled' : 'disabled'">
                  {{ rule.enabled ? 'Enabled' : 'Disabled' }}
                </span>
              </td>
              <td class="actions">
                <button 
                  @click="toggleRule(rule)" 
                  :class="rule.enabled ? 'disable' : 'enable'"
                  class="small"
                >
                  {{ rule.enabled ? 'Disable' : 'Enable' }}
                </button>
                <button 
                  @click="deleteRule(rule)" 
                  class="delete small"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <div class="actions">
      <button @click="$emit('create-new')" class="primary">
        Create New Rule
      </button>
      <button @click="refreshRules" class="secondary">
        Refresh
      </button>
    </div>
    
    <!-- Error Display -->
    <div v-if="error" class="error-message">
      <p>{{ error }}</p>
      <button @click="error = null">Dismiss</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from './api.js'

const emit = defineEmits(['create-new'])

const rules = ref([])
const loading = ref(false)
const error = ref(null)

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

async function toggleRule(rule) {
  try {
    // For now, we'll need to implement this in the backend
    // This is a placeholder for the toggle functionality
    error.value = 'Toggle functionality not yet implemented'
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
  return new Date(dateString).toLocaleDateString()
}

onMounted(loadRules)
</script>

<style scoped>
.rule-manager {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.rules-list {
  background: #f9f9f9;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.help-text {
  color: #666;
  font-size: 14px;
  margin-bottom: 16px;
}

.no-rules {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}

.rules-table {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

th {
  background: #f8f9fa;
  font-weight: bold;
  text-align: left;
}

tr.disabled {
  opacity: 0.6;
  background: #f8f9fa;
}

td {
  vertical-align: top;
}

.priority {
  text-align: center;
  font-weight: bold;
  color: #007bff;
}

.category {
  font-weight: bold;
}

.match-type {
  text-transform: capitalize;
}

.pattern code {
  background: #e9ecef;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 12px;
}

.explanation {
  max-width: 200px;
  word-wrap: break-word;
}

.created {
  font-size: 12px;
  color: #666;
}

.status .enabled {
  color: #28a745;
  font-weight: bold;
}

.status .disabled {
  color: #dc3545;
  font-weight: bold;
}

.actions {
  display: flex;
  gap: 8px;
}

.actions button {
  padding: 4px 8px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
}

.actions button.small {
  padding: 2px 6px;
  font-size: 11px;
}

.actions button.enable {
  background: #28a745;
  color: white;
}

.actions button.disable {
  background: #ffc107;
  color: black;
}

.actions button.delete {
  background: #dc3545;
  color: white;
}

.actions button.primary {
  background: #007bff;
  color: white;
  padding: 8px 16px;
  font-size: 14px;
}

.actions button.secondary {
  background: #6c757d;
  color: white;
  padding: 8px 16px;
  font-size: 14px;
}

.actions button:hover {
  opacity: 0.8;
}

.rule-manager .actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
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
