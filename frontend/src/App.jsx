import { useState, useEffect, useCallback } from 'react'
import CityView from './components/CityView.jsx'
import BuildingPopup from './components/BuildingPopup.jsx'
import QueryPanel from './components/QueryPanel.jsx'
import ProjectPanel from './components/ProjectPanel.jsx'
import UserPanel from './components/UserPanel.jsx'
import BboxPanel from './components/BboxPanel.jsx'
import {
  fetchBuildings, queryBuildings, loginUser,
  getProjects, saveProject, deleteProject
} from './services/api.js'

const DEFAULT_BBOX = { south: 51.042, west: -114.075, north: 51.048, east: -114.068 }

export default function App() {
  const [user, setUser] = useState(null)
  const [buildings, setBuildings] = useState([])
  const [selectedBuilding, setSelectedBuilding] = useState(null)
  const [highlightedIds, setHighlightedIds] = useState([])
  const [clickedIds, setClickedIds] = useState([])
  const [activeFilter, setActiveFilter] = useState(null)
  const [projects, setProjects] = useState([])
  const [isQueryLoading, setIsQueryLoading] = useState(false)
  const [isBboxLoading, setIsBboxLoading] = useState(false)
  const [bbox, setBbox] = useState(DEFAULT_BBOX)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchBuildings()
      .then(data => setBuildings(data))
      .catch(err => setError(err.message || 'Failed to load buildings. Is the backend running on port 5000?'))
  }, [])

  const handleBuildingClick = useCallback((buildingId, properties) => {
    // Show popup for the clicked building
    setSelectedBuilding(prev =>
      prev?.id === buildingId ? null : { id: buildingId, properties }
    )
    // Toggle yellow highlight
    setClickedIds(prev =>
      prev.includes(buildingId)
        ? prev.filter(id => id !== buildingId)
        : [...prev, buildingId]
    )
  }, [])

  const handleQuery = useCallback(async (query, apiKey) => {
    setIsQueryLoading(true)
    setError(null)
    try {
      const result = await queryBuildings(query, apiKey, bbox)
      setActiveFilter(result)
      setHighlightedIds(result.matching_ids || [])
    } catch {
      setError('Query failed. Make sure the backend is running.')
    } finally {
      setIsQueryLoading(false)
    }
  }, [bbox])

  const handleLogin = useCallback(async (username) => {
    try {
      const userData = await loginUser(username)
      setUser(userData)
      const userProjects = await getProjects(username)
      setProjects(userProjects)
    } catch {
      setError('Login failed.')
    }
  }, [])

  const handleLogout = useCallback(() => {
    setUser(null)
    setProjects([])
  }, [])

  const handleSaveProject = useCallback(async (name) => {
    if (!user) return
    try {
      const filtersToSave = activeFilter?.filter_spec ? [activeFilter.filter_spec] : []
      await saveProject(user.username, name, filtersToSave)
      const userProjects = await getProjects(user.username)
      setProjects(userProjects)
    } catch {
      setError('Failed to save project.')
    }
  }, [user, activeFilter])

  const handleLoadProject = useCallback((project) => {
    const filters = project.filters || []
    if (filters.length === 0) {
      setActiveFilter(null)
      setHighlightedIds([])
      return
    }
    const filterSpec = filters[0]
    if (!filterSpec) return

    const matchingIds = buildings.filter(building => {
      const bval = building.properties[filterSpec.attribute]
      if (bval == null) return false
      try {
        const op = filterSpec.operator
        const val = filterSpec.value
        if (op === '>') return parseFloat(bval) > parseFloat(val)
        if (op === '<') return parseFloat(bval) < parseFloat(val)
        if (op === '>=') return parseFloat(bval) >= parseFloat(val)
        if (op === '<=') return parseFloat(bval) <= parseFloat(val)
        if (op === '==') return String(bval).toLowerCase() === String(val).toLowerCase()
        if (op === 'contains') return String(bval).toLowerCase().includes(String(val).toLowerCase())
      } catch { return false }
      return false
    }).map(b => b.id)

    setActiveFilter({
      filter_spec: filterSpec,
      matching_ids: matchingIds,
      description: `Loaded: ${filterSpec.attribute} ${filterSpec.operator} ${filterSpec.value}`
    })
    setHighlightedIds(matchingIds)
  }, [buildings])

  const handleDeleteProject = useCallback(async (projectId) => {
    try {
      await deleteProject(projectId)
      if (user) {
        const userProjects = await getProjects(user.username)
        setProjects(userProjects)
      }
    } catch {
      setError('Failed to delete project.')
    }
  }, [user])

  const clearFilter = useCallback(() => {
    setActiveFilter(null)
    setHighlightedIds([])
  }, [])

  const handleBboxChange = useCallback(async (newBbox) => {
    setIsBboxLoading(true)
    setError(null)
    setBuildings([])
    setSelectedBuilding(null)
    setHighlightedIds([])
    setClickedIds([])
    setActiveFilter(null)
    try {
      const data = await fetchBuildings(newBbox)
      setBuildings(data)
      setBbox(newBbox)
    } catch (err) {
      setError(err.message || 'Failed to load buildings for the new boundary.')
    } finally {
      setIsBboxLoading(false)
    }
  }, [])

  return (
    <div className="app">
      <div className="top-bar">
        <div className="top-bar-left">
          <h1 className="app-title">🏙️ 3D City Dashboard</h1>
          <span className="subtitle">
            Calgary · {buildings.length > 0 ? `${buildings.length} buildings` : 'Loading…'}
          </span>
        </div>
        <UserPanel user={user} onLogin={handleLogin} onLogout={handleLogout} />
      </div>

      {error && (
        <div className="error-banner">
          ⚠️ {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="main-content">
        <div className="sidebar">
          <BboxPanel
            currentBbox={bbox}
            onApply={handleBboxChange}
            isLoading={isBboxLoading}
          />
          <QueryPanel
            onQuery={handleQuery}
            activeFilter={activeFilter}
            matchCount={highlightedIds.length}
            isLoading={isQueryLoading}
          />
          {activeFilter && (
            <div style={{ padding: '0 16px 8px' }}>
              <button className="btn btn-outline" style={{ width: '100%' }} onClick={clearFilter}>
                ✕ Clear Filter
              </button>
            </div>
          )}
          <ProjectPanel
            user={user}
            filters={activeFilter ? [activeFilter.filter_spec] : []}
            projects={projects}
            onSave={handleSaveProject}
            onLoad={handleLoadProject}
            onDelete={handleDeleteProject}
          />
        </div>

        <div className="city-container">
          <CityView
            buildings={buildings}
            highlightedIds={highlightedIds}
            clickedIds={clickedIds}
            onBuildingClick={handleBuildingClick}
            bbox={bbox}
          />

          {selectedBuilding && (
            <BuildingPopup building={selectedBuilding} onClose={() => setSelectedBuilding(null)} />
          )}

          {(buildings.length === 0 || isBboxLoading) && !error && (
            <div className="loading-overlay">
              <div className="loading-spinner">
                {isBboxLoading ? '⏳ Fetching new area…' : '⏳ Loading Calgary city data…'}
              </div>
            </div>
          )}

          <div className="legend">
            <div className="legend-title">Building Colors</div>
            {[
              ['#4488aa', 'Commercial / Office'],
              ['#6699aa', 'Residential'],
              ['#886644', 'Industrial'],
              ['#9966cc', 'Hotel'],
              ['#555566', 'Parking'],
              ['#556677', 'Other'],
              ['#ffaa00', 'Filter match'],
              ['#ffff00', 'Selected (click)'],
            ].map(([color, label]) => (
              <div key={label} className="legend-item">
                <div className="legend-dot" style={{ background: color }} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
