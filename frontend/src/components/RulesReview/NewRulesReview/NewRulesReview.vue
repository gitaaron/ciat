<template>
  <div class="new-rules-review">
    <div class="header">
      <h3>✨ New Rules Created</h3>
      <p class="subtitle">
        {{ newRules.length }} new rules that you created during this import process.
      </p>
    </div>

    <div v-if="newRules.length > 0" class="rules-section new-rules">
      <!-- New Rules List -->
      <div class="rules-list">
        <RuleItem
          v-for="rule in newRules"
          :key="rule.id"
          :rule="rule"
          rule-type="new-rule"
          :accounts="accounts"
          :is-expanded="expandedRules.has(rule.id)"
          :is-editing="editingRule === rule.id"
          :applying="applying"
          :show-create-rule-button="true"
          @edit="startEditing"
          @save-edit="saveEdit"
          @cancel-edit="cancelEdit"
          @remove="deleteRule"
          @toggle-expanded="toggleExpanded"
          @create-rule="createRuleFromTransaction"
        />
      </div>
    </div>

    <!-- No Rules Message -->
    <div v-else class="no-rules-message">
      <p>No new rules were created during this import process.</p>
    </div>

    <!-- Create Rule Dialog -->
    <CreateRuleDialog
      :show="showCreateRuleDialog"
      :transaction="createRuleTransaction"
      :initial-data="createRuleData"
      @save="handleCreateRuleSave"
      @cancel="cancelCreateRule"
    />

    <!-- Snackbar for messages -->
    <v-snackbar
      v-model="showSnack"
      :timeout="3000"
      color="success"
    >
      {{ snackMessage }}
    </v-snackbar>
  </div>
</template>

<script>
import NewRulesReviewJS from './NewRulesReview.js'
import RuleItem from '../../RuleItem.vue'
import CreateRuleDialog from '../../shared/CreateRuleDialog.vue'
import './NewRulesReview.css'

export default {
  name: 'NewRulesReview',
  components: {
    RuleItem,
    CreateRuleDialog
  },
  props: {
    newRules: {
      type: Array,
      default: () => []
    },
    ruleMatches: {
      type: Map,
      default: () => new Map()
    },
    accounts: Array,
    applying: {
      type: Boolean,
      default: false
    }
  },
  emits: ['refresh-rules', 'rule-created'],
  setup(props, { emit }) {
    return NewRulesReviewJS(props, { emit })
  }
}
</script>