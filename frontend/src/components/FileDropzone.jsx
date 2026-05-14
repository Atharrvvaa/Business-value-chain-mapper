import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react'

export default function FileDropzone({ label, description, onUpload, accept = '.xlsx,.xls,.csv' }) {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle') // idle | uploading | success | error
  const [message, setMessage] = useState('')

  const onDrop = useCallback(async (accepted) => {
    if (!accepted.length) return
    const f = accepted[0]
    setFile(f)
    setStatus('uploading')
    setMessage('')
    try {
      const res = await onUpload(f)
      setStatus('success')
      setMessage(res.data?.message || 'Uploaded successfully.')
    } catch (err) {
      setStatus('error')
      setMessage(err.message || 'Upload failed.')
    }
  }, [onUpload])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  })

  const reset = (e) => {
    e.stopPropagation()
    setFile(null)
    setStatus('idle')
    setMessage('')
  }

  const borderColor = isDragActive
    ? 'border-accent'
    : status === 'success'
    ? 'border-emerald-400/40'
    : status === 'error'
    ? 'border-rose-400/40'
    : 'border-white/8 hover:border-accent/30'

  return (
    <div
      {...getRootProps()}
      className={`
        relative border-2 border-dashed rounded-xl p-6 cursor-pointer
        transition-all duration-200 bg-surface-2/50
        ${borderColor}
        ${isDragActive ? 'bg-accent/5' : ''}
      `}
    >
      <input {...getInputProps()} />

      <div className="flex flex-col items-center text-center gap-3">
        {/* Icon */}
        <div className={`
          w-12 h-12 rounded-xl flex items-center justify-center
          ${status === 'success' ? 'bg-emerald-accent/10' : status === 'error' ? 'bg-rose-accent/10' : 'bg-surface-3'}
        `}>
          {status === 'uploading' ? (
            <Loader2 size={22} className="text-accent animate-spin" />
          ) : status === 'success' ? (
            <CheckCircle2 size={22} className="text-emerald-400" />
          ) : status === 'error' ? (
            <AlertCircle size={22} className="text-rose-400" />
          ) : (
            <FileSpreadsheet size={22} className="text-slate-400" />
          )}
        </div>

        {/* Text */}
        <div>
          <p className="font-display font-semibold text-white text-sm">{label}</p>
          <p className="text-slate-500 text-xs mt-0.5">{description}</p>
        </div>

        {/* File name / status */}
        <AnimatePresence mode="wait">
          {file && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono
                ${status === 'success' ? 'bg-emerald-accent/10 text-emerald-400' 
                  : status === 'error' ? 'bg-rose-accent/10 text-rose-400'
                  : 'bg-surface-3 text-slate-300'}
              `}
            >
              <span className="truncate max-w-[180px]">{file.name}</span>
              {status !== 'uploading' && (
                <button onClick={reset} className="shrink-0 hover:opacity-70">
                  <X size={12} />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {message && (
          <p className={`text-xs ${status === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>
            {message}
          </p>
        )}

        {!file && (
          <p className="text-slate-600 text-xs">
            Drop {accept} here or <span className="text-accent">click to browse</span>
          </p>
        )}
      </div>
    </div>
  )
}
