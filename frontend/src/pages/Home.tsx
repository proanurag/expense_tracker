import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { PieChart, Pie, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Package, Calendar, Upload, Plus, RefreshCw, AlertCircle, CheckCircle, IndianRupeeIcon, TrashIcon,Edit2  } from 'lucide-react'

import './Home.css'

type Expense = {
  id: string
  amount: number
  description: string
  type: string
  name: string
  date?: string | null
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)

const formatDate = (value?: string | null) => {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-IN')
}

const parseDate = (value?: string | null) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const Home = () => {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ amount: '', description: '', type: '', name: '', date: '' })
  const [file, setFile] = useState<File | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ amount: '', description: '', type: '', name: '', date: '' })
  const handleEditClick = (expense: Expense) => {
    setEditId(expense.id)
    setEditForm({
      amount: expense.amount.toString(),
      description: expense.description || '',
      type: expense.type,
      name: expense.name,
      date: expense.date ? expense.date.split('T')[0] : '',
    })
    setError(null)
    setStatusMessage(null)
  }

  const handleEditInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setEditForm(current => ({ ...current, [name]: value }))
  }

  const handleEditCancel = () => {
    setEditId(null)
    setEditForm({ amount: '', description: '', type: '', name: '', date: '' })
  }

  const handleEditSave = async (id: string) => {
    setError(null)
    setStatusMessage(null)
    await withLoader(async () => {
      const updatedData: any = {
        amount: parseFloat(editForm.amount),
        description: editForm.description,
        type: editForm.type,
        name: editForm.name,
      }
      if (editForm.date.trim()) {
        updatedData['date'] = editForm.date
      }
      const response = await fetch(`${API_BASE_URL}/expenses/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const detail = payload?.detail ?? response.statusText
        throw new Error(Array.isArray(detail) ? detail.join(', ') : detail)
      }
      setStatusMessage('Expense updated successfully.')
      setEditId(null)
      setEditForm({ amount: '', description: '', type: '', name: '', date: '' })
      await fetchExpenses()
    })
  }

  // Helper to show loader for async actions
  const withLoader = async (fn: () => Promise<void>) => {
    setLoading(true)
    try {
      await fn()
    } finally {
      setLoading(false)
    }
  }

  const { totals, byType, byVendor, timeline, topType } = useMemo(() => {
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0)
    const count = expenses.length
    const average = count ? total / count : 0

    const byType = expenses.reduce<Record<string, number>>((acc, expense) => {
      acc[expense.type] = (acc[expense.type] || 0) + expense.amount
      return acc
    }, {})

    const byVendor = expenses.reduce<Record<string, number>>((acc, expense) => {
      acc[expense.name] = (acc[expense.name] || 0) + expense.amount
      return acc
    }, {})

    const timelineMap = expenses.reduce<Record<string, { amount: number; details: Expense[] }>>((acc, expense) => {
      const date = parseDate(expense.date)
      if (date) {
        const key = date.toISOString().split('T')[0]
        if (!acc[key]) acc[key] = { amount: 0, details: [] }
        acc[key].amount += expense.amount
        acc[key].details.push(expense)
      }
      return acc
    }, {})

    const timeline = Object.entries(timelineMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { amount, details }]) => ({ date, amount, details }))

    const sortedByType = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }))

    return {
      totals: { total, count, average },
      byType: sortedByType,
      topType: sortedByType[0] ?? null,
      byVendor: Object.entries(byVendor)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, value]) => ({ name, value })),
      timeline: timeline.slice(-30),
    }
  }, [expenses])

  const renderTrendTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const { amount, details } = payload[0].payload as { amount: number; details: Expense[] }

    return (
      <div
        style={{
          backgroundColor: '#111827',
          border: '1px solid rgba(148, 163, 184, 0.18)',
          borderRadius: '12px',
          color: '#f8fafc',
          padding: '14px',
          minWidth: '240px',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{label}</p>
        <p style={{ margin: '6px 0 10px', fontSize: '0.85rem', color: '#94a3b8' }}>{formatCurrency(amount)} total</p>
        <div style={{ display: 'grid', gap: '8px' }}>
          {details.map(expense => (
            <div key={expense.id} style={{ borderTop: '1px solid rgba(148, 163, 184, 0.16)', paddingTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '0.85rem' }}>
                <span>{expense.type}</span>
                <strong>{formatCurrency(expense.amount)}</strong>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{expense.name}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const fetchExpenses = async () => {
    await withLoader(async () => {
      setError(null)
      const response = await fetch(`${API_BASE_URL}/expenses`)
      if (!response.ok) {
        throw new Error(`Unable to load expenses: ${response.statusText}`)
      }
      const data: Expense[] = await response.json()
      setExpenses(data)
    })
  }

  useEffect(() => {
    fetchExpenses()
  }, [])

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setForm(current => ({ ...current, [name]: value }))
  }

  const handleCreateExpense = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setStatusMessage(null)
    await withLoader(async () => {
      const formData: any = {}
      formData['amount'] = parseFloat(form.amount)
      formData['description'] = form.description
      formData['type'] = form.type
      formData['name'] = form.name
      if (form.date.trim()) {
        formData['date'] = form.date
      }
      const response = await fetch(`${API_BASE_URL}/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const detail = payload?.detail ?? response.statusText
        throw new Error(Array.isArray(detail) ? detail.join(', ') : detail)
      }
      setStatusMessage('Expense added successfully.')
      setForm({ amount: '', description: '', type: '', name: '', date: '' })
      await fetchExpenses()
    })
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null
    setFile(selectedFile)
    setStatusMessage(null)
  }

  const handleUploadFile = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setStatusMessage(null)
    if (!file) {
      setError('Select a CSV or Excel file before uploading.')
      return
    }
    await withLoader(async () => {
      const uploadData = new FormData()
      uploadData.append('file', file)
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: uploadData,
      })
      const payload = await response.json()
      if (!response.ok) {
        const detail = payload?.detail ?? response.statusText
        throw new Error(Array.isArray(detail) ? detail.join(', ') : detail)
      }
      setStatusMessage(`Upload complete: ${payload.inserted} records inserted.`)
      setFile(null)
      await fetchExpenses()
    })
  }

  const handleDeleteIcon = async (event: React.MouseEvent, id: any) => {
    event.preventDefault()
    setError(null)
    setStatusMessage(null)
    await withLoader(async () => {
      const response = await fetch(`${API_BASE_URL}/expenses/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const detail = payload?.detail ?? response.statusText
        throw new Error(Array.isArray(detail) ? detail.join(', ') : detail)
      }
      setStatusMessage('Expense deleted successfully.')
      await fetchExpenses()
    })
  }

  return (
    <main className="dashboard-shell">
      {loading && (
        <div className="loader-overlay">
          <div className="circular-loader"></div>
        </div>
      )}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-title">
            <div className="header-icon">
              <Package size={32} />
            </div>
            <div>
              <p className="eyebrow">Construction Expense Tracker</p>
              <h3>Expense Tracker</h3>
            </div>
          </div>
          <button className="refresh-button" onClick={fetchExpenses} title="Refresh data">
            <RefreshCw size={20} />
          </button>
        </div>
      </header>

      <section className="summary-grid">
        <article className="summary-card card-primary">
          <div className="card-icon">
            <IndianRupeeIcon size={28} />
          </div>
          <div className="card-content">
            <p>Total Spend</p>
            <strong>{formatCurrency(totals.total)}</strong>
          </div>
        </article>
        <article className="summary-card card-success">
          <div className="card-icon">
            <Package size={28} />
          </div>
          <div className="card-content">
            <p>Total Expenses</p>
            <strong>{totals.count}</strong>
          </div>
        </article>
        <article className="summary-card card-warning">
          <div className="card-icon">
            <IndianRupeeIcon size={28} />
          </div>
          <div className="card-content">
            <p>Loan Amount Used of 78 lakhs</p>
            {/* <strong>
              {formatCurrency(4260000)}
              <span> (Remaining: {formatCurrency(3540000)})</span>
            </strong> */}
            <strong>TBD</strong>
          </div>
        </article>
      </section>
      {topType && (
        <section className="top-type-strip">
          <div className="top-type-card">
            <div>
              <p className="top-type-label">Top expense type</p>
              <strong>{topType.name}</strong>
            </div>
            <span>{formatCurrency(topType.value)}</span>
          </div>
        </section>
      )}

      {timeline.length > 0 && (
        <section className="chart-panel">
          <div className="panel-header">
            <h2>Expense Trend</h2>
            <p>Last 30 days</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                content={renderTrendTooltip}
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      <div className="charts-row">
        {byType.length > 0 && (
          <section className="chart-panel">
            <div className="panel-header">
              <h2>By Type</h2>
              <p>{byType.length} expense types</p>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={byType}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {byType.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </section>
        )}

        {byVendor.length > 0 && (
          <section className="chart-panel">
            <div className="panel-header">
              <h2>Top Vendors</h2>
              <p>{byVendor.length} vendors</p>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byVendor}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" angle={-45} textAnchor="end" height={100} />
                <YAxis stroke="#6b7280" />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}
      </div>

      <section className="content-grid">
        <div className="panel form-panel">
          <div className="panel-header">
            <div className="header-icon-small">
              <Plus size={20} />
            </div>
            <div>
              <h2>Add Expense</h2>
              <p>Enter a single expense manually</p>
            </div>
          </div>
          <form onSubmit={handleCreateExpense} className="expense-form">
            <label>
              <span>Amount (₹)</span>
              <input
                name="amount"
                type="number"
                step="0.01"
                value={form.amount}
                onChange={handleInputChange}
                placeholder="0.00"
                required
              />
            </label>
            <label>
              <span>Date</span>
              <input
                name="date"
                type="date"
                value={form.date}
                onChange={handleInputChange}
              />
            </label>
            <label>
              <span>Type</span>
              <input
                name="type"
                type="text"
                value={form.type}
                onChange={handleInputChange}
                placeholder="e.g. Supplies, Labor"
                required
              />
            </label>
            <label>
              <span>Vendor / Payee</span>
              <input
                name="name"
                type="text"
                value={form.name}
                onChange={handleInputChange}
                placeholder="e.g. Acme Builders"
                required
              />
            </label>
            <label>
              <span>Notes</span>
              <textarea
                name="description"
                value={form.description}
                onChange={handleInputChange}
                placeholder="Optional details..."
              />
            </label>
            <button type="submit" className="btn-primary">
              <Plus size={18} /> Add Expense
            </button>
          </form>
        </div>

        <div className="panel upload-panel">
          <div className="panel-header">
            <div className="header-icon-small">
              <Upload size={20} />
            </div>
            <div>
              <h2>Bulk Upload</h2>
              <p>Import from CSV or Excel</p>
            </div>
          </div>
          <form onSubmit={handleUploadFile} className="upload-form">
            <div className="file-input-wrapper">
              <input
                type="file"
                id="file-input"
                accept=".csv, .xls, .xlsx"
                onChange={handleFileChange}
              />
              <label htmlFor="file-input" className="file-label">
                <Upload size={24} />
                <span>{file ? file.name : 'Click to upload file'}</span>
                <small>CSV, XLS, or XLSX</small>
              </label>
            </div>
            <button type="submit" className="btn-secondary" disabled={!file}>
              <Upload size={18} /> Upload
            </button>
          </form>
        </div>
      </section>

      {expenses.length > 0 && (
        <section className="panel table-panel">
          <div className="panel-header">
            <div>
              <h2>Recent Expenses</h2>
              <p>{expenses.length} total expenses</p>
            </div>
          </div>

          {loading ? (
            <p className="status-message">
              <span className="spinner"></span> Loading...
            </p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Type</th>
                    <th>Vendor</th>
                    <th>Description</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(expense => (
                    <tr key={expense.id}>
                      {editId === expense.id ? (
                        <>
                          <td>
                            <input
                              name="date"
                              type="date"
                              value={editForm.date}
                              onChange={handleEditInputChange}
                            />
                          </td>
                          <td>
                            <input
                              name="amount"
                              type="number"
                              step="0.01"
                              value={editForm.amount}
                              onChange={handleEditInputChange}
                              style={{ width: '90px' }}
                            />
                          </td>
                          <td>
                            <input
                              name="type"
                              type="text"
                              value={editForm.type}
                              onChange={handleEditInputChange}
                              style={{ width: '100px' }}
                            />
                          </td>
                          <td>
                            <input
                              name="name"
                              type="text"
                              value={editForm.name}
                              onChange={handleEditInputChange}
                              style={{ width: '120px' }}
                            />
                          </td>
                          <td>
                            <textarea
                              name="description"
                              value={editForm.description}
                              onChange={handleEditInputChange}
                              style={{ width: '120px', height: '28px' }}
                            />
                          </td>
                          <td style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn-secondary" style={{ padding: '2px 8px' }} onClick={() => handleEditSave(expense.id)} title="Save">Save</button>
                            <button className="btn-secondary" style={{ padding: '2px 8px' }} onClick={handleEditCancel} title="Cancel">Cancel</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>
                            <Calendar size={16} style={{ marginRight: '6px' }} />
                            {formatDate(expense.date)}
                          </td>
                          <td className="amount-cell">{formatCurrency(expense.amount)}</td>
                          <td>
                            <span className="badge">{expense.type}</span>
                          </td>
                          <td>{expense.name}</td>
                          <td>{expense.description || '—'}</td>
                          <td style={{ display: 'flex', gap: '8px' }}>
                            <span style={{ cursor: 'pointer' }} title="Edit" onClick={() => handleEditClick(expense)}>
                              <Edit2 size={18} />
                            </span>
                            <span style={{ cursor: 'pointer' }} title="Delete" onClick={(e) => handleDeleteIcon(e, expense.id)}>
                              <TrashIcon size={20} />
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}


      {error && (
        <div className="alert alert-error">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {statusMessage && (
        <div className="alert alert-success">
          <CheckCircle size={20} />
          <span>{statusMessage}</span>
        </div>
      )}
    </main>
  )
}

