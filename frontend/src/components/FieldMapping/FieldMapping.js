import { ref, computed, watch } from 'vue'

export default {
  name: 'FieldMapping',
  props: {
    csvColumns: {
      type: Array,
      default: () => []
    },
    previewRows: {
      type: Array,
      default: () => []
    },
    initialMapping: {
      type: Object,
      default: null
    }
  },
  emits: ['mapping-changed'],
  setup(props, { emit }) {
    // Map column name -> field type (date, name, inflow, outflow)
    const columnToFieldMapping = ref({})
    
    // Field options for the menu
    const fieldOptions = computed(() => {
      const baseOptions = [
        { label: 'Date', value: 'date' },
        { label: 'Merchant Name', value: 'name' },
        { label: 'Inflow (Income)', value: 'inflow' },
        { label: 'Outflow (Expense)', value: 'outflow' }
      ]
      
      // Add External ID option if there are 5 or more columns (can be used for CC numbers)
      if (props.csvColumns && props.csvColumns.length >= 5) {
        baseOptions.push({ label: 'External ID (Optional)', value: 'external_id' })
      }
      
      return baseOptions
    })
    
    // Convert index-based mapping to column->field mapping for internal use
    // Input: { 0: 'date', 1: 'name', ... } (index -> field)
    // Output: { 'ColumnName1': 'date', 'ColumnName2': 'name', ... } (column display name -> field)
    function convertIndexMappingToColumnMapping(indexMapping) {
      const columnMapping = {}
      if (indexMapping && typeof indexMapping === 'object') {
        for (const [indexStr, field] of Object.entries(indexMapping)) {
          const index = parseInt(indexStr, 10)
          if (!isNaN(index) && index >= 0 && index < props.csvColumns.length) {
            const columnName = props.csvColumns[index]
            if (columnName) {
              columnMapping[columnName] = field
            }
          }
        }
      }
      return columnMapping
    }
    
    // Convert column->field mapping to index-based mapping
    // Format: { 0: 'date', 1: 'name', 2: 'outflow', 3: 'inflow' }
    function convertToIndexMapping(columnMapping) {
      const indexMapping = {}
      for (const [column, field] of Object.entries(columnMapping)) {
        if (field) {
          // Find the index of this column in csvColumns
          const columnIndex = props.csvColumns.indexOf(column)
          if (columnIndex >= 0) {
            indexMapping[columnIndex] = field
          }
        }
      }
      return indexMapping
    }
    
    // Preview data with mapped fields
    const previewData = computed(() => {
      return props.previewRows
    })
    
    // Get field value from row (helper function)
    // Note: columnName can be empty string '' for headerless CSV where column has no name
    function getFieldValue(row, columnName) {
      if (!row) return ''
      // Empty string is a valid column name, so only check for null/undefined
      if (columnName === null || columnName === undefined) return ''
      // Access the value - empty string key is valid
      const value = row[columnName]
      return value !== undefined && value !== null ? String(value) : ''
    }
    
    // Get which field is assigned to a column
    function getFieldForColumn(column) {
      return columnToFieldMapping.value[column] || null
    }
    
    // Get field label for display
    function getFieldLabel(field) {
      const option = fieldOptions.value.find(opt => opt.value === field)
      return option ? option.label : field
    }
    
    // Check if a field is already mapped to another column
    function isFieldAlreadyMapped(field) {
      return Object.values(columnToFieldMapping.value).includes(field)
    }
    
    // Assign a field to a column
    function assignFieldToColumn(column, field) {
      // If field is already mapped to another column, clear it first
      const existingColumn = Object.keys(columnToFieldMapping.value).find(
        col => columnToFieldMapping.value[col] === field && col !== column
      )
      if (existingColumn) {
        delete columnToFieldMapping.value[existingColumn]
      }
      
      // Assign the field to this column
      columnToFieldMapping.value[column] = field
      updateMapping()
    }
    
    // Clear mapping for a column
    function clearColumnMapping(column) {
      delete columnToFieldMapping.value[column]
      updateMapping()
    }
    
    // Check if mapping is complete (all required fields mapped)
    const isMappingComplete = computed(() => {
      const indexMapping = convertToIndexMapping(columnToFieldMapping.value)
      const values = Object.values(indexMapping)
      return values.includes('date') && values.includes('name') && 
             values.includes('inflow') && values.includes('outflow')
    })
    
    // Get list of missing fields
    const missingFields = computed(() => {
      const indexMapping = convertToIndexMapping(columnToFieldMapping.value)
      const values = Object.values(indexMapping)
      const missing = []
      if (!values.includes('date')) missing.push('Date')
      if (!values.includes('name')) missing.push('Merchant Name')
      if (!values.includes('inflow')) missing.push('Inflow (Income)')
      if (!values.includes('outflow')) missing.push('Outflow (Expense)')
      return missing
    })
    
    // Auto-detect field mappings based on column names and data
    function autoDetectMapping() {
      if (!props.csvColumns || props.csvColumns.length === 0) return
      
      const lowerColumns = props.csvColumns.map(c => c.toLowerCase())
      const fieldMapping = {
        date: '',
        name: '',
        inflow: '',
        outflow: ''
      }
      
      // Detect date column
      const datePatterns = ['date', 'transaction date', 'posting date', 'posted date']
      fieldMapping.date = props.csvColumns.find((col, idx) => 
        datePatterns.some(pattern => lowerColumns[idx].includes(pattern))
      ) || props.csvColumns[0] || ''
      
      // Detect name column
      const namePatterns = ['name', 'merchant', 'description', 'payee', 'vendor', 'store']
      fieldMapping.name = props.csvColumns.find((col, idx) => 
        namePatterns.some(pattern => lowerColumns[idx].includes(pattern))
      ) || props.csvColumns[1] || ''
      
      // First, find all numeric columns (potential inflow/outflow columns)
      const numericColumns = []
      if (props.previewRows && props.previewRows.length > 0) {
        for (const col of props.csvColumns) {
          if (col === fieldMapping.date || col === fieldMapping.name) continue
          
          // Check if this column has numeric values in preview rows
          const hasNumericValues = props.previewRows.some(row => {
            const val = getFieldValue(row, col)
            const numVal = val ? Number(val) : 0
            return numVal > 0
          })
          
          if (hasNumericValues) {
            numericColumns.push(col)
          }
        }
      }
      
      // Detect both inflow and outflow columns together to avoid circular dependencies
      const inflowPatterns = ['credit', 'deposit', 'income', 'inflow', 'received', 'credit amount']
      const outflowPatterns = ['debit', 'withdrawal', 'expense', 'outflow', 'paid', 'amount', 'debit amount', 'charge']
      
      let detectedInflow = props.csvColumns.find((col, idx) => 
        inflowPatterns.some(pattern => lowerColumns[idx].includes(pattern))
      )
      let detectedOutflow = props.csvColumns.find((col, idx) => 
        outflowPatterns.some(pattern => lowerColumns[idx].includes(pattern))
      )
      
      // If not found by name, analyze data patterns
      if ((!detectedInflow || !detectedOutflow) && numericColumns.length > 0) {
        // Analyze each numeric column to see which rows have values
        const columnAnalysis = numericColumns.map(col => {
          let rowsWithOnlyThisColumn = 0
          let firstValue = null
          let firstValueRow = -1
          
          for (let i = 0; i < props.previewRows.length; i++) {
            const row = props.previewRows[i]
            const val = getFieldValue(row, col)
            const num = val ? Number(val) : 0
            if (num > 0) {
              if (firstValue === null) {
                firstValue = val
                firstValueRow = i
              }
              
              // Check if other numeric columns are empty in this row
              const otherColumnsHaveValues = numericColumns.some(otherCol => {
                if (otherCol === col) return false
                const otherVal = getFieldValue(row, otherCol)
                const otherNum = otherVal ? Number(otherVal) : 0
                return otherNum > 0
              })
              if (!otherColumnsHaveValues) {
                rowsWithOnlyThisColumn++
              }
            }
          }
          
          return { col, rowsWithOnlyThisColumn, firstValue, firstValueRow, columnIndex: props.csvColumns.indexOf(col) }
        })
        
        // Sort by column position (earlier columns first)
        columnAnalysis.sort((a, b) => a.columnIndex - b.columnIndex)
        
        // If we have exactly 2 numeric columns and haven't detected by name
        if (numericColumns.length === 2 && !detectedInflow && !detectedOutflow) {
          // Assign based on position: first = outflow, second = inflow (typical CSV: date, name, outflow, inflow)
          detectedOutflow = columnAnalysis[0].col
          detectedInflow = columnAnalysis[1].col
        } else {
          // Try to find columns with distinct patterns
          if (!detectedInflow) {
            // Look for column with rows where it's the only value (likely inflow)
            const inflowCandidate = columnAnalysis.find(c => c.rowsWithOnlyThisColumn > 0 && c.col !== detectedOutflow)
            if (inflowCandidate) {
              detectedInflow = inflowCandidate.col
            } else if (numericColumns.length > 0) {
              detectedInflow = numericColumns.find(col => col !== detectedOutflow) || numericColumns[0]
            }
          }
          
          if (!detectedOutflow) {
            // Look for column with rows where it's the only value (likely outflow)
            const outflowCandidate = columnAnalysis.find(c => c.rowsWithOnlyThisColumn > 0 && c.col !== detectedInflow)
            if (outflowCandidate) {
              detectedOutflow = outflowCandidate.col
            } else if (numericColumns.length > 0) {
              detectedOutflow = numericColumns.find(col => col !== detectedInflow) || numericColumns[0]
            } else {
              detectedOutflow = props.csvColumns[2] || ''
            }
          }
        }
      } else if (!detectedOutflow) {
        // Fallback to third column if available
        detectedOutflow = props.csvColumns[2] || ''
      }
      
      fieldMapping.inflow = detectedInflow || ''
      fieldMapping.outflow = detectedOutflow || ''
      
      // Auto-detect External ID if there's a 5th column (can be used for CC numbers)
      if (props.csvColumns.length >= 5) {
        const externalIdColumn = props.csvColumns[4] // 5th column (0-indexed)
        const lowerColumn = externalIdColumn.toLowerCase()
        
        // Check if column name suggests it's a credit card number or external ID
        const idPatterns = ['card', 'number', 'cc', 'credit card', 'card number', 'external', 'id', 'external_id']
        const looksLikeId = idPatterns.some(pattern => lowerColumn.includes(pattern))
        
        // Also check if the data looks like credit card numbers (long numeric strings)
        let dataLooksLikeId = false
        if (props.previewRows && props.previewRows.length > 0) {
          const sampleValue = getFieldValue(props.previewRows[0], externalIdColumn)
          // Credit card numbers are typically 13-19 digits, but external IDs can vary
          const cleaned = String(sampleValue).replace(/\D/g, '')
          dataLooksLikeId = cleaned.length >= 4 && cleaned.length <= 19
        }
        
        if (looksLikeId || dataLooksLikeId) {
          fieldMapping.external_id = externalIdColumn
        }
      }
      
      // Convert field->column mapping to column->field mapping
      const columnMapping = {}
      for (const [field, column] of Object.entries(fieldMapping)) {
        if (column) {
          columnMapping[column] = field
        }
      }
      columnToFieldMapping.value = columnMapping
    }
    
    // Initialize mapping
    if (props.initialMapping) {
      // initialMapping can be index-based format: { 0: 'date', 1: 'name', ... }
      // Convert it to column->field mapping for internal use
      columnToFieldMapping.value = convertIndexMappingToColumnMapping(props.initialMapping)
    } else {
      autoDetectMapping()
    }
    
    // Watch for CSV columns changes and re-detect
    watch(() => props.csvColumns, () => {
      if (!props.initialMapping) {
        autoDetectMapping()
      }
    }, { immediate: true })
    
    // Update mapping and emit change
    // Emit index-based mapping: { 0: 'date', 1: 'name', ... }
    function updateMapping() {
      const indexMapping = convertToIndexMapping(columnToFieldMapping.value)
      emit('mapping-changed', indexMapping)
    }
    
    // Expose the columnToFieldMapping so parent can access it with display names
    function getColumnToFieldMapping() {
      return columnToFieldMapping.value
    }
    
    // Get index-based mapping
    function getIndexMapping() {
      return convertToIndexMapping(columnToFieldMapping.value)
    }
    
      // Expose for template
      return {
      csvColumns: computed(() => props.csvColumns),
      fieldOptions,
      previewData,
      getFieldValue,
      getFieldForColumn,
      getFieldLabel,
      isFieldAlreadyMapped,
      assignFieldToColumn,
      clearColumnMapping,
      isMappingComplete,
      missingFields,
      getIndexMapping
    }
  }
}

