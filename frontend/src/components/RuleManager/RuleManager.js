import { ref, computed, onMounted } from 'vue'
import api from '../api.js'
import MultiLabelSelector from '../MultiLabelSelector.vue'
import { CATEGORY_STEPS, CATEGORY_NAMES } from '../../config/categories.js'
import { showError, showSuccess, showDeleteConfirm } from '../../utils/notifications.js'

export default {
  name: 'RuleManager',
  components: {
    MultiLabelSelector
  },
  emits: ['create-new'],
  setup(props, { emit }) {
    const rules = ref([])
    const loading = ref(false)
    const reapplying = ref(false)
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

    const categorySteps = CATEGORY_STEPS
    const categoryStepNames = CATEGORY_STEPS.map(step => CATEGORY_NAMES[step])

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
      const confirmed = await showDeleteConfirm(
        `Are you sure you want to delete this rule?\n\nPattern: ${rule.pattern}\nCategory: ${rule.category}`,
        'Confirm Rule Deletion'
      )
      
      if (!confirmed) return
      
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

    async function reapplyRules() {
      reapplying.value = true
      error.value = null
      
      try {
        const result = await api.reapplyRules()
        showSuccess(
          `Reapplied rules to ${result.updated || 0} transactions` +
          (result.changed ? ` (${result.changed} category changes)` : '') +
          ` out of ${result.total || 0} total.`
        )
        await loadRules()
      } catch (err) {
        const errorMsg = err.response?.data?.error || 'Failed to reapply rules'
        error.value = errorMsg
        showError(errorMsg)
      } finally {
        reapplying.value = false
      }
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

    return {
      rules,
      loading,
      reapplying,
      error,
      editingRule,
      editForm,
      saving,
      showEditDialog,
      matchTypes,
      categorySteps,
      categoryStepNames,
      sortedRules,
      loadRules,
      editRule,
      saveRule,
      cancelEdit,
      toggleRule,
      deleteRule,
      refreshRules,
      reapplyRules,
      formatDate,
      getItemKey
    }
  }
}
