import { useState } from 'react'

const EXAMPLES = [
  'buildings over 50 meters',
  'buildings over 100 feet',
  'commercial buildings',
  'zoning CC-X',
  'residential buildings',
  'buildings under 20 meters',
]

export default function QueryPanel({ onQuery, activeFilter, matchCount, isLoading }) {
  const [query, setQuery] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!query.trim()) return
    onQuery(query.trim(), apiKey.trim() || null)
  }

  const handleExample = (ex) => {
    setQuery(ex)
    onQuery(ex, apiKey.trim() || null)
  }

  return (
    <div className="panel">
      <div className="panel-title">🔍 LLM Query</div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <textarea
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='e.g. "highlight buildings over 100 feet"'
          rows={2}
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
        />

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isLoading || !query.trim()}>
            {isLoading ? '⏳ Searching…' : '🔍 Search'}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setShowApiKey(v => !v)}
            title="HuggingFace API Key (optional)"
          >
            🔑
          </button>
        </div>

        {showApiKey && (
          <input
            type="password"
            className="input"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="HuggingFace API key (optional)"
          />
        )}
      </form>

      {activeFilter && (
        <div className="filter-result">
          <div>{activeFilter.description}</div>
          <div style={{ marginTop: '4px' }}>
            <span className="match-count">{matchCount}</span>
            <span style={{ color: '#8b949e' }}> building{matchCount !== 1 ? 's' : ''} matched</span>
          </div>
        </div>
      )}

      <div className="query-examples">
        {EXAMPLES.map((ex) => (
          <button key={ex} className="example-chip" onClick={() => handleExample(ex)}>
            {ex}
          </button>
        ))}
      </div>
    </div>
  )
}
