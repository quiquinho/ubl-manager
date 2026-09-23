import React, { useState } from 'react'
import axios from 'axios'
import Swal from 'sweetalert2'
import logo from '../assets/escudo_lavadores.jpg'

export default function Login({ onLogin }) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')

  async function submit(e) {
    e.preventDefault()
    try {
      const res = await axios.post('/api/login', { login, password })
      const user = res.data.user
      // Mostrar mensaje de bienvenida breve
      Swal.fire({ icon: 'success', title: 'Bienvenido', text: `Hola ${user.nombre || user.login}`, timer: 900, showConfirmButton: false })
      onLogin(user)
    } catch (err) {
      const status = err.response?.status
      let msg = 'Error desconocido'
      if (status === 400) msg = 'Usuario y contraseña son obligatorios'
      else if (status === 401) msg = 'Credenciales inválidas. Comprueba usuario y contraseña.'
      else if (status >= 500) msg = 'Error del servidor. Inténtalo más tarde.'
      else msg = err.response?.data?.error || 'Error de conexión'

      Swal.fire({ icon: 'error', title: 'Error', text: msg })
    }
  }

  return (
    <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '80vh', padding: 20 }}>
      <img src={logo} alt="Lavadores" style={{ width: 180, height: 180, objectFit: 'cover', borderRadius: 8, marginBottom: 20 }} />
      <div style={{ width: 320 }}>
        <h2 className="text-center mb-3">Iniciar sesión en UBL Manager</h2>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input className="form-control" placeholder="Login" value={login} onChange={e => setLogin(e.target.value)} />
          <input className="form-control" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button className="btn btn-primary mt-2 w-100" type="submit" aria-label="Entrar" title="Entrar"><i className="fa-solid fa-right-to-bracket" aria-hidden="true" /></button>
        </form>
      </div>
    </div>
  )
}
