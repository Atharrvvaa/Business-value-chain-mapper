import React from 'react'
import { motion } from 'framer-motion'
import { 
  Upload, Network, BarChart3, GitBranch, Cpu, Layers
} from 'lucide-react'

const NAV = [
  { id: 'upload', label: 'Upload Data', icon: Upload },
  { id: 'mapping', label: 'Run Mapping', icon: Cpu },
  { id: 'tree', label: 'Capability Tree', icon: GitBranch },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
]

export default function Sidebar({ currentPage, onNavigate }) {
  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-surface-1 border-r border-white/5">
      {/* Logo */}
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-teal-accent flex items-center justify-center">
            <Layers size={14} className="text-white" />
          </div>
          <div>
            <p className="font-display font-bold text-white text-sm leading-none">CapMap</p>
            <p className="text-slate-500 text-[10px] mt-0.5 font-mono">Phase 2</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = currentPage === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className="w-full text-left"
            >
              <div className={`
                relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-150 group
                ${active
                  ? 'text-white bg-accent/15 border border-accent/20'
                  : 'text-slate-400 hover:text-white hover:bg-surface-2'
                }
              `}>
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent rounded-full"
                  />
                )}
                <Icon size={15} className={active ? 'text-accent-light' : 'text-slate-500 group-hover:text-slate-300'} />
                {label}
              </div>
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/5">
        <p className="text-slate-600 text-[10px] font-mono">v2.0.0 • Qwen2.5</p>
      </div>
    </aside>
  )
}
