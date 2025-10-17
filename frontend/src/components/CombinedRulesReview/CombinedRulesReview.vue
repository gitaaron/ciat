<template>
  <div class="combined-rules-review">
    <div class="header">
      <h3>🤖 Auto-Generated Rules Review</h3>
      <p class="subtitle">
        Review and manage auto-generated rules suggested based on your transaction patterns.
      </p>
      
    </div>

    <!-- Pre-existing Rules Section - Now handled by separate PreexistingRulesReview component -->

    <!-- Auto-generated Rules Section -->
    <div v-if="autoRules && autoRules.rules && autoRules.rules.length > 0" class="rules-section auto-rules">
      <div class="section-header">
        <h4>🤖 Auto-Generated Rules</h4>
        <p class="section-subtitle">
          {{ autoRules.rules.length }} potential rules suggested based on your transaction patterns
        </p>
      </div>

      <!-- Statistics -->
      <div class="stats">
        <div class="stat-item">
          <span class="stat-number">{{ autoRules.stats?.totalTransactions || 0 }}</span>
          <span class="stat-label">Transactions Analyzed</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">{{ autoRules.stats?.rulesGenerated || 0 }}</span>
          <span class="stat-label">Rules Generated</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">{{ effectiveAutoRules.length }}</span>
          <span class="stat-label">Available</span>
        </div>
      </div>

      <!-- Rule Types Breakdown -->
      <div class="rule-types">
        <div class="rule-type" v-if="autoRules.stats?.frequencyRules > 0">
          <span class="type-label">Frequency-based:</span>
          <span class="type-count">{{ autoRules.stats.frequencyRules }}</span>
        </div>
        <div class="rule-type" v-if="autoRules.stats?.storePattern > 0">
          <span class="type-label">Store patterns:</span>
          <span class="type-count">{{ autoRules.stats.storePattern }}</span>
        </div>
        <div class="rule-type" v-if="autoRules.stats?.mccRules > 0">
          <span class="type-label">MCC-based:</span>
          <span class="type-count">{{ autoRules.stats.mccRules }}</span>
        </div>
        <div class="rule-type" v-if="autoRules.stats?.recurringRules > 0">
          <span class="type-label">Recurring:</span>
          <span class="type-count">{{ autoRules.stats.recurringRules }}</span>
        </div>
        <div class="rule-type" v-if="autoRules.stats?.marketplaceRules > 0">
          <span class="type-label">Marketplace:</span>
          <span class="type-count">{{ autoRules.stats.marketplaceRules }}</span>
        </div>
      </div>

      <!-- Auto Rules List -->
      <div class="rules-list">
        <RuleItem
          v-for="rule in effectiveAutoRules"
          :key="rule.id"
          :rule="rule"
          rule-type="auto-rule"
          :accounts="accounts"
          :is-expanded="expandedAutoRules.has(rule.id)"
          :is-editing="editingAutoRule === rule.id"
          :applying="applying"
          :show-create-rule-button="true"
          @edit="startEditingAutoRule"
          @save-edit="saveAutoRuleEdit"
          @cancel-edit="cancelAutoRuleEdit"
          @remove="removeAutoRule"
          @toggle-expanded="toggleAutoRuleExpanded"
          @create-rule="createRuleFromTransaction"
        />
      </div>
    </div>

    <!-- No Rules Message -->
    <div v-if="existingRules.length === 0 && (!autoRules || !autoRules.rules || autoRules.rules.length === 0)" class="no-rules">
      <p>No rules were applied or suggested for this import.</p>
    </div>

    <!-- Actions -->
    <div class="actions">
      <div class="actions-info">
        <p>Review rules as needed. All auto-generated rules will be applied automatically when you continue to import.</p>
      </div>
      <button 
        class="btn btn-primary" 
        @click="handleCommit"
        :disabled="applying"
      >
        {{ applying ? 'Processing...' : 'Continue to Import' }}
      </button>
    </div>

    <!-- Create Rule Dialog -->
    <div v-if="showCreateRuleDialog" class="dialog-overlay" @click="cancelCreateRule">
      <div class="dialog" @click.stop>
        <div class="dialog-header">
          <h3>Create New Rule</h3>
          <button class="close-btn" @click="cancelCreateRule">×</button>
        </div>
        
        <div class="dialog-content">
          <div class="transaction-info">
            <h4>From Transaction:</h4>
            <p><strong>Merchant:</strong> {{ createRuleTransaction?.name }}</p>
            <p><strong>Amount:</strong> {{ formatAmount(createRuleTransaction?.amount) }}</p>
            <p><strong>Date:</strong> {{ formatDate(createRuleTransaction?.date) }}</p>
          </div>
          
          <div class="rule-form">
            <div class="form-row">
              <label>Match Type:</label>
              <select v-model="createRuleData.type" class="form-input">
                <option value="contains">Contains</option>
                <option value="regex">Regex</option>
                <option value="exact">Exact</option>
              </select>
            </div>
            
            <div class="form-row">
              <label>Pattern:</label>
              <input 
                v-model="createRuleData.pattern" 
                class="form-input pattern-input"
                placeholder="Enter pattern to match..."
                :class="{ 'regex-input': createRuleData.type === 'regex' }"
              >
              <small class="form-help">
                <span v-if="createRuleData.type === 'contains'">Text that must be contained in the merchant name</span>
                <span v-else-if="createRuleData.type === 'regex'">Regular expression pattern</span>
                <span v-else-if="createRuleData.type === 'exact'">Exact merchant name match</span>
              </small>
              <div v-if="createRuleData.pattern" class="pattern-preview">
                <strong>Preview:</strong> This rule will match transactions containing "<code>{{ createRuleData.pattern }}</code>"
              </div>
            </div>
            
            <div class="form-row">
              <label>Category:</label>
              <select v-model="createRuleData.category" class="form-input">
                <option value="fixed_costs">Fixed Costs</option>
                <option value="investments">Investments</option>
                <option value="guilt_free">Guilt Free</option>
                <option value="short_term_savings">Short Term Savings</option>
                <option value="">Uncategorized</option>
              </select>
            </div>
            
            <div class="form-row">
              <label>Labels (Optional):</label>
              <div class="label-autocomplete-container">
                <MultiLabelSelector
                  v-model="createRuleData.labels"
                  label=""
                  placeholder="e.g., Coffee, Travel, Work"
                  hint=""
                />
              </div>
              <small class="form-help">Optional labels for grouping transactions</small>
            </div>
          </div>
        </div>
        
        <div class="dialog-actions">
          <button class="btn btn-secondary" @click="cancelCreateRule">Cancel</button>
          <button class="btn btn-primary" @click="saveNewRule">Create Rule</button>
        </div>
      </div>
    </div>

    <!-- Snack Message -->
    <div v-if="showSnack" class="snack-message">
      {{ snackMessage }}
    </div>
  </div>
</template>

<script src="./CombinedRulesReview.js"></script>
<style scoped src="./CombinedRulesReview.css"></style>
