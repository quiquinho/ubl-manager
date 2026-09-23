import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import TopMenu from './components/TopMenu'
import axios from 'axios'
import Login from './pages/Login'
import Home from './pages/Home'
import AdminUsers from './pages/AdminUsers'
import TeamsManage from './pages/TeamsManage'
import PlayersManage from './pages/PlayersManage'
import MatchSchedule from './pages/MatchSchedule'
import MatchStatistics from './pages/MatchStatistics'
import MatchFollowUp from './pages/MatchFollowUp'

export default function App() {
  const [roles, setRoles] = useState([])
    useEffect(() => {
      axios.get('/api/roles').then(r => setRoles(r.data)).catch(console.error)
    }, [])

  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })

  function handleLogin(u) {
    setUser(u)
    localStorage.setItem('user', JSON.stringify(u))
  }

  function handleLogout() {
    setUser(null)
    localStorage.removeItem('user')
  }

  if (!user) return <Login onLogin={handleLogin} />

  return (
    <BrowserRouter>
      <TopMenu roleId={user.role_id} />
      <div className="with-navbar">
        <Routes>
          <Route path="/" element={<Home user={user} onLogout={handleLogout} />} />
          <Route path="/administrar/usuarios" element={<AdminUsers />} />
          <Route path="/equipos/gestionar" element={<TeamsManage />} />
          <Route path="/jugadores/gestionar" element={<PlayersManage />} />
          <Route path="/partido/programar" element={<MatchSchedule />} />
          <Route path="/partido/estadisticas" element={<MatchStatistics />} />
          <Route path="/partido/seguimiento" element={<MatchFollowUp />} />
          <Route path="/administrar/*" element={<Home user={user} onLogout={handleLogout} />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
