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
          Existing Rules ({{ rules.length }})
        </v-card-title>
        <v-card-text>
          <v-alert type="info" variant="outlined" class="mb-4">
            Rules are applied in order of precedence (highest priority first, then most recent)
          </v-alert>
          
          
          <v-alert
            v-if="rules.length === 0"
            type="warning"
            variant="outlined"
            class="text-center"
          >
            No rules created yet. Use the "New Category Rule" wizard to create your first rule.
          </v-alert>
          
          <!-- Data table with simple configuration -->
          <v-data-table
            v-else
            :headers="[
              { title: 'Priority', key: 'priority' },
              { title: 'Category', key: 'category' },
              { title: 'Match Type', key: 'match_type' },
              { title: 'Pattern', key: 'pattern' },
              { title: 'Explanation', key: 'explain' },
              { title: 'Status', key: 'enabled' },
              { title: 'Actions', key: 'actions' }
            ]"
            :items="sortedRules"
            class="elevation-1"
          >
            <template v-slot:item.enabled="{ item }">
              <v-btn
                @click="toggleRule(item)"
                :color="item.enabled ? 'success' : 'error'"
                size="small"
                variant="outlined"
              >
                {{ item.enabled ? 'Enabled' : 'Disabled' }}
              </v-btn>
            </template>
            
            <template v-slot:item.actions="{ item }">
              <div class="d-flex flex-column ga-2 py-4">
                <v-btn 
                  @click="editRule(item)" 
                  color="primary" 
                  size="small"
                  variant="outlined"
                  block
                >
                  <v-icon left>mdi-pencil</v-icon>
                  Edit
                </v-btn>
                <v-btn 
                  @click="deleteRule(item)" 
                  color="error" 
                  size="small"
                  variant="outlined"
                  block
                >
                  <v-icon left>mdi-delete</v-icon>
                  Delete
                </v-btn>
              </div>
            </template>
          </v-data-table>
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
</template>

<script src="./RuleManager.js"></script>
<style scoped src="./RuleManager.css"></style>