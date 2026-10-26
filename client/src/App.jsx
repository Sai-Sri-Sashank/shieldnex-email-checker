import { useState, useMemo, useCallback } from 'react'
import './App.css'

// ─── constants ────────────────────────────────────────────────────────────────

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.origin !== 'null'
    ? window.location.origin
    : 'http://localhost:4000')

const SAMPLE_EMAILS = [
  'alice@gmail.com',
  'bob@yahoo.com',
  'carol@outlook.com',
  'notavalidemail',
  'test@nonexistent-domain-xyz123.com',
  'info@mailinator.com',
  'support@github.com',
  'user@@double-at.com',
  'missing-tld@nodot',
  'dev@microsoft.com',
]

const STATUS_LABELS = {
  all: 'All',
  'likely delivered': 'Likely Delivered',
  'likely bounce': 'Likely Bounce',
  unknown: 'Unknown',
}

const STATUS_COLORS = {
  'likely delivered': 'status-delivered',
  'likely bounce': 'status-bounce',
  unknown: 'status-unknown',
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function parseEmailInput(raw) {
  return raw
    .split(/[\n,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function downloadCSV(results) {
  const header = ['Email', 'Syntax Valid', 'Mail Server', 'Status', 'Explanation']
  const rows = results.map((r) => [
    r.email,
    r.syntaxValid ? 'Yes' : 'No',
    r.mxRecords && r.mxRecords.length ? r.mxRecords[0] : '—',
    r.classification,
    r.explanation,
  ])
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'shieldnex-results.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ label, value, variant }) {
  return (
    <div className={`summary-card ${variant}`}>
      <span className="summary-value">{value}</span>
      <span className="summary-label">{label}</span>
    </div>
  )
}

function StatusBadge({ status }) {
  return (
    <span className={`badge ${STATUS_COLORS[status] || 'status-unknown'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

function ResultsTable({ results }) {
  if (!results.length) {
    return <p className="no-results">No results match your filter.</p>
  }
  return (
    <div className="table-wrapper">
      <table className="results-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Syntax</th>
            <th>Mail Server</th>
            <th>Status</th>
            <th>Explanation</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={i}>
              <td className="email-cell">{r.email}</td>
              <td className="center-cell">
                {r.syntaxValid ? (
                  <span className="icon-ok" aria-label="Valid">✓</span>
                ) : (
                  <span className="icon-err" aria-label="Invalid">✗</span>
                )}
              </td>
              <td className="mx-cell">
                {r.mxRecords && r.mxRecords.length ? r.mxRecords[0] : '—'}
              </td>
              <td>
                <StatusBadge status={r.classification} />
              </td>
              <td className="explanation-cell">{r.explanation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── main app ─────────────────────────────────────────────────────────────────

export default function App() {
  const [inputValue, setInputValue] = useState('')
  const [results, setResults] = useState(null)       // null = no check yet
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // ── derived stats ──
  const stats = useMemo(() => {
    if (!results) return { total: 0, delivered: 0, bounce: 0, unknown: 0 }
    return {
      total: results.length,
      delivered: results.filter((r) => r.classification === 'likely delivered').length,
      bounce: results.filter((r) => r.classification === 'likely bounce').length,
      unknown: results.filter((r) => r.classification === 'unknown').length,
    }
  }, [results])

  // ── filtered results ──
  const filtered = useMemo(() => {
    if (!results) return []
    return results.filter((r) => {
      const matchStatus = statusFilter === 'all' || r.classification === statusFilter
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        r.email.toLowerCase().includes(q) ||
        r.explanation.toLowerCase().includes(q) ||
        (r.mxRecords && r.mxRecords.some((mx) => mx.toLowerCase().includes(q)))
      return matchStatus && matchSearch
    })
  }, [results, search, statusFilter])

  // ── handlers ──
  const handleCheck = useCallback(async () => {
    const emails = parseEmailInput(inputValue)
    if (!emails.length) {
      setError('Please enter at least one email address.')
      return
    }
    if (emails.length > 100) {
      setError('Please enter no more than 100 email addresses at a time.')
      return
    }
    setLoading(true)
    setError(null)
    setResults(null)
    setSearch('')
    setStatusFilter('all')
    try {
      const res = await fetch(`${API_BASE}/api/check-emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || `Server error ${res.status}`)
      }
      setResults(data.results)
    } catch (err) {
      setError(`Failed to reach the API: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [inputValue])

  const handleLoadSample = useCallback(() => {
    setInputValue(SAMPLE_EMAILS.join('\n'))
    setResults(null)
    setError(null)
  }, [])

  const handleClear = useCallback(() => {
    setInputValue('')
    setResults(null)
    setError(null)
    setSearch('')
    setStatusFilter('all')
  }, [])

  // ── render ──
  return (
    <div className="app">
      {/* Header */}
      <header className="site-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon" aria-hidden="true">✉️</span>
            <span className="logo-text">ShieldNex Email Checker</span>
          </div>
          <span className="header-tag">Email Deliverability</span>
        </div>
      </header>

      <main className="main">
        {/* Hero */}
        <section className="hero">
          <h1>Know your email list before you send.</h1>
          <p className="hero-desc">
            Paste your email list below and ShieldNex will validate syntax and
            check DNS mail-routing records for each address — giving you an
            instant deliverability estimate.
          </p>
          <p className="hero-disclaimer">
            ⚠️ Results are estimates only. Actual delivery depends on many
            factors including recipient mailbox rules, anti-spam filters, and
            sending reputation. No emails are sent during verification.
          </p>
        </section>

        {/* Input card */}
        <section className="input-card">
          <label className="input-label" htmlFor="email-input">
            Email addresses
            <span className="input-hint">
              Separate by newlines, commas, semicolons, or spaces. Max 100.
            </span>
          </label>
          <textarea
            id="email-input"
            className="email-textarea"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="alice@example.com&#10;bob@company.org&#10;carol@domain.net"
            rows={8}
            aria-label="Email addresses"
          />
          <div className="button-row">
            <button
              className="btn btn-primary"
              onClick={handleCheck}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Checking…
                </>
              ) : (
                '✓ Check Emails'
              )}
            </button>
            <button className="btn btn-secondary" onClick={handleLoadSample} disabled={loading}>
              Load Sample
            </button>
            <button className="btn btn-ghost" onClick={handleClear} disabled={loading}>
              Clear
            </button>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="alert-error" role="alert">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="loading-state" aria-live="polite">
            <span className="spinner-lg" aria-hidden="true" />
            <p>Checking emails — performing DNS lookups…</p>
          </div>
        )}

        {/* Results */}
        {results && !loading && (
          <section className="results-section">
            {/* Summary cards */}
            <div className="summary-grid">
              <SummaryCard label="Total Checked" value={stats.total} variant="card-total" />
              <SummaryCard label="Likely Delivered" value={stats.delivered} variant="card-delivered" />
              <SummaryCard label="Likely Bounce" value={stats.bounce} variant="card-bounce" />
              <SummaryCard label="Unknown" value={stats.unknown} variant="card-unknown" />
            </div>

            {/* Filters */}
            <div className="filters-row">
              <input
                type="search"
                className="search-input"
                placeholder="Search emails, servers, or explanations…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search results"
              />
              <div className="filter-tabs" role="tablist">
                {Object.keys(STATUS_LABELS).map((key) => (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={statusFilter === key}
                    className={`filter-tab ${statusFilter === key ? 'active' : ''}`}
                    onClick={() => setStatusFilter(key)}
                  >
                    {STATUS_LABELS[key]}
                    {key !== 'all' && results && (
                      <span className="tab-count">
                        {results.filter((r) => r.classification === key).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <button
                className="btn btn-export"
                onClick={() => downloadCSV(results)}
                title="Export all results as CSV"
              >
                ↓ Export CSV
              </button>
            </div>

            <ResultsTable results={filtered} />
          </section>
        )}

        {/* Empty state */}
        {!results && !loading && !error && (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">📋</span>
            <p>Enter email addresses above and click <strong>Check Emails</strong> to get started.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="site-footer">
        <p>
          ShieldNex Email Checker provides deliverability <em>estimates</em> based on
          syntax validation and DNS record lookups. It does not send any emails
          or guarantee delivery outcomes. Results should not be used as the sole
          basis for mailing-list decisions.
        </p>
        <p className="footer-copy">© {new Date().getFullYear()} ShieldNex · Built with React + Node.js</p>
      </footer>
    </div>
  )
}
