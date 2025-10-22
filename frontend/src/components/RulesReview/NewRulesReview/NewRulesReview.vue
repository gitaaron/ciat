<template>
  <RulesReview
    title="✨ New Rules Created"
    :subtitle="`${newRules.length} new rules that you created during this import process.`"
    :rules="newRules"
    rule-type="new-rule"
    rules-section-class="new-rules"
    :accounts="accounts"
    :applying="applying"
    :expanded-rules="expandedRules"
    :editing-rule="editingRule"
    :show-create-rule-dialog="showCreateRuleDialog"
    :create-rule-transaction="createRuleTransaction"
    :create-rule-data="createRuleData"
    :show-snack="showSnack"
    :snack-message="snackMessage"
    no-rules-message="No new rules were created during this import process."
  />
</template>

<script>
import NewRulesReviewJS from './NewRulesReview.js'
import { createRulesReviewComponent } from '../RulesReview.js'

const props = {
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
}

export default createRulesReviewComponent(
  'NewRulesReview',
  NewRulesReviewJS,
  props
)
</script>