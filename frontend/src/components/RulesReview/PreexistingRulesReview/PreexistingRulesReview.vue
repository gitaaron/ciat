<template>
  <RulesReview
    title="🔧 Pre-existing Rules"
    :subtitle="`${existingRules.length} rules were already in your system and applied to these transactions`"
    :rules="existingRules"
    rule-type="existing-rule"
    rules-section-class="existing-rules"
    :accounts="accounts"
    :applying="applying"
    :expanded-rules="expandedRules"
    :editing-rule="editingRule"
    :show-create-rule-dialog="showCreateRuleDialog"
    :create-rule-transaction="createRuleTransaction"
    :create-rule-data="createRuleData"
    :show-snack="showSnack"
    :snack-message="snackMessage"
    @edit="startEditing"
    @save-edit="saveEdit"
    @cancel-edit="cancelEdit"
    @remove="deleteRule"
    @toggle-expanded="toggleExpanded"
    @create-rule="createRuleFromTransaction"
    @create-rule-save="handleCreateRuleSave"
    @cancel-create-rule="cancelCreateRule"
    @update:showSnack="showSnack = $event"
  />
</template>

<script>
import PreexistingRulesReviewJS from './PreexistingRulesReview.js'
import { createRulesReviewComponent } from '../RulesReview.js'

const props = {
  usedRules: Array,
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
  'PreexistingRulesReview',
  PreexistingRulesReviewJS,
  props
)
</script>