import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 300000, // 5 min for long mapping runs
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const msg = err.response?.data?.detail || err.message || 'Unknown error'
    return Promise.reject(new Error(msg))
  }
)

// ── Upload ──────────────────────────────────────────────────────────────────

export const uploadCapabilities = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/upload/capabilities', fd)
}

export const uploadCMDB = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/upload/cmdb', fd)
}

export const getUploadStatus = () => api.get('/upload/status')

// ── Mapping ─────────────────────────────────────────────────────────────────

export const runMapping = () => api.post('/mapping/run')
export const getMappingStatus = () => api.get('/mapping/status')
export const getMappingResults = () => api.get('/mapping/results')
export const getResultsByCapability = () => api.get('/mapping/results/by-capability')

// ── Analytics ────────────────────────────────────────────────────────────────

export const getSummary = () => api.get('/analytics/summary')
export const getHeatmap = () => api.get('/analytics/heatmap')
export const getUnmapped = () => api.get('/analytics/unmapped')
export const getConfidenceDistribution = () => api.get('/analytics/confidence-distribution')

export const getCostConcentration = () => api.get('/analytics/cost-concentration')
export const runRedundancyAnalysis = () => api.post('/analytics/redundancy')
export const getRedundancyStatus = () => api.get('/analytics/redundancy/status')

// ── Export ───────────────────────────────────────────────────────────────────

export const downloadExcel = () => window.open('/api/export/excel', '_blank')
export const downloadCSV = () => window.open('/api/export/csv', '_blank')
export const downloadJSON = () => window.open('/api/export/json', '_blank')
