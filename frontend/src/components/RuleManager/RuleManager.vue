<template>
  <v-card>
    <v-card-title class="text-h5">
      <v-icon left>mdi-cog</v-icon>
      Category Rules Management
    </v-card-title>

    <v-card-text>
      <v-card variant="outlined" class="mb-4">
        <v-card-title class="text-h6">
          <v-icon left>mdi-format-list-bulleted</v-icon>
          Existing Rules ({{ filteredRules.length }}{{ searchPattern ? ' of ' + rules.length : '' }})
        </v-card-title>
        <v-card-text>
          <v-alert type="info" variant="outlined" class="mb-4">
            Rules are applied in order of precedence (highest priority first, then most recent)
          </v-alert>
          
          <!-- Search Input -->
          <v-text-field
            v-model="searchPattern"
            label="Search rules by pattern"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            density="compact"
            clearable
            class="mb-4"
            hint="Enter text to filter rules by pattern"
            persistent-hint
          />
          
          <v-alert
            v-if="rules.length === 0"
            type="warning"
            variant="outlined"
            class="text-center"
          >
            No rules created yet. Use the "New Category Rule" wizard to create your first rule.
          </v-alert>
          
          <!-- Rules List using RuleItem component -->
          <div v-else class="rules-list">
            <RuleItem
              v-for="rule in filteredRules"
              :key="rule.id"
              :rule="rule"
              rule-type="existing-rule"
              :accounts="accounts"
              :is-expanded="isExpanded(rule.id)"
              :is-editing="isEditing(rule.id)"
              :applying="false"
              :is-saving="saving && editingRule?.id === rule.id"
              :show-create-rule-button="true"
              @edit="editRule"
              @save-edit="handleSaveEdit"
              @cancel-edit="handleCancelEdit"
              @remove="deleteRule"
              @toggle-expanded="toggleExpanded"
              @create-rule="handleCreateRule"
            />
          </div>
        </v-card-text>
      </v-card>
      
      <v-row>
        <v-col cols="12" sm="4">
          <v-btn
            @click="$emit('create-new')"
            color="primary"
            block
          >
            <v-icon left>mdi-plus</v-icon>
            Create New Rule
          </v-btn>
        </v-col>
        <v-col cols="12" sm="4">
          <v-btn
            @click="reapplyRules"
            :loading="reapplying"
            color="info"
            variant="outlined"
            block
          >
            <v-icon left>mdi-refresh</v-icon>
            Reapply Rules
          </v-btn>
        </v-col>
        <v-col cols="12" sm="4">
          <v-btn
            @click="refreshRules"
            :loading="loading"
            color="secondary"
            variant="outlined"
            block
          >
            <v-icon left>mdi-refresh</v-icon>
            Refresh
          </v-btn>
        </v-col>
      </v-row>
    </v-card-text>
    
    <!-- Error Display -->
    <v-card-text v-if="error">
      <v-alert
        type="error"
        variant="outlined"
        closable
        @click:close="error = null"
      >
        {{ error }}
      </v-alert>
    </v-card-text>
  </v-card>

  <!-- Edit Rule Dialog -->
  <v-dialog v-model="showEditDialog" max-width="600">
    <v-card>
      <v-card-title class="text-h6">
        <v-icon left color="primary">mdi-pencil</v-icon>
        Edit Rule
      </v-card-title>
      
      <v-card-text>
        <v-form class="mb-4">
          <v-row>
            <v-col cols="12" sm="6">
              <v-select
                v-model="editForm.category"
                :items="categorySteps"
                :item-title="(item, index) => categoryStepNames[index]"
                :item-value="(item) => item"
                label="Category"
                variant="outlined"
                density="compact"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-select
                v-model="editForm.match_type"
                :items="matchTypes"
                item-title="label"
                item-value="value"
                label="Match Type"
                variant="outlined"
                density="compact"
              />
            </v-col>
          </v-row>
          
          <v-row>
            <v-col cols="12">
              <v-text-field
                v-model="editForm.pattern"
                label="Pattern"
                variant="outlined"
                density="compact"
                hint="Enter the text pattern to match against transaction names/descriptions"
                persistent-hint
              />
            </v-col>
          </v-row>
          
          <v-row>
            <v-col cols="12">
              <v-text-field
                v-model="editForm.explain"
                label="Explanation (Optional)"
                variant="outlined"
                density="compact"
                hint="Optional explanation for this rule"
                persistent-hint
              />
            </v-col>
          </v-row>
          
          <v-row>
            <v-col cols="12">
              <MultiLabelSelector
                v-model="editForm.labels"
                label="Labels (Optional)"
                placeholder="e.g., Coffee, Travel, Work"
                hint="Optional labels for grouping transactions"
              />
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
      
      <v-card-actions>
        <v-spacer />
        <v-btn
          @click="cancelEdit"
        >
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          :loading="saving"
          :disabled="saving"
          @click="saveRule"
        >
          <span v-if="saving" class="loading-spinner">⏳</span>
          <v-icon v-else left>mdi-content-save</v-icon>
          {{ saving ? 'Saving...' : 'Save Rule' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Create Rule Dialog -->
  <CreateRuleDialog
    :show="showCreateRuleDialog"
    :transaction="createRuleTransaction"
    :initial-data="createRuleData"
    :loading="createRuleLoading"
    @save="handleCreateRuleSave"
    @cancel="cancelCreateRule"
  />
</template>

<script src="./RuleManager.js"></script>
<style scoped src="./RuleManager.css"></style>
<style scoped>
.rules-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
</style>