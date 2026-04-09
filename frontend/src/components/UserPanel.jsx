import { useState } from 'react'

export default function UserPanel({ user, onLogin, onLogout }) {
  const [username, setUsername] = useState('')

  const handleLogin = (e) => {
    e.preventDefault()
    if (!username.trim()) return
    onLogin(username.trim())
    setUsername('')
  }

  if (user) {
    return (
      <div className="user-panel">
        <span className="user-badge">👤 {user.username}</span>
        <button className="btn btn-outline btn-sm" onClick={onLogout}>Logout</button>
      </div>
    )
  }

  return (
    <form className="user-panel" onSubmit={handleLogin}>
      <input
        type="text"
        className="input"
        style={{ width: '150px' }}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username…"
      />
      <button type="submit" className="btn btn-outline btn-sm" disabled={!username.trim()}>
        Login
      </button>
    </form>
  )
}
