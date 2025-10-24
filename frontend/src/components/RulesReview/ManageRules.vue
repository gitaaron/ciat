<template>
  <div class="manage-rules">
    <!-- New Rules Review -->
    <RulesReview
      title="✨ New Rules Created"
      :subtitle="`${newRules.length} new rules that you created during this import process.`"
      :rules="newRules"
      rule-type="new-rule"
      rules-section-class="new-rules"
      :accounts="accounts"
      :applying="applying"
      :show-create-rule-button="true"
      no-rules-message="No new rules were created during this import process."
      @remove="removeNew"
      @rule-created="handleRuleCreated"
    />
    
    <!-- Pre-existing Rules Review -->
    <RulesReview
      title="🔧 Pre-existing Rules"
      :subtitle="`${existingRules.length} rules were already in your system and applied to these transactions`"
      :rules="existingRules"
      rule-type="existing-rule"
      rules-section-class="existing-rules"
      :accounts="accounts"
      :applying="applying"
      :show-create-rule-button="true"
      @remove="removeExisting"
      @rule-created="handleRuleCreated"
    />
    
    <!-- Auto-Generated Rules Review -->
    <RulesReview
      title="🤖 Auto-Generated Rules Review"
      :subtitle="`${autoRules?.rules?.length || 0} auto-generated rules suggested based on your transaction patterns.`"
      :rules="effectiveAutoRules"
      rule-type="auto-rule"
      rules-section-class="auto-rules"
      :accounts="accounts"
      :show-create-rule-button="true"
      @remove="removeAuto"
      @rule-created="handleRuleCreated"
    />
  </div>
</template>

<script>
import RulesReview from './RulesReview.vue'
import ManageRulesJS from './ManageRules.js'

export default {
  name: 'ManageRules',
  components: {
    RulesReview
  },
  props: {
    newRules: {
      type: Array,
      default: () => []
    },
    usedRules: Array,
    autoRules: Object,
    newRuleMatches: {
      type: Map,
      default: () => new Map()
    },
    existingRuleMatches: {
      type: Map,
      default: () => new Map()
    },
    autoRuleMatches: {
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
    return ManageRulesJS(props, { emit })
  }
}
</script>

<style scoped>
.manage-rules {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}
</style>
