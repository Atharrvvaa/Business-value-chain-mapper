import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, Database, CheckCircle2, ArrowRight } from 'lucide-react'
import FileDropzone from '../components/FileDropzone'
import { uploadCapabilities, uploadCMDB, getUploadStatus } from '../services/api'

const STAGGER = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } }
const ITEM = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }

export default function UploadPage() {
  const { data: status, refetch } = useQuery({
    queryKey: ['upload-status'],
    queryFn: () => getUploadStatus().then(r => r.data),
    refetchInterval: 3000,
  })

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div variants={STAGGER} initial="hidden" animate="show" className="mb-8">
        <motion.div variants={ITEM}>
          <span className="text-xs font-mono text-accent bg-accent/10 px-2 py-1 rounded-full">
            Phase 2 • Enterprise Mapper
          </span>
        </motion.div>
        <motion.h1 variants={ITEM} className="font-display text-3xl font-bold text-white mt-3">
          Upload Your Data Files
        </motion.h1>
        <motion.p variants={ITEM} className="text-slate-400 mt-1.5 text-sm max-w-lg">
          Upload your Capability Model and CMDB to begin AI-powered semantic mapping. 
          Our synthetic reference database loads automatically.
        </motion.p>
      </motion.div>

      {/* Status bar */}
      {status && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-4 mb-6 flex items-center gap-6"
        >
          <StatusPill label="Capability Model" ok={status.capabilities_loaded} count={status.capabilities_count} unit="capabilities" />
          <div className="w-px h-8 bg-white/5" />
          <StatusPill label="Client CMDB" ok={status.cmdb_loaded} count={status.cmdb_count} unit="applications" />
          <div className="w-px h-8 bg-white/5" />
          <StatusPill label="Reference DB" ok={true} count={41} unit="synthetic apps" />
        </motion.div>
      )}

      {/* Upload zones */}
      <motion.div variants={STAGGER} initial="hidden" animate="show" className="grid grid-cols-2 gap-5">
        <motion.div variants={ITEM}>
          <div className="mb-3">
            <h3 className="font-display font-semibold text-white text-sm">Capability Model</h3>
            <p className="text-slate-500 text-xs mt-0.5">CapabilityModel.xlsx</p>
          </div>
          <FileDropzone
            label="Drop CapabilityModel.xlsx"
            description="Required columns: level_1_value_chain, level_2_capability"
            onUpload={async (f) => { const r = await uploadCapabilities(f); refetch(); return r }}
          />
          <div className="mt-3 glass-card p-3">
            <p className="label mb-2">Expected columns</p>
            <div className="space-y-1">
              {['level_1_value_chain', 'level_2_capability'].map(c => (
                <p key={c} className="text-xs font-mono text-teal-accent/80">• {c}</p>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div variants={ITEM}>
          <div className="mb-3">
            <h3 className="font-display font-semibold text-white text-sm">Client CMDB</h3>
            <p className="text-slate-500 text-xs mt-0.5">ClientCMDB.xlsx</p>
          </div>
          <FileDropzone
            label="Drop ClientCMDB.xlsx"
            description="Required: application_name, vendor, description"
            onUpload={async (f) => { const r = await uploadCMDB(f); refetch(); return r }}
          />
          <div className="mt-3 glass-card p-3">
            <p className="label mb-2">Expected columns</p>
            <div className="space-y-1">
              {['application_name', 'vendor', 'description', 'business_owner', 'product_name'].map(c => (
                <p key={c} className="text-xs font-mono text-teal-accent/80">• {c}</p>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Architecture info */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-8 glass-card p-5"
      >
        <h3 className="font-display font-semibold text-white text-sm mb-4 flex items-center gap-2">
          <Database size={14} className="text-accent" />
          Matching Architecture (Semantic-First)
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { label: 'CMDB Input', color: 'text-slate-300' },
            'arrow',
            { label: 'Text Cleaning', color: 'text-slate-300' },
            'arrow',
            { label: 'Semantic Embedding', color: 'text-accent-light', weight: true },
            'arrow',
            { label: 'Context Matching', color: 'text-teal-accent' },
            'arrow',
            { label: 'Fuzzy Name (15%)', color: 'text-slate-400' },
            'arrow',
            { label: 'AI Mapping (Qwen2.5)', color: 'text-amber-400' },
          ].map((item, i) =>
            item === 'arrow'
              ? <ArrowRight key={i} size={12} className="text-slate-600" />
              : <span key={i} className={`text-xs font-mono px-2 py-1 bg-surface-2 rounded ${item.color} ${item.weight ? 'font-semibold' : ''}`}>{item.label}</span>
          )}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <ScoreBar label="Semantic Score" value="50%" color="bg-accent" />
          <ScoreBar label="Context Score" value="35%" color="bg-teal-accent" />
          <ScoreBar label="Fuzzy Name" value="15%" color="bg-slate-500" />
        </div>
      </motion.div>
    </div>
  )
}

function StatusPill({ label, ok, count, unit }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-slate-600'}`} />
      <div>
        <p className="text-xs font-medium text-white">{label}</p>
        <p className="text-xs text-slate-500">{ok ? `${count} ${unit}` : 'Not uploaded'}</p>
      </div>
    </div>
  )
}

function ScoreBar({ label, value, color }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-xs font-mono text-slate-300">{value}</span>
      </div>
      <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: value }} />
      </div>
    </div>
  )
}
