const BASE = import.meta.env.VITE_API_BASE || ''

export async function fetchBuildings() {
  const res = await fetch(`${BASE}/api/buildings`)
  if (!res.ok) throw new Error('Failed to fetch buildings')
  return res.json()
}

export async function queryBuildings(query, hfApiKey) {
  const res = await fetch(`${BASE}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, hf_api_key: hfApiKey || null })
  })
  if (!res.ok) throw new Error('Query failed')
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
