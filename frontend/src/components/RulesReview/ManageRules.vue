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
      :expanded-rules="expandedNewRules"
      :editing-rule="editingNewRule"
      :show-create-rule-dialog="showCreateRuleDialogNew"
      :create-rule-transaction="createRuleTransactionNew"
      :create-rule-data="createRuleDataNew"
      no-rules-message="No new rules were created during this import process."
      @edit="startEditingNew"
      @save-edit="saveEditNew"
      @cancel-edit="cancelEditNew"
      @remove="removeNew"
      @toggle-expanded="toggleExpandedNew"
      @create-rule="createRuleFromTransactionNew"
      @create-rule-save="handleCreateRuleSaveNew"
      @cancel-create-rule="cancelCreateRuleNew"
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
      :expanded-rules="expandedExistingRules"
      :editing-rule="editingExistingRule"
      :show-create-rule-dialog="showCreateRuleDialogExisting"
      :create-rule-transaction="createRuleTransactionExisting"
      :create-rule-data="createRuleDataExisting"
      @edit="startEditingExisting"
      @save-edit="saveEditExisting"
      @cancel-edit="cancelEditExisting"
      @remove="removeExisting"
      @toggle-expanded="toggleExpandedExisting"
      @create-rule="createRuleFromTransactionExisting"
      @create-rule-save="handleCreateRuleSaveExisting"
      @cancel-create-rule="cancelCreateRuleExisting"
    />
    
    <!-- Auto-Generated Rules Review -->
    <RulesReview
      title="🤖 Auto-Generated Rules Review"
      :subtitle="`${autoRules?.rules?.length || 0} auto-generated rules suggested based on your transaction patterns.`"
      :rules="effectiveAutoRules"
      rule-type="auto-rule"
      rules-section-class="auto-rules"
      :accounts="accounts"
      :expanded-rules="expandedAutoRules"
      :editing-rule="editingAutoRule"
      :show-create-rule-dialog="showCreateRuleDialogAuto"
      :create-rule-transaction="createRuleTransactionAuto"
      :create-rule-data="createRuleDataAuto"
      @edit="startEditingAuto"
      @save-edit="saveEditAuto"
      @cancel-edit="cancelEditAuto"
      @remove="removeAuto"
      @toggle-expanded="toggleExpandedAuto"
      @create-rule="createRuleFromTransactionAuto"
      @create-rule-save="handleCreateRuleSaveAuto"
      @cancel-create-rule="cancelCreateRuleAuto"
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
