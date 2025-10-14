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
              <v-chip :color="item.enabled ? 'success' : 'error'" size="small">
                {{ item.enabled ? 'Enabled' : 'Disabled' }}
              </v-chip>
            </template>
            
            <template v-slot:item.actions="{ item }">
              <v-btn @click="deleteRule(item)" color="error" size="small">
                Delete
              </v-btn>
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

function getItemKey(item) {
  // Use the id if it exists, otherwise create a unique key from pattern and category
  return item.id || `${item.pattern}_${item.category}_${item.priority}`
}

onMounted(loadRules)
</script>

