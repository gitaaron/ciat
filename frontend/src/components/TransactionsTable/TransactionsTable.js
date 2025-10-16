import { ref, computed } from 'vue'
import api from '../api.js'
import MultiLabelSelector from '../MultiLabelSelector.vue'

export default {
  name: 'RulesReview',
  components: {
    MultiLabelSelector
  },
  props: {
    usedRules: Array,
    accounts: Array
  },
  emits: ['commit', 'cancel', 'refresh-rules'],
  setup(props, { emit }) {
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

    return {
      currentCategoryStep,
      categorySteps,
      categoryStepNames,
      expandedRules,
      editingRule,
      deletingRule,
      rulePreview,
      showPreview,
      editForm,
      saving,
      matchTypes,
      currentCategoryRules,
      hasMoreCategories,
      hasPreviousCategories,
      totalRules,
      totalTransactions,
      getAccountName,
      toggleRuleExpansion,
      nextCategory,
      previousCategory,
      editRule,
      deleteRule,
      previewRuleImpact,
      confirmDeleteRule,
      saveRule,
      cancelEdit,
      cancelDelete,
      commitImport,
      cancelImport,
      formatDate
    }
  }
}