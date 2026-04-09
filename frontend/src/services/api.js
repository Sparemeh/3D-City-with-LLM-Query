const BASE = ''

export async function fetchBuildings(bbox = null) {
  let url = `${BASE}/api/buildings`
  if (bbox) {
    const { south, west, north, east } = bbox
    url += `?south=${south}&west=${west}&north=${north}&east=${east}`
  }
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to fetch buildings')
  }
  return res.json()
}

export async function queryBuildings(query, hfApiKey, bbox = null) {
  let url = `${BASE}/api/query`
  if (bbox) {
    const { south, west, north, east } = bbox
    url += `?south=${south}&west=${west}&north=${north}&east=${east}`
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, hf_api_key: hfApiKey || null })
  })
  if (!res.ok) throw new Error('Query failed')
  return res.json()
}

export async function fetchBboxLimits() {
  const res = await fetch(`${BASE}/api/bbox/limits`)
  if (!res.ok) throw new Error('Failed to fetch bbox limits')
  return res.json()
}

export async function loginUser(username) {
  const res = await fetch(`${BASE}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  })
  if (!res.ok) throw new Error('Login failed')
  return res.json()
}

export async function getProjects(username) {
  const res = await fetch(`${BASE}/api/projects/${encodeURIComponent(username)}`)
  if (!res.ok) throw new Error('Failed to load projects')
  return res.json()
}

export async function saveProject(username, name, filters) {
  const res = await fetch(`${BASE}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, name, filters })
  })
  if (!res.ok) throw new Error('Failed to save project')
  return res.json()
}

export async function deleteProject(projectId) {
  const res = await fetch(`${BASE}/api/projects/${projectId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete project')
  return res.json()
}
