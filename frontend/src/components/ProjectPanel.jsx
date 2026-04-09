import { useState } from 'react'

export default function ProjectPanel({ user, filters, projects, onSave, onLoad, onDelete }) {
  const [projectName, setProjectName] = useState('')

  const handleSave = (e) => {
    e.preventDefault()
    if (!projectName.trim()) return
    onSave(projectName.trim())
    setProjectName('')
  }

  if (!user) {
    return (
      <div className="panel">
        <div className="panel-title">💾 Projects</div>
        <p style={{ fontSize: '0.8rem', color: '#8b949e' }}>Log in to save and load projects.</p>
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="panel-title">💾 Projects</div>

      <form onSubmit={handleSave} className="save-row">
        <input
          type="text"
          className="input"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="Project name…"
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={!projectName.trim()}>
          Save
        </button>
      </form>

      {projects.length === 0 ? (
        <p style={{ fontSize: '0.8rem', color: '#8b949e', marginTop: '10px' }}>No saved projects yet.</p>
      ) : (
        <div className="project-list">
          {projects.map((project) => (
            <div key={project.id} className="project-item">
              <span className="project-name" title={project.name}>{project.name}</span>
              <div className="project-actions">
                <button className="btn btn-outline btn-sm" onClick={() => onLoad(project)}>Load</button>
                <button className="btn btn-danger btn-sm" onClick={() => onDelete(project.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
