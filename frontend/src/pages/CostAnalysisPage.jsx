import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Box, Loader2, DollarSign, AlertTriangle, Zap, CheckCircle } from 'lucide-react'
import {
  getMappingStatus,
  getCostConcentration,
  runRedundancyAnalysis,
  getRedundancyStatus,
} from '../services/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(n) {
  if (!n) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function fmtCurrencyFull(n) {
  if (!n) return '—'
  return `$${Math.round(n).toLocaleString()}`
}

const OVERLAP_ORDER = { high: 0, medium: 1, low: 2 }

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function ConcTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div
      className="rounded-lg p-3 text-xs"
      style={{ background: '#1e2535', border: '1px solid rgba(255,255,255,0.08)', minWidth: 200 }}
    >
      <p className="font-semibold text-white mb-1">{d.fullCap}</p>
      <p className="text-slate-400 mb-1">{d.value_chain}</p>
      <p className="text-accent-light font-mono">{fmtCurrencyFull(d.total_spend)}</p>
      <p className="text-slate-500 mt-0.5">{d.app_count} application{d.app_count !== 1 ? 's' : ''}</p>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CostAnalysisPage() {
  const [polling, setPolling] = useState(false)

  const { data: status } = useQuery({
    queryKey: ['mapping-status'],
    queryFn: () => getMappingStatus().then(r => r.data),
  })

  const enabled = status?.status === 'done'

  const { data: concentration, isLoading: loadingConc } = useQuery({
    queryKey: ['cost-concentration'],
    queryFn: () => getCostConcentration().then(r => r.data),
    enabled,
  })

  // Poll redundancy status while running
  const { data: redundancyState } = useQuery({
    queryKey: ['redundancy-status'],
    queryFn: () => getRedundancyStatus().then(r => r.data),
    enabled: polling,
    refetchInterval: (query) => {
      const s = query.state.data?.status
      if (s === 'done' || s === 'error') return false
      return 5000
    },
  })

  // Stop polling once done or errored
  useEffect(() => {
    if (redundancyState?.status === 'done' || redundancyState?.status === 'error') {
      setPolling(false)
    }
  }, [redundancyState?.status])

  const startMutation = useMutation({
    mutationFn: () => runRedundancyAnalysis().then(r => r.data),
    onSuccess: () => setPolling(true),
  })

  const isRunning = polling || startMutation.isPending || redundancyState?.status === 'running'
  const redundancyResults = redundancyState?.results || []
  const redundancyGroups = redundancyResults
    .slice()
    .sort((a, b) => (OVERLAP_ORDER[a.overlap_level] ?? 3) - (OVERLAP_ORDER[b.overlap_level] ?? 3))

  // ── Empty state ──────────────────────────────────────────────────────────────

  if (!enabled) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full">
        <Box size={40} className="text-slate-600 mb-3" />
        <p className="text-slate-400 font-display font-semibold">No mapping results yet</p>
        <p className="text-slate-500 text-sm mt-1">Run the mapping engine to see cost analysis.</p>
      </div>
    )
  }

  // ── Chart data ───────────────────────────────────────────────────────────────

  const top15 = (concentration || [])
    .slice(0, 15)
    .map(d => ({
      cap: d.capability.length > 30 ? d.capability.slice(0, 28) + '…' : d.capability,
      fullCap: d.capability,
      value_chain: d.value_chain,
      spend: +(d.total_spend / 1000).toFixed(1),
      total_spend: d.total_spend,
      app_count: d.app_count,
    }))

  const vcSpend = {}
  ;(concentration || []).forEach(d => {
    vcSpend[d.value_chain] = (vcSpend[d.value_chain] || 0) + d.total_spend
  })
  const top3VC = Object.entries(vcSpend)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-white">Cost Analysis</h1>
        <p className="text-slate-400 text-sm mt-1">Portfolio spend &amp; redundancy insights</p>
      </div>

      {/* ── Section 1: Cost Concentration ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-5 mb-6"
      >
        <h3 className="font-display font-semibold text-white text-sm mb-4 flex items-center gap-2">
          <DollarSign size={14} className="text-accent-light" />
          Cost Concentration — Top Capabilities by Spend
        </h3>

        {loadingConc && (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
            <Loader2 size={14} className="animate-spin" />
            Loading cost data…
          </div>
        )}

        {!loadingConc && top15.length === 0 && (
          <p className="text-slate-500 text-sm py-10 text-center">No cost data available.</p>
        )}

        {!loadingConc && top15.length > 0 && (
          <>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={top15} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252d40" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  tickFormatter={v => `$${v}K`}
                />
                <YAxis
                  dataKey="cap"
                  type="category"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  width={170}
                />
                <Tooltip content={<ConcTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                <Bar dataKey="spend" fill="#6366f1" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {top3VC.length > 0 && (
              <div className="mt-4 flex items-center gap-1 flex-wrap">
                <span className="text-xs text-slate-500 mr-2">Top value chains:</span>
                {top3VC.map(([vc, spend], i) => (
                  <span
                    key={vc}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{
                      background: i === 0 ? 'rgba(99,102,241,0.15)' : i === 1 ? 'rgba(45,212,191,0.12)' : 'rgba(245,158,11,0.12)',
                      color: i === 0 ? '#a5b4fc' : i === 1 ? '#2dd4bf' : '#fbbf24',
                      border: `1px solid ${i === 0 ? 'rgba(99,102,241,0.25)' : i === 1 ? 'rgba(45,212,191,0.2)' : 'rgba(245,158,11,0.2)'}`,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full inline-block"
                      style={{ background: i === 0 ? '#6366f1' : i === 1 ? '#2dd4bf' : '#f59e0b' }}
                    />
                    {vc}
                    <span className="opacity-70">{fmtCurrency(spend)}</span>
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* ── Section 2: Redundancy Analysis ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-display font-semibold text-white text-base flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-400" />
              Redundancy Analysis
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              AI identifies overlapping functions and suggests consolidation
            </p>
          </div>
          <button
            onClick={() => startMutation.mutate()}
            disabled={isRunning}
            className="accent-btn flex items-center gap-2 min-w-[160px] justify-center"
          >
            {isRunning ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Analyzing with AI…
              </>
            ) : redundancyState?.status === 'done' ? (
              <>
                <CheckCircle size={13} />
                Re-analyze
              </>
            ) : (
              <>
                <Zap size={13} />
                Analyze Redundancy
              </>
            )}
          </button>
        </div>

        {/* Progress hint while running */}
        {isRunning && (
          <div className="glass-card p-4 mt-4 flex items-center gap-3">
            <Loader2 size={16} className="animate-spin text-accent-light shrink-0" />
            <div>
              <p className="text-sm text-white font-medium">AI analysis in progress</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Qwen is analysing each capability group for functional overlap.
                This runs in the background — results will appear when complete.
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {redundancyState?.status === 'error' && (
          <div className="glass-card p-4 mt-4 border-rose-500/20">
            <p className="text-rose-400 text-sm">Analysis failed: {redundancyState.error}</p>
          </div>
        )}

        {/* Results */}
        {redundancyGroups.length > 0 && (
          <div className="space-y-4 mt-4">
            {redundancyGroups.map((group, i) => (
              <RedundancyCard key={`${group.capability}-${i}`} group={group} />
            ))}
          </div>
        )}

        {redundancyState?.status === 'done' && redundancyGroups.length === 0 && (
          <div className="glass-card p-6 mt-4 flex items-center justify-center">
            <p className="text-slate-400 text-sm">No redundancies detected in this portfolio.</p>
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ── Redundancy Card ───────────────────────────────────────────────────────────

function RedundancyCard({ group }) {
  const isMuted = group.overlap_level === 'low'

  const overlapBadge = {
    high: <span className="badge-weak">High Overlap</span>,
    medium: <span className="badge-medium">Medium Overlap</span>,
    low: <span className="badge-strong">Low Overlap</span>,
  }[group.overlap_level] ?? null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card overflow-hidden ${isMuted ? 'opacity-60' : ''}`}
      style={
        !isMuted
          ? { borderColor: group.overlap_level === 'high' ? 'rgba(244,63,94,0.18)' : 'rgba(245,158,11,0.15)' }
          : {}
      }
    >
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5">
        <span className="font-display font-bold text-white text-sm flex-1 min-w-0 truncate">
          {group.capability}
        </span>
        <VCPill label={group.value_chain} />
        {overlapBadge}
      </div>

      <div className="grid grid-cols-2 gap-0 divide-x divide-white/5">
        {/* Left: App list */}
        <div className="p-5">
          <p className="label mb-3">Applications ({group.apps?.length ?? 0})</p>
          <div className="space-y-2.5">
            {(group.apps || []).map(app => {
              const isKeep = app.name === group.keep_app
              const isRetire = group.replace_apps?.includes(app.name)
              return (
                <div
                  key={app.name}
                  className={`rounded-lg px-3 py-2.5 flex items-start gap-3 ${
                    isKeep
                      ? 'bg-emerald-950/30 border border-emerald-500/15'
                      : isRetire
                      ? 'bg-rose-950/20 border border-rose-500/12'
                      : 'bg-surface-2/60 border border-white/4'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">{app.name}</span>
                      {isKeep && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 shrink-0">
                          Keep
                        </span>
                      )}
                      {isRetire && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-400 shrink-0">
                          Retire
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{app.vendor}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono text-white">{fmtCurrency(app.cost)}</p>
                    {app.billing_cycle && (
                      <span className="text-[10px] text-slate-500 bg-surface-3 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                        {app.billing_cycle}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {group.total_capability_spend != null && (
            <div className="mt-3 pt-2.5 border-t border-white/5 flex justify-between items-center">
              <span className="text-xs text-slate-500">Total capability spend</span>
              <span className="text-xs font-mono text-white">{fmtCurrencyFull(group.total_capability_spend)}</span>
            </div>
          )}
        </div>

        {/* Right: AI recommendation */}
        <div className="p-5 flex flex-col">
          <p className="label mb-3">AI Recommendation</p>

          {group.overlap_reason && (
            <p className="text-xs text-slate-300 italic mb-3 leading-relaxed">
              Overlap: {group.overlap_reason}
            </p>
          )}

          {group.consolidation_suggestion && (
            <p className="text-xs text-slate-200 leading-relaxed flex-1">
              <span className="text-slate-400 not-italic">Recommendation: </span>
              {group.consolidation_suggestion}
            </p>
          )}

          {group.estimated_savings != null && (
            <div className="mt-4 rounded-lg px-4 py-2.5 bg-emerald-950/40 border border-emerald-500/20 flex items-center justify-between">
              <span className="text-xs text-emerald-400 font-medium">Estimated Savings</span>
              <span className="text-sm font-mono font-bold text-emerald-400">
                {fmtCurrencyFull(group.estimated_savings)}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function VCPill({ label }) {
  if (!label) return null
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0"
      style={{
        background: 'rgba(99,102,241,0.12)',
        color: '#a5b4fc',
        border: '1px solid rgba(99,102,241,0.2)',
      }}
    >
      {label}
    </span>
  )
}
