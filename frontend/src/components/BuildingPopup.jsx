export default function BuildingPopup({ building, onClose }) {
  const p = building.properties

  const formatCurrency = (val) => {
    if (val == null) return 'N/A'
    return '$' + Number(val).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }

  const heightFt = p.height ? `${p.height}m / ${(p.height * 3.281).toFixed(0)}ft` : 'N/A'

  return (
    <div className="building-popup">
      <div className="popup-header">
        <span className="popup-title" title={p.name}>{p.name}</span>
        <button className="popup-close" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="popup-body">
        <div className="popup-row">
          <span className="popup-label">Address</span>
          <span className="popup-value">{p.address || 'N/A'}</span>
        </div>
        <div className="popup-row">
          <span className="popup-label">Height</span>
          <span className="popup-value">{heightFt}</span>
        </div>
        <div className="popup-row">
          <span className="popup-label">Type</span>
          <span className="popup-value">{p.building_type || 'N/A'}</span>
        </div>
        <div className="popup-row">
          <span className="popup-label">Zoning</span>
          <span className="popup-value">{p.zoning || 'N/A'}</span>
        </div>
        <div className="popup-row">
          <span className="popup-label">Assessed Value</span>
          <span className="popup-value highlight">{formatCurrency(p.assessed_value)}</span>
        </div>
        <div className="popup-row">
          <span className="popup-label">Coords</span>
          <span className="popup-value" style={{ fontSize: '0.75rem' }}>
            {p.lat?.toFixed(5)}, {p.lon?.toFixed(5)}
          </span>
        </div>
      </div>
    </div>
  )
}
