<template>
  <div class="preexisting-rules-review">
    <div class="header">
      <h3>🔧 Pre-existing Rules</h3>
      <p class="subtitle">
        {{ existingRules.length }} rules that were already in your system and applied to these transactions
      </p>
    </div>

    <!-- Pre-existing Rules Section -->
    <div v-if="existingRules.length > 0" class="rules-section existing-rules">
      <div class="rules-list">
        <RuleItem
          v-for="rule in existingRules"
          :key="rule.id"
          :rule="rule"
          rule-type="existing-rule"
          :accounts="accounts"
          :is-expanded="expandedRules.has(rule.id)"
          :is-editing="editingRule === rule.id"
          :applying="applying"
          :show-create-rule-button="false"
          @edit="startEditing"
          @save-edit="saveEdit"
          @cancel-edit="cancelEdit"
          @remove="deleteRule"
          @toggle-expanded="toggleExpanded"
        />
      </div>
    </div>

    <!-- No Rules Message -->
    <div v-else class="no-rules-message">
      <div class="no-rules-content">
        <v-icon size="48" color="grey-lighten-1">mdi-rule</v-icon>
        <h4>No Pre-existing Rules Applied</h4>
        <p>No rules from your existing rule set matched these transactions.</p>
      </div>
    </div>

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
import PreexistingRulesReviewJS from './PreexistingRulesReview.js'
import RuleItem from '../../RuleItem.vue'
import './PreexistingRulesReview.css'

export default {
  name: 'PreexistingRulesReview',
  components: {
    RuleItem
  },
  props: {
    usedRules: Array,
    accounts: Array,
    applying: {
      type: Boolean,
      default: false
    }
  },
  emits: ['refresh-rules'],
  setup(props, { emit }) {
    return PreexistingRulesReviewJS(props, { emit })
  }
}
</script>

<style scoped>
/* Styles are imported from PreexistingRulesReview.css */
</style>
