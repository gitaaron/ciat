<template>
  <div class="new-rules-review" v-if="newRules.length > 0">
    <div class="header">
      <h3>✨ New Rules Created</h3>
      <p class="subtitle">
        {{ newRules.length }} new rules that you created during this import process
      </p>
    </div>

    <!-- New Rules Section -->
    <div class="rules-section new-rules">
      <div class="section-header">
        <h4>✨ New User-Created Rules</h4>
        <p class="section-subtitle">
          {{ newRules.length }} rules created during this import session
        </p>
      </div>

      <!-- Statistics -->
      <div class="stats">
        <div class="stat-item">
          <span class="stat-number">{{ newRules.length }}</span>
          <span class="stat-label">Rules Created</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">{{ totalMatches }}</span>
          <span class="stat-label">Total Matches</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">{{ uniqueCategories.size }}</span>
          <span class="stat-label">Categories Used</span>
        </div>
      </div>

      <!-- Rule Types Breakdown -->
      <div class="rule-types">
        <div class="rule-type" v-if="ruleTypeCounts.contains > 0">
          <span class="type-label">Contains:</span>
          <span class="type-count">{{ ruleTypeCounts.contains }}</span>
        </div>
        <div class="rule-type" v-if="ruleTypeCounts.regex > 0">
          <span class="type-label">Regex:</span>
          <span class="type-count">{{ ruleTypeCounts.regex }}</span>
        </div>
        <div class="rule-type" v-if="ruleTypeCounts.exact > 0">
          <span class="type-label">Exact:</span>
          <span class="type-count">{{ ruleTypeCounts.exact }}</span>
        </div>
      </div>

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
          :show-create-rule-button="false"
          @edit="startEditing"
          @save-edit="saveEdit"
          @cancel-edit="cancelEdit"
          @remove="deleteRule"
          @toggle-expanded="toggleExpanded"
        />
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
import NewRulesReviewJS from './NewRulesReview.js'
import RuleItem from '../../RuleItem.vue'
import './NewRulesReview.css'

export default {
  name: 'NewRulesReview',
  components: {
    RuleItem
  },
  props: {
    newRules: {
      type: Array,
      default: () => []
    },
    accounts: Array,
    applying: {
      type: Boolean,
      default: false
    }
  },
  emits: ['refresh-rules'],
  setup(props, { emit }) {
    return NewRulesReviewJS(props, { emit })
  }
}
</script>

<style scoped>
/* Styles are imported from NewRulesReview.css */
</style>
