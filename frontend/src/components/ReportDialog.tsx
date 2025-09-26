import React, { useState } from 'react'
import api from '../lib/api'
import { format } from 'date-fns'

type Props = {
  open: boolean
  onClose: () => void
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function ReportDialog({ open, onClose }: Props) {
  const [mode, setMode] = useState<'today' | 'range'>('today')
  const [startDate, setStartDate] = useState<string>(todayISO())
  const [endDate, setEndDate] = useState<string>(todayISO())
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const downloadPDF = async () => {
    setLoading(true)
    try {
      const s = mode === 'today' ? todayISO() : startDate
      const e = mode === 'today' ? todayISO() : endDate
      // call backend: /reports/summary?start_date=...&end_date=...&format=pdf
      const resp = await api.raw().get('/reports/summary', {
        params: { start_date: s, end_date: e, format: 'pdf' },
        responseType: 'blob'
      })
      const blob = new Blob([resp.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `padel_report_${s}_${e}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      onClose()
    } catch (err) {
      console.error('report download failed', err)
      alert('Failed to generate report. Check console.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded shadow-lg w-full max-w-md p-6 z-10">
        <h3 className="text-lg font-semibold mb-4">Generate report (PDF)</h3>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2">
              <input type="radio" checked={mode === 'today'} onChange={() => setMode('today')} />
              <span>Today</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" checked={mode === 'range'} onChange={() => setMode('range')} />
              <span>Custom range</span>
            </label>
          </div>

          {mode === 'range' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm">Start</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="block text-sm">End</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 block w-full border rounded px-2 py-1" />
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-3 py-1 border rounded">Cancel</button>
          <button onClick={downloadPDF} disabled={loading} className="px-3 py-1 bg-blue-600 text-white rounded">
            {loading ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
