import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, ChevronDown, Server, Layers, Cpu, Search, Box } from 'lucide-react'
import { getResultsByCapability, getMappingStatus } from '../services/api'

export default function CapabilityTreePage() {
  const [search, setSearch] = useState('')
  const [expandedVCs, setExpandedVCs] = useState(new Set())
  const [expandedCaps, setExpandedCaps] = useState(new Set())

  const { data: status } = useQuery({
    queryKey: ['mapping-status'],
    queryFn: () => getMappingStatus().then(r => r.data),
  })

  const { data: treeData, isLoading } = useQuery({
    queryKey: ['tree-results'],
    queryFn: () => getResultsByCapability().then(r => r.data),
    enabled: status?.status === 'done',
  })

  const toggleVC = (vc) => {
    const s = new Set(expandedVCs)
    s.has(vc) ? s.delete(vc) : s.add(vc)
    setExpandedVCs(s)
  }

  const toggleCap = (key) => {
    const s = new Set(expandedCaps)
    s.has(key) ? s.delete(key) : s.add(key)
    setExpandedCaps(s)
  }

  const expandAll = () => {
    if (!treeData) return
    setExpandedVCs(new Set(treeData.map(v => v.value_chain)))
    const caps = new Set()
    treeData.forEach(v => v.capabilities.forEach(c => caps.add(`${v.value_chain}::${c.capability}`)))
    setExpandedCaps(caps)
  }

  const filtered = (treeData || []).filter(vc => {
    if (!search) return true
    const s = search.toLowerCase()
    return vc.value_chain.toLowerCase().includes(s) ||
      vc.capabilities.some(c =>
        c.capability.toLowerCase().includes(s) ||
        c.applications.some(a => a.application_name.toLowerCase().includes(s))
      )
  })

  if (status?.status !== 'done') {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full">
        <Box size={40} className="text-slate-600 mb-3" />
        <p className="text-slate-400 font-display font-semibold">No mapping results yet</p>
        <p className="text-slate-500 text-sm mt-1">Run the mapping engine first.</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Capability Tree</h1>
          <p className="text-slate-400 text-sm mt-1">Value Chain → Capability → Applications</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="bg-surface-2 border border-white/5 rounded-lg pl-8 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent/40 w-48"
            />
          </div>
          <button onClick={expandAll} className="ghost-btn text-xs">Expand All</button>
          <button onClick={() => { setExpandedVCs(new Set()); setExpandedCaps(new Set()) }} className="ghost-btn text-xs">Collapse All</button>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((vc, vi) => {
          const vcOpen = expandedVCs.has(vc.value_chain)
          const totalApps = vc.capabilities.reduce((s, c) => s + c.app_count, 0)
          return (
            <motion.div
              key={vc.value_chain}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: vi * 0.04 }}
              className="glass-card overflow-hidden"
            >
              {/* Value Chain header */}
              <button
                onClick={() => toggleVC(vc.value_chain)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/2 transition-colors"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br from-accent/30 to-teal-accent/20`}>
                  <Layers size={14} className="text-accent-light" />
                </div>
                <div className="flex-1">
                  <p className="font-display font-bold text-white">{vc.value_chain}</p>
                  <p className="text-xs text-slate-500">{vc.capabilities.length} capabilities • {totalApps} apps</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-accent/15 text-accent-light px-2 py-0.5 rounded-full font-mono">{totalApps}</span>
                  {vcOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                </div>
              </button>

              <AnimatePresence>
                {vcOpen && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden border-t border-white/5"
                  >
                    <div className="p-3 space-y-1.5 bg-surface/30">
                      {vc.capabilities.map((cap) => {
                        const capKey = `${vc.value_chain}::${cap.capability}`
                        const capOpen = expandedCaps.has(capKey)
                        return (
                          <div key={cap.capability} className="rounded-lg overflow-hidden bg-surface-2/50 border border-white/4">
                            <button
                              onClick={() => toggleCap(capKey)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/2 transition-colors"
                            >
                              <Cpu size={12} className="text-teal-accent shrink-0" />
                              <span className="flex-1 text-sm font-medium text-slate-200">{cap.capability}</span>
                              <span className="text-xs text-slate-500 font-mono mr-2">{cap.app_count} apps</span>
                              {capOpen ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronRight size={12} className="text-slate-500" />}
                            </button>

                            <AnimatePresence>
                              {capOpen && (
                                <motion.div
                                  initial={{ height: 0 }}
                                  animate={{ height: 'auto' }}
                                  exit={{ height: 0 }}
                                  className="overflow-hidden border-t border-white/4"
                                >
                                  <div className="p-3 space-y-1.5">
                                    {cap.applications.map((app) => (
                                      <AppLeaf key={app.application_name} app={app} />
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

function AppLeaf({ app }) {
  const [open, setOpen] = useState(false)
  const conf = Math.round(app.confidence * 100)
  const confColor = conf >= 80 ? 'text-emerald-400' : conf >= 60 ? 'text-amber-400' : 'text-slate-400'

  return (
    <div className="bg-surface-3/60 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/2 transition-colors"
      >
        <Server size={11} className="text-slate-500 shrink-0" />
        <span className="flex-1 text-xs text-slate-300">{app.application_name}</span>
        <span className="text-xs text-slate-500 mr-2">{app.vendor}</span>
        <span className={`text-xs font-mono ${confColor}`}>{conf}%</span>
        {open ? <ChevronDown size={11} className="text-slate-600" /> : <ChevronRight size={11} className="text-slate-600" />}
      </button>
      <AnimatePresence>
        {open && app.reasoning && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-8 pb-2">
              <p className="text-xs text-slate-400 italic leading-relaxed">{app.reasoning}</p>
              {app.enrichment_source && (
                <span className="text-xs text-slate-600 mt-1 block">Source: {app.enrichment_source}</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
