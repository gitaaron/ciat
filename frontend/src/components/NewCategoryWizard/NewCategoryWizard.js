import { ref, computed } from 'vue'
import api from '../api.js'
import MultiLabelSelector from '../MultiLabelSelector.vue'
import { CATEGORY_SELECT_OPTIONS } from '../../config/categories.js'

export default {
  name: 'NewCategoryWizard',
  components: {
    MultiLabelSelector
  },
  emits: ['close'],
  setup(props, { emit }) {
    const step = ref(1)
    const loading = ref(false)
    const error = ref(null)
    const createdRuleId = ref(null)

    const ruleForm = ref({
      category: '',
      match_type: '',
      pattern: '',
      explain: '',
      labels: []
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

    const categorySelectOptions = computed(() => CATEGORY_SELECT_OPTIONS)

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
        explain: '',
        labels: []
      }
      previewData.value = {
        affectedTransactions: [],
        count: 0,
        rule: null
      }
      createdRuleId.value = null
      error.value = null
    }

    return {
      step,
      loading,
      error,
      createdRuleId,
      ruleForm,
      previewData,
      isFormValid,
      changedCount,
      categorySelectOptions,
      getPatternPlaceholder,
      getPatternHelp,
      previewRule,
      createRule,
      resetWizard
    }
  }
}