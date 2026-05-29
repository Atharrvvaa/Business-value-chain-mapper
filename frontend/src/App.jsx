import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Sidebar from './components/Sidebar'
import UploadPage from './pages/UploadPage'
import MappingPage from './pages/MappingPage'
import AnalyticsPage from './pages/AnalyticsPage'
import CapabilityTreePage from './pages/CapabilityTreePage'
import CostAnalysisPage from './pages/CostAnalysisPage'

const PAGES = {
  upload: UploadPage,
  mapping: MappingPage,
  analytics: AnalyticsPage,
  tree: CapabilityTreePage,
  costs: CostAnalysisPage,
}

export default function App() {
  const [page, setPage] = useState('upload')
  const PageComponent = PAGES[page] || UploadPage

  return (
    <div className="flex h-screen bg-surface overflow-hidden bg-grid">
      <Sidebar currentPage={page} onNavigate={setPage} />
      <main className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="h-full"
          >
            <PageComponent />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
