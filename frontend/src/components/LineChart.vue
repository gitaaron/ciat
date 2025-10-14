
<script setup>
import * as d3 from 'd3'
import { onMounted, ref } from 'vue'
import api from './api.js'

const el = ref(null)
async function draw() {
  const rows = await api.listTransactions()
  // compute month totals by category (expenses positive)
  const parsed = rows.map(r => ({...r, month: (r.date||'').slice(0,7), val: r.inflow ? -Number(r.amount) : Number(r.amount) }))
  const categories = Array.from(new Set(parsed.map(d => d.category || '(none)')))
  const months = Array.from(new Set(parsed.map(d => d.month))).sort()
  const series = categories.map(cat => ({
    key: cat,
    values: months.map(m => ({ month: m, value: d3.sum(parsed.filter(d => d.category===cat && d.month===m), d => d.val) }))
  }))

  const width = 700, height = 360, margin = {top:20,right:20,bottom:30,left:40}
  const x = d3.scalePoint().domain(months).range([margin.left, width-margin.right])
  const y = d3.scaleLinear().domain([0, d3.max(series.flatMap(s => s.values.map(v => v.value))) || 1]).nice().range([height-margin.bottom, margin.top])

  const svg = d3.select(el.value).html('').append('svg').attr('width', width).attr('height', height)

  svg.append('g').attr('transform', `translate(0,${height-margin.bottom})`).call(d3.axisBottom(x))
  svg.append('g').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y))

  for (const s of series) {
    const line = d3.line().x(d => x(d.month)).y(d => y(d.value))
    svg.append('path').datum(s.values).attr('fill','none').attr('stroke-width',1.5).attr('d', line)
    // label last point
    const last = s.values[s.values.length-1]
    if (last) svg.append('text').attr('x', x(last.month)+4).attr('y', y(last.value)).attr('dominant-baseline','middle').text(s.key)
  }
}
onMounted(draw)
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
