import { useState } from 'react'

// Max bbox spans — must match backend data_fetcher.py constants
const MAX_LAT_SPAN = 0.05
const MAX_LON_SPAN = 0.08

const DEFAULT_BBOX = { south: 51.042, west: -114.075, north: 51.048, east: -114.068 }

function approxKm(latSpan, lonSpan, latRef) {
  const latKm = latSpan * 111
  const lonKm = lonSpan * 111 * Math.cos((latRef * Math.PI) / 180)
  return { latKm: latKm.toFixed(1), lonKm: lonKm.toFixed(1) }
}

function validate(f) {
  if (isNaN(f.south) || isNaN(f.west) || isNaN(f.north) || isNaN(f.east)) {
    return 'All four coordinates must be numbers.'
  }
  if (f.south >= f.north) return 'South must be less than North.'
  if (f.west >= f.east) return 'West must be less than East.'
  if (f.south < -90 || f.north > 90) return 'Latitude must be within [-90, 90].'
  if (f.west < -180 || f.east > 180) return 'Longitude must be within [-180, 180].'
  const latSpan = f.north - f.south
  const lonSpan = f.east - f.west
  if (latSpan > MAX_LAT_SPAN) {
    return `Latitude span too large (${latSpan.toFixed(4)}°). Max: ${MAX_LAT_SPAN}° (~${(MAX_LAT_SPAN * 111).toFixed(0)} km).`
  }
  if (lonSpan > MAX_LON_SPAN) {
    return `Longitude span too large (${lonSpan.toFixed(4)}°). Max: ${MAX_LON_SPAN}° (~${(MAX_LON_SPAN * 111 * 0.63).toFixed(0)} km).`
  }
  return null
}

export default function BboxPanel({ currentBbox, onApply, isLoading }) {
  const bbox = currentBbox || DEFAULT_BBOX
  const [fields, setFields] = useState({
    south: String(bbox.south),
    west: String(bbox.west),
    north: String(bbox.north),
    east: String(bbox.east),
  })
  const [validationError, setValidationError] = useState(null)
  const [isOpen, setIsOpen] = useState(false)

  const parsed = {
    south: parseFloat(fields.south),
    west: parseFloat(fields.west),
    north: parseFloat(fields.north),
    east: parseFloat(fields.east),
  }

  const latSpan = parsed.north - parsed.south
  const lonSpan = parsed.east - parsed.west
  const latRef = (parsed.south + parsed.north) / 2
  const size = !isNaN(latSpan) && !isNaN(lonSpan) && latSpan > 0 && lonSpan > 0
    ? approxKm(latSpan, lonSpan, latRef)
    : null

  const handleChange = (key) => (e) => {
    setFields(prev => ({ ...prev, [key]: e.target.value }))
    setValidationError(null)
  }

  const handleApply = (e) => {
    e.preventDefault()
    const err = validate(parsed)
    if (err) { setValidationError(err); return }
    onApply(parsed)
    setValidationError(null)
  }

  const handleReset = () => {
    setFields({
      south: String(DEFAULT_BBOX.south),
      west: String(DEFAULT_BBOX.west),
      north: String(DEFAULT_BBOX.north),
      east: String(DEFAULT_BBOX.east),
    })
    setValidationError(null)
    onApply(DEFAULT_BBOX)
  }

  return (
    <div className="panel">
      <button
        className="bbox-toggle"
        onClick={() => setIsOpen(v => !v)}
        type="button"
      >
        <span className="panel-title" style={{ margin: 0 }}>🗺️ Map Boundary</span>
        <span className="bbox-toggle-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <form onSubmit={handleApply} className="bbox-form">
          <div className="bbox-grid">
            <div className="bbox-field bbox-field-top">
              <label>North</label>
              <input
                type="number"
                className="input"
                step="0.0001"
                value={fields.north}
                onChange={handleChange('north')}
                placeholder="51.048"
              />
            </div>
            <div className="bbox-row-mid">
              <div className="bbox-field">
                <label>West</label>
                <input
                  type="number"
                  className="input"
                  step="0.0001"
                  value={fields.west}
                  onChange={handleChange('west')}
                  placeholder="-114.075"
                />
              </div>
              <div className="bbox-compass">🧭</div>
              <div className="bbox-field">
                <label>East</label>
                <input
                  type="number"
                  className="input"
                  step="0.0001"
                  value={fields.east}
                  onChange={handleChange('east')}
                  placeholder="-114.068"
                />
              </div>
            </div>
            <div className="bbox-field bbox-field-top">
              <label>South</label>
              <input
                type="number"
                className="input"
                step="0.0001"
                value={fields.south}
                onChange={handleChange('south')}
                placeholder="51.042"
              />
            </div>
          </div>

          {size && (
            <div className="bbox-size-info">
              Area: ~{size.lonKm} km × {size.latKm} km
              {' '}
              <span className="bbox-size-limit">
                (max ~{(MAX_LON_SPAN * 111 * 0.63).toFixed(0)} × {(MAX_LAT_SPAN * 111).toFixed(0)} km)
              </span>
            </div>
          )}

          {validationError && (
            <div className="bbox-error">{validationError}</div>
          )}

          <div className="bbox-actions">
            <button type="submit" className="btn btn-primary btn-sm" disabled={isLoading}>
              {isLoading ? '⏳ Loading…' : '✓ Apply'}
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={handleReset}>
              Reset Default
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
