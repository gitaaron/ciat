<template>
  <v-card>
    <!-- Account Management Section (Always Visible) -->
    <v-card class="mb-4" variant="outlined">
      <v-card-title class="text-h6">
        <v-icon left>mdi-wallet</v-icon>
        Account Management
      </v-card-title>
      
      <v-card-text>
        <!-- Create New Account Section -->
        <v-card class="mb-4" variant="outlined">
          <v-card-title class="text-subtitle-1">Create New Account</v-card-title>
          <v-card-text>
            <v-form @submit.prevent="addAccount" ref="createForm">
              <v-row>
                <v-col cols="12" md="8">
                  <v-text-field
                    v-model="newAccount"
                    label="Account Name"
                    :rules="accountNameRules"
                    :error-messages="createError"
                    @input="createError = ''"
                    variant="outlined"
                    density="compact"
                    required
                  />
                </v-col>
                <v-col cols="12" md="4" class="d-flex align-center">
                  <v-btn
                    type="submit"
                    color="primary"
                    :loading="creating"
                    :disabled="!newAccount.trim()"
                    block
                  >
                    <v-icon left>mdi-plus</v-icon>
                    Create Account
                  </v-btn>
                </v-col>
              </v-row>
            </v-form>
          </v-card-text>
        </v-card>

        <!-- Existing Accounts List -->
        <v-card variant="outlined">
          <v-card-title class="text-subtitle-1">Existing Accounts</v-card-title>
          <v-card-text>
            <v-alert
              v-if="accounts.length === 0"
              type="info"
              variant="tonal"
              class="mb-4"
            >
              No accounts created yet. Create your first account above to get started.
            </v-alert>
            
            <v-list v-else>
              <v-list-item
                v-for="account in accounts"
                :key="account.id"
                class="px-0"
              >
                <template v-slot:prepend>
                  <v-icon>mdi-bank</v-icon>
                </template>
                
                <v-list-item-title>
                  <v-text-field
                    v-if="editingAccount === account.id"
                    v-model="editAccountName"
                    :rules="accountNameRules"
                    :error-messages="editError"
                    @keyup.enter="saveAccount(account.id)"
                    @keyup.escape="cancelEdit"
                    autofocus
                    density="compact"
                    variant="outlined"
                  />
                  <span v-else>{{ account.name }}</span>
                </v-list-item-title>
                
                <v-list-item-subtitle>
                  Created: {{ formatDate(account.created_at) }}
                </v-list-item-subtitle>
                
                <template v-slot:append>
                  <div v-if="editingAccount === account.id" class="d-flex">
                    <v-btn
                      icon="mdi-check"
                      size="small"
                      color="success"
                      @click="saveAccount(account.id)"
                      :loading="updating"
                      class="mr-2"
                    />
                    <v-btn
                      icon="mdi-close"
                      size="small"
                      color="error"
                      @click="cancelEdit"
                    />
                  </div>
                  <div v-else class="d-flex">
                    <v-btn
                      icon="mdi-pencil"
                      size="small"
                      @click="startEdit(account)"
                      class="mr-2"
                    />
                    <v-btn
                      icon="mdi-delete"
                      size="small"
                      color="error"
                      @click="confirmDelete(account)"
                    />
                  </div>
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-card-text>
    </v-card>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteDialog" max-width="500">
      <v-card>
        <v-card-title class="text-h6">
          <v-icon left color="error">mdi-alert-circle</v-icon>
          Confirm Account Deletion
        </v-card-title>
        
        <v-card-text>
          <p>Are you sure you want to delete the account <strong>"{{ accountToDelete?.name }}"</strong>?</p>
          <v-alert
            v-if="deleteError"
            type="error"
            variant="tonal"
            class="mt-4"
          >
            {{ deleteError }}
          </v-alert>
          <v-alert
            type="warning"
            variant="tonal"
            class="mt-4"
          >
            <strong>Warning:</strong> This action cannot be undone. If this account has transactions, you'll need to delete or reassign them first.
          </v-alert>
        </v-card-text>
        
        <v-card-actions>
          <v-spacer />
          <v-btn
            @click="deleteDialog = false"
            :disabled="deleting"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            @click="deleteAccount"
            :loading="deleting"
          >
            <v-icon left>mdi-delete</v-icon>
            Delete Account
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script src="./AccountManager.js"></script>
<style scoped src="./AccountManager.css"></style>
