import React, { useEffect, useState } from 'react'
import axios from 'axios'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ login: '', nombre: '', apellidos: '', role_id: '', password: '' })
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ key: 'id', dir: 'desc' })

  useEffect(() => {
    fetchRoles()
    fetchUsers()
  }, [])

  function fetchRoles() {
    axios.get('/api/roles').then(r => setRoles(r.data)).catch(console.error)
  }

  function fetchUsers() {
    axios.get('/api/users').then(r => setUsers(r.data)).catch(console.error)
  }

  function applyFilterAndSort(list) {
    const q = (search || '').toLowerCase().trim()
    let out = list.filter(u => {
      if (!q) return true
      return [String(u.id), u.login, u.nombre || '', u.apellidos || '', String(u.role_id)].join(' ').toLowerCase().includes(q)
    })

    const key = sort.key
    out.sort((a, b) => {
      const va = a[key] ?? ''
      const vb = b[key] ?? ''
      if (va < vb) return sort.dir === 'asc' ? -1 : 1
      if (va > vb) return sort.dir === 'asc' ? 1 : -1
      return 0
    })
    return out
  }

  function formatDate(dt) {
    if (!dt) return ''
    const d = new Date(dt)
    try {
      return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch (e) {
      return dt
    }
  }

  function openCreate() {
    setEditing(null)
    setForm({ login: '', nombre: '', apellidos: '', role_id: roles[0]?.id || '', password: '' })
    setShowModal(true)
  }

  function openEdit(u) {
    setEditing(u.id)
    setForm({ login: u.login, nombre: u.nombre || '', apellidos: u.apellidos || '', role_id: u.role_id, password: '' })
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditing(null)
  }

  async function save() {
    try {
      if (editing) {
        await axios.put(`/api/users/${editing}`, { nombre: form.nombre, apellidos: form.apellidos, role_id: form.role_id, password: form.password || undefined })
      } else {
        await axios.post('/api/users', { login: form.login, nombre: form.nombre, apellidos: form.apellidos, role_id: form.role_id, password: form.password })
      }
      fetchUsers()
      closeModal()
      setForm({ login: '', nombre: '', apellidos: '', role_id: '', password: '' })
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.error || 'Error')
    }
  }

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Administrar Usuarios</h2>
        <button className="btn btn-primary" onClick={openCreate} aria-label="Crear usuario" title="Crear usuario"><i className="fa-solid fa-user-plus" aria-hidden="true" /></button>
      </div>

      <div className="mb-2 d-flex justify-content-between align-items-center">
        <div>
          <input className="form-control" style={{ minWidth: 220 }} placeholder="Filtrar usuarios..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="text-muted">Registros: {users.length}</div>
      </div>

      <table className="table table-striped table-bordered bg-white">
        <thead>
          <tr>
            <th style={{ cursor: 'pointer' }} onClick={() => setSort({ key: 'id', dir: sort.key === 'id' && sort.dir === 'asc' ? 'desc' : 'asc' })}>ID {sort.key==='id' ? (sort.dir==='asc' ? '▲' : '▼') : ''}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => setSort({ key: 'login', dir: sort.key === 'login' && sort.dir === 'asc' ? 'desc' : 'asc' })}>Login {sort.key==='login' ? (sort.dir==='asc' ? '▲' : '▼') : ''}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => setSort({ key: 'nombre', dir: sort.key === 'nombre' && sort.dir === 'asc' ? 'desc' : 'asc' })}>Nombre {sort.key==='nombre' ? (sort.dir==='asc' ? '▲' : '▼') : ''}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => setSort({ key: 'apellidos', dir: sort.key === 'apellidos' && sort.dir === 'asc' ? 'desc' : 'asc' })}>Apellidos {sort.key==='apellidos' ? (sort.dir==='asc' ? '▲' : '▼') : ''}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => setSort({ key: 'role_id', dir: sort.key === 'role_id' && sort.dir === 'asc' ? 'desc' : 'asc' })}>Rol {sort.key==='role_id' ? (sort.dir==='asc' ? '▲' : '▼') : ''}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => setSort({ key: 'password_changed_at', dir: sort.key === 'password_changed_at' && sort.dir === 'asc' ? 'desc' : 'asc' })}>Últ. cambio {sort.key==='password_changed_at' ? (sort.dir==='asc' ? '▲' : '▼') : ''}</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {applyFilterAndSort(users).map(u => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.login}</td>
              <td>{u.nombre}</td>
              <td>{u.apellidos}</td>
              <td>{roles.find(r => r.id === u.role_id)?.name || u.role_id}</td>
              <td>{formatDate(u.password_changed_at)}</td>
              <td>
                <button className="btn btn-sm btn-secondary me-2" onClick={() => openEdit(u)} aria-label="Editar usuario" title="Editar usuario"><i className="fa-solid fa-pen" aria-hidden="true" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal (Bootstrap-compatible) */}
      {showModal && (
        <>
          <div className="modal fade show d-block" tabIndex={-1} role="dialog" onClick={closeModal}>
            <div className="modal-dialog" role="document" onClick={e => e.stopPropagation()}>
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">{editing ? 'Editar usuario' : 'Crear usuario'}</h5>
                  <button type="button" className="btn-close" aria-label="Cerrar" title="Cerrar" onClick={closeModal}></button>
                </div>
                <div className="modal-body">
                  <div className="mb-2">
                    {!editing && (
                      <input className="form-control" placeholder="Login" value={form.login} onChange={e => setForm({ ...form, login: e.target.value })} />
                    )}
                  </div>
                  <div className="row g-2">
                    <div className="col-md-6">
                      <input className="form-control" placeholder="Nombre" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <input className="form-control" placeholder="Apellidos" value={form.apellidos} onChange={e => setForm({ ...form, apellidos: e.target.value })} />
                    </div>
                    <div className="col-md-6 mt-2">
                      <select className="form-select" value={form.role_id} onChange={e => setForm({ ...form, role_id: Number(e.target.value) })}>
                        <option value="">Seleccionar rol</option>
                        {roles.map(r => <option key={r.id} value={r.id}>{r.name} ({r.id})</option>)}
                      </select>
                    </div>
                    <div className="col-md-6 mt-2">
                      <input className="form-control" placeholder="Password (plaintext)" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={closeModal} aria-label="Cancelar" title="Cancelar"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                  <button className="btn btn-success" onClick={save} aria-label={editing ? 'Guardar cambios' : 'Crear usuario'} title={editing ? 'Guardar cambios' : 'Crear usuario'}><i className="fa-solid fa-floppy-disk" aria-hidden="true" /></button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}
    </div>
  )
}
