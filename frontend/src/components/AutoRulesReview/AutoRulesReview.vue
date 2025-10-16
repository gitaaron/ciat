<template>
  <div class="auto-rules-review">
    <div class="header">
      <h3>🤖 Auto-Generated Rules</h3>
      <p class="subtitle">
        We've analyzed your transactions and found {{ autoRules?.rules?.length || 0 }} potential rules to help categorize future transactions.
      </p>
    </div>

    <div v-if="!autoRules" class="no-rules">
      <p>No auto-generated rules available for this import.</p>
    </div>

    <div v-else class="rules-content">
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
          <span class="stat-number">{{ effectiveRules.length }}</span>
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

      <!-- Rules List -->
      <div class="rules-list" ref="rulesContainer">
        <div class="rules-header">
          <div class="view-toggle">
            <button 
              class="toggle-btn" 
              :class="{ active: viewMode === 'list' }"
              @click="viewMode = 'list'"
            >
              List
            </button>
            <button 
              class="toggle-btn" 
              :class="{ active: viewMode === 'preview' }"
              @click="viewMode = 'preview'"
            >
              Preview
            </button>
          </div>
        </div>

        <div class="rules-container">
          <div 
            v-for="rule in effectiveRules" 
            :key="rule.id"
            class="rule-item"
            :class="{ 
              editing: editingRule === rule.id,
              expanded: expandedRules.includes(rule.id)
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
                        @click="startEditing(rule)"
                        :disabled="editingRule !== null"
                        title="Edit rule"
                      >
                        ✏️
                      </button>
                      <button 
                        class="action-btn expand-btn" 
                        @click="toggleExpanded(rule.id)"
                        :title="expandedRules.includes(rule.id) ? 'Collapse' : 'Show all transactions'"
                      >
                        {{ expandedRules.includes(rule.id) ? '📖' : '📄' }}
                      </button>
                      <button 
                        class="action-btn remove-btn" 
                        @click="removeRule(rule.id)"
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
                <div v-if="editingRule === rule.id" class="rule-editing">
                  <div class="edit-form">
                    <div class="edit-row">
                      <label>Type:</label>
                      <select v-model="editingData.type" class="edit-input">
                        <option value="contains">Contains</option>
                        <option value="regex">Regex</option>
                        <option value="exact">Exact</option>
                        <option value="mcc">MCC</option>
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
                <div v-if="expandedRules.includes(rule.id)" class="rule-transactions">
                  <div class="transactions-header">
                    <span>All matching transactions ({{ rulePreviewCounts.get(rule.id) || 0 }} total):</span>
                    <button 
                      class="btn btn-sm btn-secondary" 
                      @click="toggleExpanded(rule.id)"
                    >
                      Collapse
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

                <!-- Preview Mode (when not expanded) -->
                <div v-else-if="viewMode === 'preview'" class="rule-preview">
                  <div class="preview-header">
                    <span>Sample matches:</span>
                    <span class="preview-count">{{ getPreviewCount(rule.id) }} transactions</span>
                  </div>
                  <div class="preview-list">
                    <div 
                      v-for="match in getPreviewMatches(rule.id)" 
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

      <!-- Actions -->
      <div class="actions">
        <button 
          class="btn btn-secondary" 
          @click="$emit('skip')"
        >
          Skip Auto Rules
        </button>
        <div class="actions-info">
          <p>Click the "Apply" button on any rule to create it and categorize matching transactions.</p>
        </div>
      </div>
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

<script src="./AutoRulesReview.js"></script>
<style scoped src="./AutoRulesReview.css"></style>
