import React from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { getSummary, getHeatmap, getUnmapped, getConfidenceDistribution, getMappingStatus } from '../services/api'
import { TrendingUp, Box, Zap, AlertTriangle } from 'lucide-react'

const COLORS = ['#6366f1', '#2dd4bf', '#f59e0b', '#f43f5e', '#10b981', '#8b5cf6']

export default function AnalyticsPage() {
  const { data: status } = useQuery({
    queryKey: ['mapping-status'],
    queryFn: () => getMappingStatus().then(r => r.data),
  })

  const enabled = status?.status === 'done'

  const { data: summary } = useQuery({ queryKey: ['summary'], queryFn: () => getSummary().then(r => r.data), enabled })
  const { data: heatmap } = useQuery({ queryKey: ['heatmap'], queryFn: () => getHeatmap().then(r => r.data), enabled })
  const { data: unmapped } = useQuery({ queryKey: ['unmapped'], queryFn: () => getUnmapped().then(r => r.data), enabled })
  const { data: confDist } = useQuery({ queryKey: ['conf-dist'], queryFn: () => getConfidenceDistribution().then(r => r.data), enabled })

  if (!enabled) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full">
        <Box size={40} className="text-slate-600 mb-3" />
        <p className="text-slate-400 font-display font-semibold">No mapping results yet</p>
        <p className="text-slate-500 text-sm mt-1">Run the mapping engine to see analytics.</p>
      </div>
    )
  }

  const topCaps = summary?.top_capabilities?.map(([cap, count]) => ({ cap: cap.length > 30 ? cap.slice(0, 28) + '…' : cap, count })) || []
  const vcCoverage = Object.entries(summary?.value_chain_coverage || {}).map(([vc, count]) => ({ vc: vc.length > 20 ? vc.slice(0, 18) + '…' : vc, count }))

  // Build heatmap cells
  const heatmapRows = {}
  ;(heatmap || []).forEach(item => {
    if (!heatmapRows[item.value_chain]) heatmapRows[item.value_chain] = []
    heatmapRows[item.value_chain].push(item)
  })

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-white">Mapping Analytics</h1>
        <p className="text-slate-400 text-sm mt-1">Coverage, confidence, and distribution insights</p>
      </div>

      {/* KPI cards */}
      {summary && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-4 gap-4 mb-6"
        >
          <KPICard icon={<TrendingUp size={16} />} label="Total Applications" value={summary.total_applications} color="accent" />
          <KPICard icon={<Zap size={16} />} label="Mapped" value={`${summary.mapped_count} (${Math.round(summary.mapping_rate * 100)}%)`} color="emerald" />
          <KPICard icon={<Box size={16} />} label="Avg Confidence" value={`${Math.round(summary.average_confidence * 100)}%`} color="teal" />
          <KPICard icon={<AlertTriangle size={16} />} label="Unmapped" value={summary.unmapped_count} color="amber" />
        </motion.div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-5 mb-6">
        {/* Top Capabilities */}
        <div className="glass-card p-5">
          <h3 className="font-display font-semibold text-white text-sm mb-4">Top 10 Capabilities by App Count</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topCaps} layout="vertical" margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#252d40" />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis dataKey="cap" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={140} />
              <Tooltip
                contentStyle={{ background: '#1e2535', border: '1px solid #ffffff10', borderRadius: 8 }}
                labelStyle={{ color: '#fff', fontSize: 11 }}
              />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Confidence Distribution */}
        <div className="glass-card p-5">
          <h3 className="font-display font-semibold text-white text-sm mb-4">Confidence Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={confDist || []}
                dataKey="count"
                nameKey="range"
                cx="50%" cy="50%"
                outerRadius={80}
                label={({ range, count }) => `${range}: ${count}`}
                labelLine={{ stroke: '#475569' }}
              >
                {(confDist || []).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1e2535', border: '1px solid #ffffff10', borderRadius: 8 }}
                labelStyle={{ color: '#fff', fontSize: 11 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Value Chain Coverage bar */}
      <div className="glass-card p-5 mb-6">
        <h3 className="font-display font-semibold text-white text-sm mb-4">App Count by Value Chain</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={vcCoverage}>
            <CartesianGrid strokeDasharray="3 3" stroke="#252d40" />
            <XAxis dataKey="vc" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: '#1e2535', border: '1px solid #ffffff10', borderRadius: 8 }}
              labelStyle={{ color: '#fff', fontSize: 11 }}
            />
            <Bar dataKey="count" fill="#2dd4bf" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Capability Coverage Heatmap */}
      {Object.keys(heatmapRows).length > 0 && (
        <div className="glass-card p-5 mb-6">
          <h3 className="font-display font-semibold text-white text-sm mb-4">Capability Coverage Heatmap</h3>
          <div className="space-y-4 overflow-x-auto">
            {Object.entries(heatmapRows).map(([vc, caps]) => (
              <div key={vc}>
                <p className="text-xs font-semibold text-slate-400 mb-2">{vc}</p>
                <div className="flex flex-wrap gap-2">
                  {caps.map(cell => {
                    const opacity = cell.app_count === 0 ? 0.1 : Math.min(0.2 + cell.app_count * 0.15, 1)
                    return (
                      <div
                        key={cell.capability}
                        title={`${cell.capability}: ${cell.app_count} apps, avg conf ${Math.round(cell.avg_confidence * 100)}%`}
                        className="relative group cursor-default"
                      >
                        <div
                          className="px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
                          style={{
                            background: cell.app_count === 0
                              ? 'rgba(255,255,255,0.03)'
                              : `rgba(99,102,241,${opacity})`,
                            border: `1px solid ${cell.app_count === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.3)'}`,
                            color: cell.app_count === 0 ? '#475569' : '#a5b4fc',
                          }}
                        >
                          {cell.capability.length > 25 ? cell.capability.slice(0, 23) + '…' : cell.capability}
                          {cell.app_count > 0 && (
                            <span className="ml-1.5 text-accent-light font-mono">{cell.app_count}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-slate-500">Coverage:</span>
            <div className="flex items-center gap-1"><div className="w-4 h-4 rounded bg-white/5 border border-white/5" /><span className="text-xs text-slate-500">Gap (0 apps)</span></div>
            <div className="flex items-center gap-1"><div className="w-4 h-4 rounded bg-accent/20 border border-accent/30" /><span className="text-xs text-slate-500">Covered</span></div>
          </div>
        </div>
      )}

      {/* Unmapped table */}
      {unmapped && unmapped.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="font-display font-semibold text-white text-sm mb-4 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-400" />
            Unmapped Applications ({unmapped.length})
          </h3>
          <div className="space-y-2">
            {unmapped.map(app => (
              <div key={app.application_name} className="flex items-center gap-4 py-2 border-b border-white/4 last:border-0">
                <span className="text-sm text-white flex-1">{app.application_name}</span>
                <span className="text-xs text-slate-500">{app.vendor}</span>
                <span className="badge-weak">{app.match_tier}</span>
                <span className="text-xs font-mono text-slate-500">{Math.round(app.match_score * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function KPICard({ icon, label, value, color }) {
  const colors = {
    accent: 'text-accent-light bg-accent/10',
    emerald: 'text-emerald-400 bg-emerald-accent/10',
    teal: 'text-teal-accent bg-teal-glow',
    amber: 'text-amber-400 bg-amber-accent/10',
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>
        {icon}
      </div>
      <p className="label mb-1">{label}</p>
      <p className="font-display text-xl font-bold text-white">{value}</p>
    </motion.div>
  )
}
