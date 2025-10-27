
<script setup>
import * as d3 from 'd3'
import { onMounted, ref, computed } from 'vue'
import api from './api.js'
import { CATEGORY_NAMES, CATEGORY_STEPS } from '../config/categories.js'

const el = ref(null)
const transactions = ref([])
const loading = ref(true)

// Color scale for categories
const colorScale = d3.scaleOrdinal()
  .domain(CATEGORY_STEPS)
  .range([
    '#1976d2', // blue for fixed_costs
    '#388e3c', // green for investments  
    '#e91e63', // pink for guilt_free
    '#ff9800'  // orange for short_term_savings
  ])

async function loadTransactions() {
  try {
    loading.value = true
    transactions.value = await api.listTransactions()
  } catch (error) {
    console.error('Error loading transactions:', error)
  } finally {
    loading.value = false
  }
}

// Process data for line chart
const chartData = computed(() => {
  // Filter to only expense transactions with valid categories
  const expenseTransactions = transactions.value.filter(tx => 
    tx.inflow === 0 && 
    tx.category && 
    CATEGORY_STEPS.includes(tx.category)
  )
  
  // Parse dates and group by month
  const parsed = expenseTransactions.map(r => ({
    ...r, 
    month: (r.date || '').slice(0, 7), // YYYY-MM
    val: Number(r.amount)
  }))
  
  const months = Array.from(new Set(parsed.map(d => d.month)))
    .filter(Boolean)
    .sort()
  
  // Create series for each category
  const series = CATEGORY_STEPS.map(category => ({
    key: category,
    label: CATEGORY_NAMES[category],
    color: colorScale(category),
    values: months.map(month => ({
      month,
      value: d3.sum(
        parsed.filter(d => d.category === category && d.month === month),
        d => d.val
      )
    }))
  }))
  
  return { series, months }
})

async function draw() {
  if (loading.value) return
  
  const { series, months } = chartData.value
  
  if (months.length === 0) {
    d3.select(el.value).html(`
      <div class="text-center pa-8">
        <v-icon size="48" color="grey">mdi-chart-line</v-icon>
        <p class="text-h6 mt-2">No spending data</p>
        <p class="text-body-2">Import transactions to see monthly trends</p>
      </div>
    `)
    return
  }
  
  const width = 700
  const height = 360
  const margin = { top: 20, right: 80, bottom: 40, left: 50 }
  
  // Clear previous content
  d3.select(el.value).html('')
  
  const svg = d3.select(el.value)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('max-width', '100%')
    .style('height', 'auto')
  
  // Create scales
  const x = d3.scalePoint()
    .domain(months)
    .range([margin.left, width - margin.right])
  
  const maxValue = d3.max(series.flatMap(s => s.values.map(v => v.value))) || 1
  const y = d3.scaleLinear()
    .domain([0, maxValue])
    .nice()
    .range([height - margin.bottom, margin.top])
  
  // Create line generator
  const line = d3.line()
    .x(d => x(d.month))
    .y(d => y(d.value))
    .curve(d3.curveMonotoneX)
  
  // Add axes
  svg.append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x)
      .tickFormat(d => {
        const date = new Date(d + '-01')
        return date.toLocaleDateString('en-CA', { month: 'short', year: '2-digit' })
      })
    )
    .selectAll('text')
    .style('font-size', '11px')
    .attr('transform', 'rotate(-45)')
    .attr('text-anchor', 'end')
    .attr('dx', '-0.5em')
    .attr('dy', '0.5em')
  
  svg.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y)
      .tickFormat(d => d3.format('$,.0f')(d))
    )
    .selectAll('text')
    .style('font-size', '11px')
  
  // Add grid lines
  svg.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y)
      .tickSize(-(width - margin.left - margin.right))
      .tickFormat('')
    )
    .style('opacity', 0.1)
  
  // Add Y-axis label
  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', 0 - margin.left)
    .attr('x', 0 - (height / 2))
    .attr('dy', '1em')
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('fill', '#666')
    .text('Amount ($)')
  
  // Draw lines for each series
  series.forEach(s => {
    const lineGroup = svg.append('g')
    
    // Add line
    lineGroup.append('path')
      .datum(s.values)
      .attr('fill', 'none')
      .attr('stroke', s.color)
      .attr('stroke-width', 2.5)
      .attr('d', line)
      .style('cursor', 'pointer')
    
    // Add dots
    lineGroup.selectAll('.dot')
      .data(s.values)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', d => x(d.month))
      .attr('cy', d => y(d.value))
      .attr('r', 4)
      .attr('fill', s.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        // Show tooltip
        const tooltip = d3.select('body').append('div')
          .attr('class', 'chart-tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0,0,0,0.8)')
          .style('color', 'white')
          .style('padding', '8px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', '1000')
        
        tooltip.html(`
          <div><strong>${s.label}</strong></div>
          <div>${d.month}: ${d3.format('$,.2f')(d.value)}</div>
        `)
        
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', 6)
      })
      .on('mousemove', function(event) {
        d3.select('.chart-tooltip')
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px')
      })
      .on('mouseout', function() {
        d3.select('.chart-tooltip').remove()
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', 4)
      })
  })
  
  // Add legend
  const legend = svg.append('g')
    .attr('transform', `translate(${width - margin.right + 10}, ${margin.top})`)
  
  const legendItems = legend.selectAll('.legend-item')
    .data(series.filter(s => s.values.some(v => v.value > 0)))
    .enter()
    .append('g')
    .attr('class', 'legend-item')
    .attr('transform', (d, i) => `translate(0, ${i * 20})`)
    .style('cursor', 'pointer')
  
  legendItems.append('line')
    .attr('x1', 0)
    .attr('x2', 15)
    .attr('y1', 0)
    .attr('y2', 0)
    .attr('stroke', d => d.color)
    .attr('stroke-width', 3)
  
  legendItems.append('text')
    .attr('x', 20)
    .attr('y', 0)
    .attr('dy', '0.35em')
    .style('font-size', '11px')
    .style('fill', '#333')
    .text(d => d.label)
}

onMounted(async () => {
  await loadTransactions()
  draw()
})
</script>
<template>
  <v-card>
    <v-card-title class="text-h6">
      <v-icon left>mdi-chart-line</v-icon>
      Monthly Breakdown (Line)
    </v-card-title>
    <v-card-text>
      <div ref="el" class="chart-container"></div>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.chart-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}
</style>
