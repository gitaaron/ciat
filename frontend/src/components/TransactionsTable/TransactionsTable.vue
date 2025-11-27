<template>
  <v-card>
    <v-card-title class="text-h5 d-flex justify-space-between align-center my-4">
      <div class="d-flex align-center">
        <v-icon left>mdi-format-list-bulleted</v-icon>
        Transactions
      </div>
      <v-btn
        color="primary"
        variant="elevated"
        @click="showNewTransactionDialog = true"
      >
        <v-icon left>mdi-plus</v-icon>
        New Transaction
      </v-btn>
    </v-card-title>

    <v-card-text style="padding-bottom: 80px;">
      <!-- Filters -->
      <TransactionFilters
        v-model:search-query="q"
        v-model:selected-category="category"
        v-model:selected-account="account"
        v-model:start-date="start"
        v-model:end-date="end"
        v-model:selected-label="label"
        v-model:hide-net-zero="hideNetZero"
        v-model:inflow-filter="inflowFilter"
        v-model:min-amount="minAmount"
        v-model:max-amount="maxAmount"
        :category-options="categoryFilterOptions"
        :account-options="accountOptions"
        :show-category-filter="true"
        :show-account-filter="true"
        :show-date-filters="true"
        :show-label-filter="true"
        :show-hide-net-zero="true"
        :show-inflow-filter="true"
        :show-amount-filter="true"
        search-placeholder="Search name/amount/note"
        clear-button-text="Reset"
        @clear-filters="clearFilters"
        @create-rule="handleCreateRuleFromFilters"
      />

      <!-- Summary Stats -->
      <TransactionStats
        :total-transactions="totalTransactions"
        :categorized-count="categorizedCount"
        :uncategorized-count="uncategorizedCount"
        :total-inflow="totalInflow"
        :total-outflow="totalOutflow"
        :show-categorized="true"
        :show-uncategorized="true"
        :show-total-amount="true"
        :show-uncategorized-amount="false"
      />

      <!-- Data Table -->
      <TransactionTable
        :items="rows"
        :headers="tableHeaders"
        :grouped="false"
        :loading="loading"
        :show-category-edit="true"
        @category-change="trackTransactionChange"
        @transaction-name-click="handleTransactionNameClick"
        @manual-override="handleManualOverride"
        @open-rule="handleOpenRule"
        @create-rule="handleCreateRule"
      />
    </v-card-text>
  </v-card>

  <!-- Fixed Bottom App Bar -->
  <v-bottom-navigation
    fixed
    color="primary"
    height="64"
    style="z-index: 1000;"
  >
    <v-spacer />
    <div class="d-flex align-center ga-3 px-4">
      <span v-if="hasUnsavedChanges" class="text-body-2">
        {{ modifiedTransactionsCount }} change{{ modifiedTransactionsCount !== 1 ? 's' : '' }} pending
      </span>
      <v-btn
        color="primary"
        variant="elevated"
        size="large"
        :disabled="!hasUnsavedChanges || saving"
        :loading="saving"
        @click="saveAllChanges"
      >
        <v-icon left>mdi-content-save</v-icon>
        {{ saving ? 'Saving...' : 'Save Changes' }}
      </v-btn>
    </div>
  </v-bottom-navigation>

  <!-- New Transaction Dialog -->
  <NewTransactionDialog
    :show="showNewTransactionDialog"
    :accounts="accounts"
    :loading="creatingTransaction"
    @save="handleCreateTransaction"
    @cancel="showNewTransactionDialog = false"
  />

  <!-- Create Rule Dialog -->
  <CreateRuleDialog
    :show="showCreateRuleDialog"
    :transaction="createRuleTransaction"
    :initial-data="createRuleData"
    :loading="createRuleLoading"
    @save="handleCreateRuleSave"
    @cancel="cancelCreateRule"
  />

  <!-- Manual Override Dialog -->
  <v-dialog
    v-model="showManualOverrideDialog"
    max-width="500"
    persistent
  >
    <v-card>
      <v-card-title>
        <v-icon left>mdi-lock</v-icon>
        Manually Override Category
      </v-card-title>
      <v-card-text>
        <div class="mb-4">
          <p class="text-body-1 mb-2"><strong>Transaction:</strong> {{ manualOverrideTransaction?.name }}</p>
          <p class="text-body-2 text-grey">Select a category to manually override this transaction. This will prevent rules from recategorizing it.</p>
        </div>
        <v-select
          v-model="manualOverrideCategory"
          :items="categorySelectOptions"
          item-title="title"
          item-value="value"
          label="Category"
          variant="outlined"
          :disabled="manualOverrideLoading"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="handleCancelManualOverride"
          :disabled="manualOverrideLoading"
        >
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          variant="elevated"
          @click="handleSaveManualOverride"
          :loading="manualOverrideLoading"
          :disabled="!manualOverrideCategory"
        >
          Override
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import TransactionsTableJS from './TransactionsTable.js'
import NewTransactionDialog from '../shared/NewTransactionDialog.vue'
import CreateRuleDialog from '../shared/CreateRuleDialog.vue'

export default {
  ...TransactionsTableJS,
  components: {
    ...TransactionsTableJS.components,
    NewTransactionDialog,
    CreateRuleDialog
  }
}
</script>
