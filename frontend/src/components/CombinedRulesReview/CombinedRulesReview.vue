<template>
  <div class="combined-rules-review">
    <div class="header">
      <h3>📋 Rules Review</h3>
      <p class="subtitle">
        Review and manage rules used in this import. Pre-existing rules are shown first, followed by auto-generated suggestions.
      </p>
      
    </div>

    <!-- Pre-existing Rules Section -->
    <div v-if="existingRules.length > 0" class="rules-section existing-rules">
      <div class="section-header">
        <h4>🔧 Pre-existing Rules</h4>
        <p class="section-subtitle">
          {{ existingRules.length }} rules that were already in your system and applied to these transactions
        </p>
      </div>

      <div class="rules-list">
        <div 
          v-for="rule in existingRules" 
          :key="rule.id || rule.pattern"
          class="rule-item existing-rule"
            :class="{ 
              editing: editingRule === rule.id,
              expanded: expandedRules.has(rule.id || rule.pattern)
            }"
        >
          <div class="rule-main">
            <div class="rule-content">
              <!-- Rule Header with Actions -->
              <div class="rule-header">
                <div class="rule-pattern">
                  <span class="rule-type-badge existing">{{ rule.match_type || 'user' }}</span>
                  <code class="pattern">{{ rule.pattern }}</code>
                  <span class="priority-badge">Priority: {{ rule.priority || 'High' }}</span>
                </div>
                <div class="rule-actions">
                  <div class="rule-category">
                    <span class="category-badge" :class="rule.category">{{ getCategoryName(rule.category) }}</span>
                  </div>
                  <div class="action-buttons">
                    <button 
                      class="action-btn edit-btn" 
                      @click="startEditing(rule)"
                      :disabled="editingRule !== null"
                      title="Edit rule"
                    >
                      ✏️
                    </button>
                    <button 
                      class="action-btn delete-btn" 
                      @click="deleteRule(rule)"
                      title="Delete rule"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>

              <!-- Editing Mode -->
              <div v-if="editingRule === rule.id" class="rule-editing">
                <div class="edit-form">
                  <div class="edit-row">
                    <label>Type:</label>
                    <select v-model="editingData.match_type" class="edit-input">
                      <option value="contains">Contains</option>
                      <option value="regex">Regex</option>
                      <option value="exact">Exact</option>
                    </select>
                  </div>
                  <div class="edit-row">
                    <label>Pattern:</label>
                    <input 
                      v-model="editingData.pattern" 
                      class="edit-input pattern-input"
                      placeholder="Enter pattern..."
                    >
                  </div>
                  <div class="edit-row">
                    <label>Category:</label>
                    <select v-model="editingData.category" class="edit-input">
                      <option value="fixed_costs">Fixed Costs</option>
                      <option value="investments">Investments</option>
                      <option value="guilt_free">Guilt Free</option>
                      <option value="short_term_savings">Short Term Savings</option>
                      <option value="">Uncategorized</option>
                    </select>
                  </div>
                  <div class="edit-actions">
                    <button class="btn btn-sm btn-primary" @click="saveEdit(rule.id)">Save</button>
                    <button class="btn btn-sm btn-secondary" @click="cancelEdit">Cancel</button>
                  </div>
                </div>
              </div>

              <!-- Normal View -->
              <div v-else class="rule-details">
                <div class="rule-stats">
                  <span class="stat">
                    <strong>{{ rule.transactions?.length || 0 }}</strong> transactions
                  </span>
                  <span class="stat">
                    <strong>{{ rule.explain || 'No explanation' }}</strong>
                  </span>
                </div>
              </div>

              <!-- Expanded Transactions View -->
              <div v-if="expandedRules.has(rule.id || rule.pattern)" class="rule-transactions">
                <div class="transactions-header">
                  <span>Matching transactions ({{ rule.transactions?.length || 0 }} total):</span>
                  <button 
                    class="btn btn-sm btn-secondary" 
                    @click="toggleExpanded(rule.id || rule.pattern)"
                  >
                    📖 Collapse
                  </button>
                </div>
                <div class="transactions-list">
                  <div 
                    v-for="transaction in (rule.transactions || [])" 
                    :key="transaction.id"
                    class="transaction-item"
                  >
                    <span class="merchant">{{ transaction.name }}</span>
                    <span class="amount">{{ formatAmount(transaction.amount) }}</span>
                    <span class="date">{{ formatDate(transaction.date) }}</span>
                    <span class="account">{{ getAccountName(transaction.account_id) }}</span>
                  </div>
                </div>
              </div>

              <!-- Sample Match (when not expanded) -->
              <div v-else class="rule-preview">
                <div class="preview-header">
                  <span>Sample match:</span>
                  <div class="preview-count-container">
                    <span class="preview-count">{{ getExistingRulePreviewCount(rule.id || rule.pattern) }} total transactions</span>
                    <button 
                      class="action-btn expand-btn" 
                      @click="toggleExpanded(rule.id || rule.pattern)"
                      :title="expandedRules.has(rule.id || rule.pattern) ? 'Collapse' : 'Show transactions'"
                    >
                      <span v-if="expandedRules.has(rule.id || rule.pattern)">📖 Collapse</span>
                      <span v-else>📄 Expand</span>
                    </button>
                  </div>
                </div>
                <div class="preview-list">
                  <div 
                    v-for="transaction in getExistingRuleSingleMatch(rule.id || rule.pattern)" 
                    :key="transaction.id"
                    class="preview-item"
                  >
                    <span class="merchant">{{ transaction.name }}</span>
                    <span class="amount">{{ formatAmount(transaction.amount) }}</span>
                    <span class="date">{{ formatDate(transaction.date) }}</span>
                    <span class="account">{{ getAccountName(transaction.account_id) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

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

        <div class="rules-container">
          <div 
            v-for="rule in effectiveAutoRules" 
            :key="rule.id"
            class="rule-item auto-rule"
            :class="{ 
              editing: editingAutoRule === rule.id,
              expanded: expandedAutoRules.has(rule.id)
            }"
          >
            <div class="rule-main">
              <div class="rule-content">
                <!-- Rule Header with Actions -->
                <div class="rule-header">
                  <div class="rule-pattern">
                    <span class="rule-type-badge" :class="rule.type">{{ rule.type }}</span>
                    <code class="pattern">{{ rule.pattern }}</code>
                    <span v-if="rule.isNewRule" class="new-rule-badge">NEW</span>
                  </div>
                  <div class="rule-actions">
                    <div class="rule-category">
                      <span class="category-badge" :class="rule.category">{{ getCategoryName(rule.category) }}</span>
                    </div>
                    <div class="action-buttons">
                      <button 
                        class="action-btn edit-btn" 
                        @click="startEditingAutoRule(rule)"
                        :disabled="editingAutoRule !== null"
                        title="Edit rule"
                      >
                        ✏️
                      </button>
                      <button 
                        class="action-btn remove-btn" 
                        @click="removeAutoRule(rule.id)"
                        title="Remove rule"
                      >
                        🗑️
                      </button>
                      <button 
                        class="action-btn apply-btn" 
                        @click="applySingleRule(rule)"
                        :disabled="applying"
                        title="Apply this rule"
                      >
                        {{ applying ? '⏳' : '✅' }} Apply
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Editing Mode -->
                <div v-if="editingAutoRule === rule.id" class="rule-editing">
                  <div class="edit-form">
                    <div class="edit-row">
                      <label>Type:</label>
                      <select v-model="editingAutoData.type" class="edit-input">
                        <option value="contains">Contains</option>
                        <option value="regex">Regex</option>
                        <option value="exact">Exact</option>
                        <option value="mcc">MCC</option>
                      </select>
                    </div>
                    <div class="edit-row">
                      <label>Pattern:</label>
                      <input 
                        v-model="editingAutoData.pattern" 
                        class="edit-input pattern-input"
                        placeholder="Enter pattern..."
                      >
                    </div>
                    <div class="edit-row">
                      <label>Category:</label>
                      <select v-model="editingAutoData.category" class="edit-input">
                        <option value="fixed_costs">Fixed Costs</option>
                        <option value="investments">Investments</option>
                        <option value="guilt_free">Guilt Free</option>
                        <option value="short_term_savings">Short Term Savings</option>
                        <option value="">Uncategorized</option>
                      </select>
                    </div>
                    <div class="edit-actions">
                      <button class="btn btn-sm btn-primary" @click="saveAutoRuleEdit(rule.id)">Save</button>
                      <button class="btn btn-sm btn-secondary" @click="cancelAutoRuleEdit">Cancel</button>
                    </div>
                  </div>
                </div>

                <!-- Normal View -->
                <div v-else class="rule-details">
                  <div class="rule-stats">
                    <span class="stat">
                      <strong>{{ ruleFrequencies.get(rule.id) || 0 }}</strong> occurrences
                    </span>
                    <span class="stat">
                      <strong>{{ Math.round(rule.confidence * 100) }}%</strong> confidence
                    </span>
                    <span class="stat">
                      <strong>{{ rule.priority || 'N/A' }}</strong> priority
                    </span>
                    <span class="stat source">
                      {{ rule.source }}
                    </span>
                  </div>
                  <p class="rule-explanation">{{ ruleExplanations.get(rule.id) || rule.explain }}</p>
                </div>

                <!-- Expanded Transactions View -->
                <div v-if="expandedAutoRules.has(rule.id)" class="rule-transactions">
                  <div class="transactions-header">
                    <span>All matching transactions ({{ rulePreviewCounts.get(rule.id) || 0 }} total):</span>
                    <button 
                      class="btn btn-sm btn-secondary" 
                      @click="toggleAutoRuleExpanded(rule.id)"
                    >
                      📖 Collapse
                    </button>
                  </div>
                  <div class="transactions-list">
                    <div 
                      v-for="match in (ruleMatches.get(rule.id) || [])" 
                      :key="match.id"
                      class="transaction-item"
                    >
                      <span class="merchant">{{ match.name }}</span>
                      <span class="amount">{{ formatAmount(match.amount) }}</span>
                      <span class="date">{{ formatDate(match.date) }}</span>
                      <span 
                        class="category-change"
                        :class="{ changed: match.wouldChange }"
                      >
                        {{ match.wouldChange ? '→ ' + getCategoryName(match.newCategory) : getCategoryName(match.currentCategory) }}
                      </span>
                      <button 
                        class="create-rule-btn"
                        @click="createRuleFromTransaction(match, rule)"
                        title="Create rule from this transaction"
                      >
                        ➕ Create Rule
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Sample Match (when not expanded) -->
                <div v-else class="rule-preview">
                  <div class="preview-header">
                    <span>Sample match:</span>
                    <div class="preview-count-container">
                      <span class="preview-count">{{ getPreviewCount(rule.id) }} total transactions</span>
                      <button 
                        class="action-btn expand-btn" 
                        @click="toggleAutoRuleExpanded(rule.id)"
                        :title="expandedAutoRules.has(rule.id) ? 'Collapse' : 'Show all transactions'"
                      >
                        <span v-if="expandedAutoRules.has(rule.id)">📖 Collapse</span>
                        <span v-else>📄 Expand</span>
                      </button>
                    </div>
                  </div>
                  <div class="preview-list">
                    <div 
                      v-for="match in getSinglePreviewMatch(rule.id)" 
                      :key="match.id"
                      class="preview-item"
                    >
                      <span class="merchant">{{ match.name }}</span>
                      <span class="amount">{{ formatAmount(match.amount) }}</span>
                      <span class="date">{{ formatDate(match.date) }}</span>
                      <span 
                        class="category-change"
                        :class="{ changed: match.wouldChange }"
                      >
                        {{ match.wouldChange ? '→ ' + getCategoryName(match.newCategory) : getCategoryName(match.currentCategory) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- No Rules Message -->
    <div v-if="existingRules.length === 0 && (!autoRules || !autoRules.rules || autoRules.rules.length === 0)" class="no-rules">
      <p>No rules were applied or suggested for this import.</p>
    </div>

    <!-- Actions -->
    <div class="actions">
      <button 
        class="btn btn-secondary" 
        @click="$emit('skip')"
      >
        Skip Rules Review
      </button>
      <div class="actions-info">
        <p>Review and apply rules as needed, then proceed to import your transactions.</p>
      </div>
      <button 
        class="btn btn-primary" 
        @click="$emit('commit')"
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
