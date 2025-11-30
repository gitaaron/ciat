
import axios from 'axios'

// Dynamically determine API base URL based on current hostname
// This allows the app to work from any IP address (e.g., 100.111.18.106)
function getApiBase() {
  // If __API__ is defined (from Vite config), use it
  if (typeof __API__ !== 'undefined' && __API__ !== 'http://localhost:3108') {
    return __API__ + '/api'
  }
  
  // Otherwise, use the current hostname with port 3108
  // This works when accessing from any IP (e.g., 100.111.18.106:5175 -> 100.111.18.106:3108)
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol
    const hostname = window.location.hostname
    return `${protocol}//${hostname}:3108/api`
  }
  
  // Fallback for SSR or non-browser environments
  return 'http://localhost:3108/api'
}

const apiBase = getApiBase()

export default {
  async getAccounts() {
    const { data } = await axios.get(apiBase + '/accounts')
    return data
  },
  async createAccount(name, type) {
    const { data } = await axios.post(apiBase + '/accounts', { name, type })
    return data
  },
  async updateAccount(id, name, type) {
    const { data } = await axios.put(apiBase + `/accounts/${id}`, { name, type })
    return data
  },
  async deleteAccount(id) {
    const { data } = await axios.delete(apiBase + `/accounts/${id}`)
    return data
  },
  async importCSV(account_id, file) {
    const form = new FormData()
    form.append('account_id', String(account_id))
    form.append('file', file)
    const { data } = await axios.post(apiBase + '/import/transactions', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    return data
  },
  async getManualOverrides() {
    const { data } = await axios.get(apiBase + '/manual-overrides')
    return data.manualOverrides || {}
  },
  async commitImport(items) {
    const { data } = await axios.post(apiBase + '/import/commit', { items })
    return data
  },
  async listTransactions(params={}) {
    const { data } = await axios.get(apiBase + '/transactions', { params })
    return data
  },
  async createTransaction(transactionData) {
    const { data } = await axios.post(apiBase + '/transactions', transactionData)
    return data
  },
  async setCategory(id, payload) {
    const { data } = await axios.post(apiBase + `/transactions/${id}/category`, payload)
    return data
  },
  async updateTransaction(id, payload) {
    const { data } = await axios.put(apiBase + `/transactions/${id}`, payload)
    return data
  },
  async analyzeFiles(files) {
    const form = new FormData()
    files.forEach(file => form.append('files', file))
    const { data } = await axios.post(apiBase + '/import/analyze', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    return data
  },
  // Rule management APIs
  async previewRule(ruleData) {
    const { data } = await axios.post(apiBase + '/rules/preview', ruleData)
    return data
  },
  async createRule(ruleData) {
    const { data } = await axios.post(apiBase + '/rules', ruleData)
    return data
  },
  async getRules() {
    const { data } = await axios.get(apiBase + '/rules')
    return data
  },
  async getSystemRules() {
    const { data } = await axios.get(apiBase + '/rules/system')
    return data
  },
  async updateRule(ruleId, ruleData) {
    const { data } = await axios.put(apiBase + `/rules/${ruleId}`, ruleData)
    return data
  },
  async toggleRule(ruleId, enabled) {
    const { data } = await axios.patch(apiBase + `/rules/${ruleId}/toggle`, { enabled })
    return data
  },
  async deleteRule(ruleId) {
    const { data } = await axios.delete(apiBase + `/rules/${ruleId}`)
    return data
  },
  // Auto rule generation APIs
  async generateAutoRules(transactions) {
    const { data } = await axios.post(apiBase + '/rules/auto-generate', { 
      transactions
    })
    return data
  },
  async applyAutoRules(rulesToApply, transactions) {
    const { data } = await axios.post(apiBase + '/auto-rules/apply', { rulesToApply, transactions })
    return data
  },
  async getLabels() {
    const { data } = await axios.get(apiBase + '/labels')
    return data
  },
  async reapplyRules() {
    const { data } = await axios.post(apiBase + '/reapply-categories')
    return data
  },
  // Field mapping APIs
  async previewCSV(file) {
    const form = new FormData()
    form.append('file', file)
    const { data } = await axios.post(apiBase + '/import/preview-csv', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    return data
  },
  async updateAccountFieldMapping(accountId, fieldMapping) {
    const { data } = await axios.put(apiBase + `/accounts/${accountId}/field-mapping`, { field_mapping: fieldMapping })
    return data
  },
  // Category targets APIs
  async getCategoryTargets() {
    const { data } = await axios.get(apiBase + '/category-targets')
    return data
  },
  async getDefaultCategoryTargets() {
    const { data } = await axios.get(apiBase + '/category-targets/defaults')
    return data
  },
  async saveCategoryTargets(targets) {
    const { data } = await axios.put(apiBase + '/category-targets', { targets })
    return data
  },
  // Target savings APIs
  async getTargetSavings() {
    const { data } = await axios.get(apiBase + '/target-savings')
    return data
  },
  async saveTargetSavings(percentage) {
    const { data } = await axios.put(apiBase + '/target-savings', { percentage })
    return data
  },
  // Bucket list APIs
  async getBucketListItems() {
    const { data } = await axios.get(apiBase + '/bucket-list-items')
    return data
  },
  async createBucketListItem(item) {
    const { data } = await axios.post(apiBase + '/bucket-list-items', {
      name: item.name,
      description: item.description,
      estimated_cost: item.estimatedCost
    })
    return data
  },
  async updateBucketListItem(id, item) {
    const { data } = await axios.put(apiBase + `/bucket-list-items/${id}`, {
      name: item.name,
      description: item.description,
      estimated_cost: item.estimatedCost
    })
    return data
  },
  async deleteBucketListItem(id) {
    const { data } = await axios.delete(apiBase + `/bucket-list-items/${id}`)
    return data
  },
  // Check if account has existing transactions
  async accountHasTransactions(accountId) {
    const { data } = await axios.get(apiBase + `/accounts/${accountId}/has-transactions`)
    return data
  }
}
