import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { PieChart, Pie, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Package, Calendar, Upload, Plus, RefreshCw, AlertCircle, CheckCircle, IndianRupeeIcon, TrashIcon, Edit2, X, Download } from 'lucide-react'

import './Home.css'

type Expense = {
  id: string
  amount: number
  description: string
  type: string
  name: string
  date?: string | null
}

type SanctionedAmount = {
  id: string
  amount: number
  sanction_date: string
  created_at: string
}

type ExpenseFilters = {
  search: string
  type: string
  vendor: string
  dateFrom: string
  dateTo: string
  amountMin: string
  amountMax: string
  sort: 'newest' | 'oldest' | 'amount-high' | 'amount-low'
}

const TOTAL_LOAN_AMOUNT = 7_800_000

const getToday = () => {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
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
  const [sanctionedAmounts, setSanctionedAmounts] = useState<SanctionedAmount[]>([])
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false)
  const [newSanctionedAmount, setNewSanctionedAmount] = useState('')
  const [newSanctionedDate, setNewSanctionedDate] = useState(getToday)
  const [sanctionedEditId, setSanctionedEditId] = useState<string | null>(null)
  const [sanctionedEditForm, setSanctionedEditForm] = useState({ amount: '', date: '' })
  const [filters, setFilters] = useState<ExpenseFilters>({ search: '', type: '', vendor: '', dateFrom: '', dateTo: '', amountMin: '', amountMax: '', sort: 'newest' })
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

  const fetchSanctionedAmounts = async () => {
    const response = await fetch(`${API_BASE_URL}/loan/sanctioned-amounts`)
    if (!response.ok) {
      throw new Error(`Unable to load sanctioned amounts: ${response.statusText}`)
    }
    setSanctionedAmounts(await response.json())
  }

  const handleSanctionedEditClick = (item: SanctionedAmount) => {
    setSanctionedEditId(item.id)
    setSanctionedEditForm({ amount: item.amount.toString(), date: item.sanction_date })
  }

  const handleSanctionedSave = async (id: string) => {
    setError(null)
    await withLoader(async () => {
      const response = await fetch(`${API_BASE_URL}/loan/sanctioned-amounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(sanctionedEditForm.amount), sanction_date: sanctionedEditForm.date }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.detail ?? response.statusText)
      setSanctionedEditId(null)
      setStatusMessage('Sanctioned amount updated successfully.')
      await fetchSanctionedAmounts()
    })
  }

  const handleSanctionedDelete = async (id: string) => {
    if (!window.confirm('Delete this sanctioned amount?')) return
    setError(null)
    await withLoader(async () => {
      const response = await fetch(`${API_BASE_URL}/loan/sanctioned-amounts/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Unable to delete sanctioned amount')
      setStatusMessage('Sanctioned amount deleted successfully.')
      await fetchSanctionedAmounts()
    })
  }

  useEffect(() => {
    fetchExpenses()
    fetchSanctionedAmounts().catch((reason: Error) => setError(reason.message))
  }, [])

  const totalSanctionedAmount = sanctionedAmounts.reduce((sum, item) => sum + item.amount, 0)
  const remainingLoanAmount = Math.max(TOTAL_LOAN_AMOUNT - totalSanctionedAmount, 0)
  const sortedSanctionedAmounts = useMemo(
    () => [...sanctionedAmounts].sort((first, second) => second.sanction_date.localeCompare(first.sanction_date)),
    [sanctionedAmounts],
  )

  const filteredExpenses = useMemo(() => {
    const search = filters.search.trim().toLowerCase()
    const amountMin = filters.amountMin ? Number(filters.amountMin) : null
    const amountMax = filters.amountMax ? Number(filters.amountMax) : null
    return expenses
      .filter(expense => {
        const expenseDate = expense.date?.slice(0, 10) ?? ''
        const searchable = `${expense.type} ${expense.name} ${expense.description}`.toLowerCase()
        return (!search || searchable.includes(search)) &&
          (!filters.type || expense.type === filters.type) &&
          (!filters.vendor || expense.name === filters.vendor) &&
          (!filters.dateFrom || expenseDate >= filters.dateFrom) &&
          (!filters.dateTo || expenseDate <= filters.dateTo) &&
          (amountMin === null || expense.amount >= amountMin) &&
          (amountMax === null || expense.amount <= amountMax)
      })
      .sort((a, b) => {
        if (filters.sort === 'amount-high') return b.amount - a.amount
        if (filters.sort === 'amount-low') return a.amount - b.amount
        const first = a.date ?? ''
        const second = b.date ?? ''
        return filters.sort === 'oldest' ? first.localeCompare(second) : second.localeCompare(first)
      })
  }, [expenses, filters])

  const filteredExpensesTotal = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)

  const handleExportExpenses = () => {
    const escapeCsvValue = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`
    const headers = ['Date', 'Amount', 'Type', 'Vendor', 'Description']
    const rows = filteredExpenses.map(expense => [
      formatDate(expense.date),
      expense.amount,
      expense.type,
      expense.name,
      expense.description || '',
    ])
    const csv = [headers, ...rows].map(row => row.map(escapeCsvValue).join(',')).join('\r\n')
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `construction-expenses-${getToday()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const expenseTypes = [...new Set(expenses.map(expense => expense.type))].sort()
  const expenseVendors = [...new Set(expenses.map(expense => expense.name))].sort()

  const handleSanctionedAmountSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setStatusMessage(null)
    await withLoader(async () => {
      const response = await fetch(`${API_BASE_URL}/loan/sanctioned-amounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(newSanctionedAmount), sanction_date: newSanctionedDate }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        const detail = payload?.detail ?? response.statusText
        throw new Error(Array.isArray(detail) ? detail.join(', ') : detail)
      }
      setNewSanctionedAmount('')
      setNewSanctionedDate(getToday())
      setStatusMessage('Sanctioned amount added successfully.')
      await fetchSanctionedAmounts()
    })
  }

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
          <button className="loan-summary-button" onClick={() => setIsLoanModalOpen(true)}>
            <span className="card-content">
              <span>Loan Amount Used of 78 lakhs</span>
              <strong>{formatCurrency(totalSanctionedAmount)}</strong>
              <small>{formatCurrency(remainingLoanAmount)} remaining</small>
            </span>
          </button>
        </article>
      </section>

      {isLoanModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setIsLoanModalOpen(false)}>
          <section className="loan-modal" role="dialog" aria-modal="true" aria-labelledby="loan-modal-title" onMouseDown={event => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Loan limit: {formatCurrency(TOTAL_LOAN_AMOUNT)}</p>
                <h2 id="loan-modal-title">Sanctioned amounts</h2>
              </div>
              <button className="modal-close" onClick={() => setIsLoanModalOpen(false)} title="Close">
                <X size={20} />
              </button>
            </div>
            <form className="sanctioned-form" onSubmit={handleSanctionedAmountSubmit}>
              <label>
                <span>New sanctioned amount (₹)</span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={newSanctionedAmount}
                  onChange={event => setNewSanctionedAmount(event.target.value)}
                  placeholder="0.00"
                  required
                />
              </label>
              <label>
                <span>Sanction date</span>
                <input
                  type="date"
                  value={newSanctionedDate}
                  onChange={event => setNewSanctionedDate(event.target.value)}
                  required
                />
              </label>
              <button type="submit" className="btn-primary">Add amount</button>
            </form>
            <div className="loan-balance">
              <span>Remaining loan amount</span>
              <strong>{formatCurrency(remainingLoanAmount)}</strong>
            </div>
            <div className="sanctioned-history">
              <h3>Previous sanctioned amounts</h3>
              {sanctionedAmounts.length === 0 ? (
                <p className="empty-state">No sanctioned amounts added yet.</p>
              ) : (
                <ul>
                  {sortedSanctionedAmounts.map(item => (
                    <li key={item.id}>
                      {sanctionedEditId === item.id ? (
                        <div className="sanctioned-edit-row">
                          <input type="number" min="1" step="0.01" value={sanctionedEditForm.amount} onChange={event => setSanctionedEditForm(current => ({ ...current, amount: event.target.value }))} />
                          <input type="date" value={sanctionedEditForm.date} onChange={event => setSanctionedEditForm(current => ({ ...current, date: event.target.value }))} />
                          <button className="icon-action" onClick={() => handleSanctionedSave(item.id)} title="Save">Save</button>
                          <button className="icon-action" onClick={() => setSanctionedEditId(null)} title="Cancel">Cancel</button>
                        </div>
                      ) : (
                        <>
                          <span>{formatCurrency(item.amount)}</span>
                          <small>{formatDate(item.sanction_date)}</small>
                          <span className="sanctioned-actions">
                            <button className="icon-action" onClick={() => handleSanctionedEditClick(item)} title="Edit sanctioned amount"><Edit2 size={16} /></button>
                            <button className="icon-action danger-action" onClick={() => handleSanctionedDelete(item.id)} title="Delete sanctioned amount"><TrashIcon size={16} /></button>
                          </span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
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
          <div className="panel-header table-panel-header">
            <div>
              <h2>Recent Expenses</h2>
              <p>
                Showing {filteredExpenses.length} of {expenses.length} expenses
                <span className="filtered-total">Total: {formatCurrency(filteredExpensesTotal)}</span>
              </p>
            </div>
            <button className="btn-secondary export-button" onClick={handleExportExpenses} disabled={!filteredExpenses.length} title="Export filtered expenses for Excel">
              <Download size={17} /> Export Excel
            </button>
          </div>

          <div className="expense-filters">
            <input placeholder="Search vendor, type, notes..." value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))} />
            <select value={filters.type} onChange={event => setFilters(current => ({ ...current, type: event.target.value }))}>
              <option value="">All types</option>
              {expenseTypes.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
            <select value={filters.vendor} onChange={event => setFilters(current => ({ ...current, vendor: event.target.value }))}>
              <option value="">All vendors</option>
              {expenseVendors.map(vendor => <option key={vendor} value={vendor}>{vendor}</option>)}
            </select>
            <input type="date" value={filters.dateFrom} onChange={event => setFilters(current => ({ ...current, dateFrom: event.target.value }))} title="From date" />
            <input type="date" value={filters.dateTo} onChange={event => setFilters(current => ({ ...current, dateTo: event.target.value }))} title="To date" />
            <input type="number" min="0" placeholder="Min amount" value={filters.amountMin} onChange={event => setFilters(current => ({ ...current, amountMin: event.target.value }))} />
            <input type="number" min="0" placeholder="Max amount" value={filters.amountMax} onChange={event => setFilters(current => ({ ...current, amountMax: event.target.value }))} />
            <select value={filters.sort} onChange={event => setFilters(current => ({ ...current, sort: event.target.value as ExpenseFilters['sort'] }))}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="amount-high">Amount: high to low</option>
              <option value="amount-low">Amount: low to high</option>
            </select>
            <button className="btn-secondary filter-reset" onClick={() => setFilters({ search: '', type: '', vendor: '', dateFrom: '', dateTo: '', amountMin: '', amountMax: '', sort: 'newest' })}>Reset filters</button>
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
                  {filteredExpenses.map(expense => (
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
              {filteredExpenses.length === 0 && <p className="empty-state table-empty">No expenses match the selected filters.</p>}
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

