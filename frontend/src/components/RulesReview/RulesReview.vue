<template>
  <div class="rules-review">
    <div class="header">
      <h3>{{ title }}</h3>
      <p class="subtitle">
        {{ subtitle }}
      </p>
    </div>

    <div v-if="hasRules" class="rules-section" :class="rulesSectionClass">
      <!-- Rules List -->
      <div class="rules-list">
        <RuleItem
          v-for="rule in rules"
          :key="rule.id"
          :rule="rule"
          :rule-type="ruleType"
          :accounts="accounts"
          :is-expanded="isExpanded(rule.id)"
          :is-editing="isEditing(rule.id)"
          :applying="applying"
          :show-create-rule-button="showCreateRuleButton"
          @edit="handleEdit"
          @save-edit="handleSaveEdit"
          @cancel-edit="handleCancelEdit"
          @remove="handleRemove"
          @toggle-expanded="handleToggleExpanded"
          @create-rule="handleCreateRule"
        />
      </div>
    </div>

    <!-- No Rules Message -->
    <div v-else class="no-rules-message">
      <p>{{ noRulesMessage }}</p>
    </div>

    <!-- Create Rule Dialog -->
    <CreateRuleDialog
      :show="showCreateRuleDialog"
      :transaction="createRuleTransaction"
      :initial-data="createRuleData"
      @save="handleCreateRuleSave"
      @cancel="handleCancelCreateRule"
    />

    <!-- Snackbar for messages -->
    <v-snackbar
      :value="showSnack"
      @input="updateShowSnack"
      :timeout="3000"
      color="success"
    >
      {{ snackMessage }}
    </v-snackbar>
  </div>
</template>

<script>
import RuleItem from '../RuleItem.vue'
import CreateRuleDialog from '../shared/CreateRuleDialog.vue'
import useRulesReviewLogic from './RulesReview.js'
import './RulesReview.css'

export default {
  name: 'RulesReview',
  components: {
    RuleItem,
    CreateRuleDialog
  },
  props: {
    // Content props
    title: {
      type: String,
      required: true
    },
    subtitle: {
      type: String,
      required: true
    },
    noRulesMessage: {
      type: String,
      default: 'No rules were applied or suggested for this import.'
    },
    
    // Rules data
    rules: {
      type: Array,
      default: () => []
    },
    ruleType: {
      type: String,
      required: true
    },
    rulesSectionClass: {
      type: String,
      default: ''
    },
    
    // UI state
    accounts: Array,
    applying: {
      type: Boolean,
      default: false
    },
    showCreateRuleButton: {
      type: Boolean,
      default: true
    },
    
    // Dialog state
    showCreateRuleDialog: {
      type: Boolean,
      default: false
    },
    createRuleTransaction: Object,
    createRuleData: Object,
    
    // Snackbar state
    showSnack: {
      type: Boolean,
      default: false
    },
    snackMessage: {
      type: String,
      default: ''
    },
    
    // Expansion and editing state
    expandedRules: {
      type: Set,
      default: () => new Set()
    },
    editingRule: {
      type: [String, Number],
      default: null
    }
  },
  emits: [
    'edit',
    'save-edit', 
    'cancel-edit',
    'remove',
    'toggle-expanded',
    'create-rule',
    'create-rule-save',
    'cancel-create-rule',
    'update:showSnack',
    'rule-created'
  ],
  setup(props, { emit }) {
    const sharedLogic = useRulesReviewLogic(props, { emit })
    
    return {
      ...sharedLogic,
      hasRules: () => props.rules && props.rules.length > 0
    }
  },
  methods: {
    isExpanded(ruleId) {
      return this.expandedRules.has(ruleId)
    },
    
    isEditing(ruleId) {
      return this.editingRule === ruleId
    },
    
    handleEdit(rule) {
      this.$emit('edit', rule)
    },
    
    handleSaveEdit(rule, editData) {
      this.$emit('save-edit', rule, editData)
    },
    
    handleCancelEdit() {
      this.$emit('cancel-edit')
    },
    
    handleRemove(rule) {
      this.$emit('remove', rule)
    },
    
    handleToggleExpanded(rule) {
      this.$emit('toggle-expanded', rule)
    },
    
    handleCreateRule(transaction, rule) {
      this.$emit('create-rule', transaction, rule)
    },
    
    handleCreateRuleSave(ruleData) {
      this.$emit('create-rule-save', ruleData)
    },
    
    handleCancelCreateRule() {
      this.$emit('cancel-create-rule')
    },
    
    updateShowSnack(value) {
      this.$emit('update:showSnack', value)
    }
  }
}
</script>

<style scoped>
.rules-review {
  margin-bottom: 2rem;
}

.header {
  margin-bottom: 1rem;
}

.header h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
}

.subtitle {
  margin: 0;
  color: #6b7280;
  font-size: 0.875rem;
}

.rules-section {
  margin-bottom: 1rem;
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.no-rules-message {
  padding: 2rem;
  text-align: center;
  color: #6b7280;
  background-color: #f9fafb;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
}

.no-rules-message p {
  margin: 0;
  font-size: 0.875rem;
}
</style>
