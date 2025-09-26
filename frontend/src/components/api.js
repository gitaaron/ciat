
import axios from 'axios'
const apiBase = (typeof __API__ !== 'undefined' ? __API__ : 'http://localhost:5174') + '/api'

export default {
  async getAccounts() {
    const { data } = await axios.get(apiBase + '/accounts')
    return data
  },
  async createAccount(name) {
    const { data } = await axios.post(apiBase + '/accounts', { name })
    return data
  },
  async importCSV(account_id, file) {
    const form = new FormData()
    form.append('account_id', String(account_id))
    form.append('file', file)
    const { data } = await axios.post(apiBase + '/import/csv', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    return data
  },
  async commitImport(items) {
    const { data } = await axios.post(apiBase + '/import/commit', { items })
    return data
  },
  async listTransactions(params={}) {
    const { data } = await axios.get(apiBase + '/transactions', { params })
    return data
  },
  async setCategory(id, payload) {
    const { data } = await axios.post(apiBase + `/transactions/${id}/category`, payload)
    return data
  }
}
