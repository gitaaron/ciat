
<template>
  <v-card>
    <!-- Account Management Section -->
    <AccountManager 
      :accounts="accounts" 
      @refresh-accounts="$emit('refresh-accounts')"
    />

    <!-- Import Transactions Section -->
    <v-card>
    <v-card-title class="text-h5">
      <v-icon left>mdi-upload</v-icon>
      Import Transactions
    </v-card-title>
      
      <!-- Step 1: File Selection -->
      <v-card-text v-if="step === 1">

      <!-- Drag and Drop Zone -->
      <v-card 
        class="mb-4"
        :class="{ 'border-primary': isDragOver }"
        variant="outlined"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
        style="cursor: pointer;"
      >
        <v-card-text class="text-center pa-8">
          <v-icon size="64" color="primary" class="mb-4">mdi-file-upload</v-icon>
          <h3 class="text-h6 mb-2">Drop CSV or QFX file here</h3>
          <p class="text-body-2 mb-4">Or click to select file</p>
          <input 
            type="file" 
            accept=".csv,.qfx,.ofx,text/csv" 
            @change="handleFileSelect"
            style="display: none;"
            ref="fileInput"
          />
          <v-btn
            @click="$refs.fileInput.click()"
            color="primary"
            variant="outlined"
          >
            <v-icon left>mdi-folder-open</v-icon>
            Select File
          </v-btn>
        </v-card-text>
      </v-card>

      <!-- File List -->
      <v-card v-if="files.length > 0" variant="outlined">
        <v-card-title class="text-h6">
          <v-icon left>mdi-file-document</v-icon>
          Selected File ({{ totalFiles }} file)
        </v-card-title>
        <v-card-text>
          <v-list>
            <v-list-item
              v-for="(file, index) in files"
              :key="index"
              class="px-0"
            >
              <template v-slot:prepend>
                <v-icon color="primary">mdi-file</v-icon>
              </template>
              
              <v-list-item-title>{{ file.name }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ (file.size / 1024).toFixed(1) }} KB • {{ getFileFormat(file.name) }}
              </v-list-item-subtitle>
              
              <template v-slot:append>
                <v-btn
                  @click="removeFile(index)"
                  icon="mdi-close"
                  color="error"
                  variant="text"
                  size="small"
                />
              </template>
            </v-list-item>
          </v-list>
          
          <v-row class="mt-4">
            <v-col cols="12" sm="6">
              <v-btn
                @click="analyzeFiles"
                :disabled="processing || files.length === 0"
                :loading="processing"
                color="primary"
                block
              >
                <v-icon left>mdi-magnify</v-icon>
                {{ processing ? 'Analyzing...' : 'Analyze Files' }}
              </v-btn>
            </v-col>
            <v-col cols="12" sm="6">
              <v-btn
                @click="resetImport"
                color="secondary"
                variant="outlined"
                block
              >
                <v-icon left>mdi-refresh</v-icon>
                Reset
              </v-btn>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </v-card-text>

    <!-- Step 2: Account Assignment -->
    <v-card-text v-if="step === 2">
      <v-card-title class="text-h6 mb-4">
        <v-icon left>mdi-account-arrow-right</v-icon>
        Assign File to Account
        <v-spacer />
        <v-btn @click="resetImport" color="secondary" variant="outlined">
          <v-icon left>mdi-arrow-left</v-icon>
          Back to File
        </v-btn>
      </v-card-title>

      <v-card variant="outlined" class="mb-4">
        <v-card-text>
          <v-list>
            <v-list-item
              v-for="(analysis, index) in fileAnalysis"
              :key="index"
              class="px-0"
            >
              <template v-slot:prepend>
                <v-icon color="primary">mdi-file</v-icon>
              </template>
              
              <v-list-item-title>{{ analysis.filename }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ (files[index].size / 1024).toFixed(1) }} KB • {{ analysis.formatDisplayName || getFileFormat(analysis.filename) }}
                <br>
                <span v-if="analysis.suggestedAccount" class="text-primary">
                  <strong>Suggested:</strong> {{ analysis.suggestedAccount.name }} 
                  ({{ Math.round(analysis.confidence * 100) }}% confidence)
                </span>
                <span v-else class="text-success">
                  <strong>Suggested name:</strong> {{ analysis.suggestedName }}
                </span>
              </v-list-item-subtitle>
              
              <template v-slot:append>
                <v-row class="align-center">
                  <v-col cols="auto">
                    <v-select
                      :model-value="getCurrentAccountId(index)"
                      @update:model-value="reassignFile(index, $event)"
                      :items="props.accounts.length === 0 ? [{ id: null, name: 'No Account Available' }] : props.accounts"
                      item-title="name"
                      item-value="id"
                      label="Select Account"
                      variant="outlined"
                      density="compact"
                      style="min-width: 200px;"
                      :disabled="props.accounts.length === 0"
                    />
                  </v-col>
                  <v-col cols="auto">
                    <v-btn
                      @click="removeFile(index)"
                      icon="mdi-close"
                      color="error"
                      variant="text"
                      size="small"
                    />
                  </v-col>
                </v-row>
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>

      <v-row>
        <v-col cols="12" sm="6">
          <v-btn
            @click="processAllFiles"
            :disabled="processing || !allFilesAssigned"
            :loading="processing"
            color="primary"
            block
          >
            <v-icon left>mdi-cog</v-icon>
            {{ processing ? 'Processing...' : 'Process File' }}
          </v-btn>
        </v-col>
        <v-col cols="12" sm="6">
          <v-btn
            @click="resetImport"
            color="secondary"
            variant="outlined"
            block
          >
            <v-icon left>mdi-cancel</v-icon>
            Cancel
          </v-btn>
        </v-col>
      </v-row>
    </v-card-text>

    <!-- Step 3: Rules Review -->
    <v-card-text v-if="step === 3">
      <ManageRules
        :new-rules="newRules"
        :used-rules="usedRules"
        :auto-rules="autoRules"
        :new-rule-matches="newRuleMatches"
        :existing-rule-matches="existingRuleMatches"
        :auto-rule-matches="autoRuleMatches"
        :accounts="accounts"
        :applying="processing"
        @refresh-rules="handleRulesRefresh"
        @rule-created="addNewRule"
        ref="manageRules"
      />
      
      <!-- Actions -->
      <v-card class="mt-4" variant="outlined">
        <v-card-text>
          <div class="d-flex align-center justify-space-between">
            <div class="actions-info">
              <p class="mb-0">Review rules as needed. All auto-generated rules will be applied automatically when you continue to import.</p>
            </div>
            <v-btn 
              color="primary" 
              size="large"
              @click="handleSaveRules"
              :loading="processing"
              :disabled="processing"
            >
              {{ processing ? 'Saving Rules...' : 'Save Rules' }}
            </v-btn>
          </div>
        </v-card-text>
      </v-card>
    </v-card-text>

    <!-- Step 4: Transaction Review -->
    <v-card-text v-if="step === 4">
      <TransactionReview
        :previews-by-account="previewsByAccount"
        :accounts="accounts"
        :processing="processing"
        @back-to-rules="goBackToRules"
        @import-transactions="handleImportTransactions"
      />
    </v-card-text>

    <!-- Step 5: Complete -->
    <v-card-text v-if="step === 5">
      <v-card variant="outlined" class="text-center">
        <v-card-text class="pa-8">
          <v-icon size="80" color="success" class="mb-4">mdi-check-circle</v-icon>
          <h3 class="text-h4 mb-2 text-success">Import Complete!</h3>
          <p class="text-h6">All transactions have been successfully imported.</p>
        </v-card-text>
      </v-card>
    </v-card-text>
    </v-card>

  </v-card>
</template>

<script src="./ImportWizard.js"></script>
<style scoped src="./ImportWizard.css"></style>
