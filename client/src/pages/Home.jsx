import React from 'react'
import TopMenu from '../components/TopMenu'
import logo from '../assets/escudo_lavadores.jpg'

export default function Home({ user, onLogout }) {
  const roleId = user?.role_id || user?.roleId
  return (
    <div style={{ minHeight: '100vh', background: '#0f5132', color: 'white' }}>
      <TopMenu roleId={roleId} />
      <main style={{ paddingTop: 76 }}>
        <div className="home-landing">
          <img className="home-landing-logo" src={logo} alt="Escudo de Lavadores" />
          <h1>Bienvenido, {user?.nombre || user?.login}</h1>
          <p>Gestiona equipos, jugadores y partidos de Lavadores.</p>
          <button className="btn btn-secondary" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión"><i className="fa-solid fa-right-from-bracket" aria-hidden="true" /></button>
        </div>
      </main>
    </div>
  )
}
