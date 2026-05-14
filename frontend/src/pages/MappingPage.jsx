import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Play, Loader2, CheckCircle2, AlertCircle, Download, Search, Filter, ChevronDown, ChevronRight, Info } from 'lucide-react'
import { runMapping, getMappingStatus, getMappingResults, downloadExcel, downloadCSV, downloadJSON, getUploadStatus } from '../services/api'

export default function MappingPage() {
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [expandedApp, setExpandedApp] = useState(null)
  const pollRef = useRef(null)

  const { data: uploadStatus } = useQuery({
    queryKey: ['upload-status'],
    queryFn: () => getUploadStatus().then(r => r.data),
  })

  const { data: mappingStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['mapping-status'],
    queryFn: () => getMappingStatus().then(r => r.data),
    refetchInterval: 2000,
  })

  const { data: results, refetch: refetchResults } = useQuery({
    queryKey: ['mapping-results'],
    queryFn: () => getMappingResults().then(r => r.data),
    enabled: mappingStatus?.status === 'done',
  })

  const runMutation = useMutation({
    mutationFn: () => runMapping(),
    onSuccess: () => refetchStatus(),
  })

  const isRunning = mappingStatus?.status === 'running'
  const isDone = mappingStatus?.status === 'done'
  const isError = mappingStatus?.status === 'error'

  const progress = mappingStatus?.total
    ? Math.round((mappingStatus.progress / mappingStatus.total) * 100)
    : 0

  const allResults = results?.results || []

  const filtered = allResults.filter(r => {
    const matchSearch = !search ||
      r.application_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.vendor?.toLowerCase().includes(search.toLowerCase())
    const matchTier = tierFilter === 'all' || r.match_tier === tierFilter
    return matchSearch && matchTier
  })

  const canRun = uploadStatus?.capabilities_loaded && uploadStatus?.cmdb_loaded && !isRunning

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">AI Mapping Engine</h1>
          <p className="text-slate-400 text-sm mt-1">
            Semantic + contextual matching powered by Qwen2.5
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {isDone && (
            <>
              <button onClick={downloadCSV} className="ghost-btn flex items-center gap-2">
                <Download size={13} /> CSV
              </button>
              <button onClick={downloadJSON} className="ghost-btn flex items-center gap-2">
                <Download size={13} /> JSON
              </button>
              <button onClick={downloadExcel} className="accent-btn flex items-center gap-2">
                <Download size={13} /> Excel
              </button>
            </>
          )}
          <button
            onClick={() => runMutation.mutate()}
            disabled={!canRun}
            className="accent-btn flex items-center gap-2 min-w-[130px] justify-center"
          >
            {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {isRunning ? 'Running...' : 'Run Mapping'}
          </button>
        </div>
      </div>

      {/* Progress */}
      <AnimatePresence>
        {(isRunning || isDone || isError) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass-card p-4 mb-6"
          >
            <div className="flex items-center gap-3 mb-2">
              {isRunning && <Loader2 size={14} className="text-accent animate-spin" />}
              {isDone && <CheckCircle2 size={14} className="text-emerald-400" />}
              {isError && <AlertCircle size={14} className="text-rose-400" />}
              <span className="text-sm font-medium text-white">
                {isRunning && `Mapping ${mappingStatus?.progress || 0} / ${mappingStatus?.total || 0} applications...`}
                {isDone && `Mapping complete — ${allResults.length} applications processed`}
                {isError && `Error: ${mappingStatus?.error}`}
              </span>
              {isRunning && <span className="ml-auto font-mono text-xs text-accent">{progress}%</span>}
            </div>
            {isRunning && (
              <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-accent to-teal-accent"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pre-run checklist */}
      {!isDone && !isRunning && (
        <div className="glass-card p-5 mb-6">
          <h3 className="font-display font-semibold text-white text-sm mb-3">Pre-flight Checklist</h3>
          <div className="space-y-2">
            <CheckItem label="Capability Model uploaded" ok={uploadStatus?.capabilities_loaded} sub={`${uploadStatus?.capabilities_count || 0} capabilities`} />
            <CheckItem label="Client CMDB uploaded" ok={uploadStatus?.cmdb_loaded} sub={`${uploadStatus?.cmdb_count || 0} applications`} />
            <CheckItem label="Synthetic Reference DB loaded" ok={true} sub="41 enterprise apps" />
            <CheckItem label="Ollama + Qwen2.5 (recommended)" ok={null} sub="Falls back to heuristic if unavailable" />
          </div>
        </div>
      )}

      {/* Results */}
      {isDone && allResults.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search applications..."
                className="w-full bg-surface-2 border border-white/5 rounded-lg pl-8 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent/40"
              />
            </div>
            <select
              value={tierFilter}
              onChange={e => setTierFilter(e.target.value)}
              className="bg-surface-2 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            >
              <option value="all">All Tiers</option>
              <option value="strong">Strong Match</option>
              <option value="medium">Medium Match</option>
              <option value="weak">Weak Match</option>
            </select>
            <span className="text-slate-500 text-sm">{filtered.length} results</span>
          </div>

          {/* Results table */}
          <div className="space-y-2">
            {filtered.map((r, i) => (
              <AppResultRow
                key={r.application_name}
                result={r}
                index={i}
                expanded={expandedApp === r.application_name}
                onToggle={() => setExpandedApp(expandedApp === r.application_name ? null : r.application_name)}
              />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}

function AppResultRow({ result, index, expanded, onToggle }) {
  const caps = result.mapped_capabilities || []
  const topCap = caps[0]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className={`glass-card overflow-hidden transition-all ${expanded ? 'border-accent/20' : ''}`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/2 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-display font-semibold text-white text-sm truncate">{result.application_name}</span>
            <TierBadge tier={result.match_tier} />
          </div>
          <p className="text-slate-500 text-xs truncate">{result.vendor} • {result.enrichment_source}</p>
        </div>

        {topCap && (
          <div className="text-right shrink-0">
            <p className="text-xs text-slate-300 truncate max-w-[200px]">{topCap.capability}</p>
            <ConfidenceBar value={topCap.confidence} />
          </div>
        )}

        {!caps.length && (
          <span className="text-xs text-rose-400 bg-rose-accent/10 px-2 py-0.5 rounded">Unmapped</span>
        )}

        <div className="text-slate-600">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="p-4 space-y-4">
              {/* Meta */}
              <div className="grid grid-cols-3 gap-4">
                <MetaField label="Semantic Score" value={(result.semantic_score * 100).toFixed(0) + '%'} />
                <MetaField label="Context Score" value={(result.context_score * 100).toFixed(0) + '%'} />
                <MetaField label="Reference App" value={result.reference_app || '—'} />
              </div>

              {/* Description */}
              {result.cmdb_description && (
                <div>
                  <p className="label mb-1">CMDB Description</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{result.cmdb_description}</p>
                </div>
              )}

              {/* Capabilities */}
              {caps.length > 0 && (
                <div>
                  <p className="label mb-2">Mapped Capabilities</p>
                  <div className="space-y-2">
                    {caps.map((mc, i) => (
                      <div key={i} className="bg-surface-3 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-white">{mc.capability}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-accent">{(mc.confidence * 100).toFixed(0)}%</span>
                            <span className="text-xs text-slate-500">{mc.value_chain}</span>
                          </div>
                        </div>
                        {mc.reasoning && (
                          <p className="text-xs text-slate-400 italic">{mc.reasoning}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function TierBadge({ tier }) {
  if (tier === 'strong') return <span className="badge-strong">Strong</span>
  if (tier === 'medium') return <span className="badge-medium">Medium</span>
  return <span className="badge-weak">Weak</span>
}

function ConfidenceBar({ value }) {
  const pct = Math.round(value * 100)
  const color = value >= 0.8 ? 'bg-emerald-400' : value >= 0.6 ? 'bg-amber-400' : 'bg-slate-500'
  return (
    <div className="flex items-center gap-2 mt-0.5">
      <div className="w-20 h-1 bg-surface-3 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-400">{pct}%</span>
    </div>
  )
}

function MetaField({ label, value }) {
  return (
    <div>
      <p className="label mb-0.5">{label}</p>
      <p className="text-xs text-slate-300 font-mono">{value}</p>
    </div>
  )
}

function CheckItem({ label, ok, sub }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${ok === true ? 'bg-emerald-accent/20' : ok === false ? 'bg-rose-accent/20' : 'bg-surface-3'}`}>
        {ok === true && <CheckCircle2 size={10} className="text-emerald-400" />}
        {ok === false && <AlertCircle size={10} className="text-rose-400" />}
        {ok === null && <Info size={10} className="text-slate-500" />}
      </div>
      <div>
        <p className="text-sm text-white">{label}</p>
        <p className="text-xs text-slate-500">{sub}</p>
      </div>
    </div>
  )
}
