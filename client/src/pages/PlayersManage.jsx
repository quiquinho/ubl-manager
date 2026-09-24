import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import Cropper from 'react-easy-crop'
import PlayerStatsModal from '../components/PlayerStatsModal'

const MAX_PHOTO_DIMENSION = 512
const MAX_INPUT_DIMENSION = 2048
const MAX_PHOTO_BYTES = 64 * 1024
const positions = ['Portero', 'Lateral Izquierdo', 'Lateral Derecho', 'Central', 'Extremo Izquierdo', 'Extremo Derecho', 'Pivote']
const emptyPlayer = { nombre: '', apellidos: '', posicion: positions[0], numero: '', team_ids: [], photo_data: '' }

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => resolve(reader.result)
    reader.readAsDataURL(file)
  })
}

function dataUrlBytes(dataUrl) {
  return Math.floor(((dataUrl.split(',')[1] || '').length * 0.75))
}

async function resizeImage(imageSrc, maxDimension = MAX_INPUT_DIMENSION) {
  const image = await new Promise((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = reject
    element.src = imageSrc
  })
  const canvas = document.createElement('canvas')
  let dimension = Math.min(maxDimension, Math.max(image.naturalWidth, image.naturalHeight))
  while (dimension >= 64) {
    const scale = Math.min(1, dimension / Math.max(image.naturalWidth, image.naturalHeight))
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    for (const quality of [0.75, 0.6, 0.45, 0.3]) {
      const context = canvas.getContext('2d')
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (blob && blob.size <= MAX_PHOTO_BYTES) return fileToDataUrl(blob)
    }
    dimension = Math.floor(dimension * 0.75)
  }
  throw new Error('photo too large')
}

async function cropImage(imageSrc, pixels) {
  const image = await new Promise((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = reject
    element.src = imageSrc
  })
  let outputSize = Math.min(MAX_PHOTO_DIMENSION, pixels.width, pixels.height)
  const canvas = document.createElement('canvas')
  while (outputSize >= 64) {
    for (const quality of [0.82, 0.65, 0.5, 0.35]) {
      canvas.width = outputSize
      canvas.height = outputSize
      const context = canvas.getContext('2d')
      context.clearRect(0, 0, outputSize, outputSize)
      context.drawImage(image, pixels.x, pixels.y, pixels.width, pixels.height, 0, 0, outputSize, outputSize)
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (blob && blob.size <= MAX_PHOTO_BYTES) return fileToDataUrl(blob)
    }
    outputSize = Math.floor(outputSize * 0.8)
  }
  throw new Error('photo too large')
}

export default function PlayersManage() {
  const [players, setPlayers] = useState([])
  const [teams, setTeams] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [statsPlayer, setStatsPlayer] = useState(null)
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [form, setForm] = useState(emptyPlayer)
  const [cropState, setCropState] = useState({ source: null, crop: { x: 0, y: 0 }, zoom: 1, area: null })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [filters, setFilters] = useState({ search: '', teamId: '', position: '' })
  const [sort, setSort] = useState({ key: 'apellidos', direction: 'asc' })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [playersResponse, teamsResponse] = await Promise.all([axios.get('/api/players'), axios.get('/api/teams')])
      setPlayers(playersResponse.data)
      setTeams(teamsResponse.data)
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron cargar los jugadores.')
    }
  }

  function openCreate() {
    setEditingPlayer(null)
    setForm({ ...emptyPlayer })
    setError('')
    setNotice('')
    setShowModal(true)
  }

  function openEdit(player) {
    setEditingPlayer(player.id)
    setForm({
      nombre: player.nombre || '',
      apellidos: player.apellidos || '',
      posicion: player.posicion || positions[0],
      numero: player.numero || '',
      team_ids: player.teams.map(team => team.id),
      photo_data: player.photo_data || ''
    })
    setError('')
    setNotice('')
    setShowModal(true)
  }

  function openStats(player) {
    setStatsPlayer(player)
  }

  function closeModal() {
    setShowModal(false)
    setEditingPlayer(null)
    setForm({ ...emptyPlayer })
    setError('')
    setNotice('')
  }

  function toggleTeam(teamId) {
    setForm(current => ({
      ...current,
      team_ids: current.team_ids.includes(teamId) ? current.team_ids.filter(id => id !== teamId) : [...current.team_ids, teamId]
    }))
  }

  function selectPhoto(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setNotice('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Formato no válido. Usa una imagen JPG, PNG o WEBP.')
      event.target.value = ''
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('La imagen original supera el máximo permitido de 50 MB.')
      event.target.value = ''
      return
    }
    fileToDataUrl(file)
      .then(dataUrl => resizeImage(dataUrl))
      .then(source => {
        setNotice(`Imagen adaptada correctamente: ${(dataUrlBytes(source) / 1024).toFixed(0)} KB. Ahora puedes recortarla.`)
        setCropState({ source, crop: { x: 0, y: 0 }, zoom: 1, area: null })
      })
      .catch(() => setError('No se pudo adaptar la imagen. Usa otra foto con un máximo de 50 MB.'))
      .finally(() => { event.target.value = '' })
  }

  async function applyCrop() {
    if (!cropState.source || !cropState.area) {
      setError('Selecciona un área de recorte antes de continuar.')
      return
    }
    try {
      const photoData = await cropImage(cropState.source, cropState.area)
      setForm(current => ({ ...current, photo_data: photoData }))
      setError('')
      setNotice(`Foto recortada y preparada: ${(dataUrlBytes(photoData) / 1024).toFixed(0)} KB.`)
      setCropState({ source: null, crop: { x: 0, y: 0 }, zoom: 1, area: null })
    } catch {
      setError('No se pudo recortar la imagen. Prueba con otra foto.')
    }
  }

  async function savePlayer() {
    if (!form.team_ids.length) {
      setError('Selecciona al menos un equipo.')
      return
    }
    try {
      const payload = { ...form, numero: form.numero ? Number(form.numero) : null }
      if (editingPlayer) await axios.put(`/api/players/${editingPlayer}`, payload)
      else await axios.post('/api/players', payload)
      await loadData()
      closeModal()
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar el jugador.')
    }
  }

  function changeSort(key) {
    setSort(current => current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: 'asc' })
  }

  function sortIndicator(key) {
    if (sort.key !== key) return '↕'
    return sort.direction === 'asc' ? '↑' : '↓'
  }

  const visiblePlayers = useMemo(() => {
    const search = filters.search.trim().toLocaleLowerCase('es')
    const filtered = players.filter(player => {
      const teamMatches = !filters.teamId || player.teams.some(team => String(team.id) === filters.teamId)
      const positionMatches = !filters.position || player.posicion === filters.position
      const text = [player.nombre, player.apellidos, player.posicion, player.numero, ...player.teams.map(team => team.name)].join(' ').toLocaleLowerCase('es')
      return teamMatches && positionMatches && (!search || text.includes(search))
    })
    return filtered.sort((left, right) => {
      const leftValue = sort.key === 'teams' ? left.teams.map(team => team.name).join(', ') : left[sort.key]
      const rightValue = sort.key === 'teams' ? right.teams.map(team => team.name).join(', ') : right[sort.key]
      const comparison = String(leftValue || '').localeCompare(String(rightValue || ''), 'es', { numeric: true, sensitivity: 'base' })
      return sort.direction === 'asc' ? comparison : -comparison
    })
  }, [filters, players, sort])

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Gestionar Jugadores</h2>
        <button className="btn btn-primary" onClick={openCreate} aria-label="Agregar jugador" title="Agregar jugador"><i className="fa-solid fa-user-plus" aria-hidden="true" /></button>
      </div>
      {error && !showModal && <div className="alert alert-danger">{error}</div>}
      <div className="row g-2 mb-3">
        <div className="col-lg-5"><label className="form-label mb-1">Buscar</label><input className="form-control" placeholder="Nombre, apellidos, equipo..." value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value })} /></div>
        <div className="col-md-4 col-lg-3"><label className="form-label mb-1">Equipo</label><select className="form-select" value={filters.teamId} onChange={event => setFilters({ ...filters, teamId: event.target.value })}><option value="">Todos los equipos</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></div>
        <div className="col-md-4 col-lg-3"><label className="form-label mb-1">Posición</label><select className="form-select" value={filters.position} onChange={event => setFilters({ ...filters, position: event.target.value })}><option value="">Todas las posiciones</option>{positions.map(position => <option key={position} value={position}>{position}</option>)}</select></div>
        <div className="col-md-4 col-lg-1 d-flex align-items-end"><button className="btn btn-outline-secondary w-100" onClick={() => setFilters({ search: '', teamId: '', position: '' })} aria-label="Limpiar filtros" title="Limpiar filtros"><i className="fa-solid fa-rotate-left" aria-hidden="true" /></button></div>
      </div>
      <table className="table table-striped bg-white align-middle">
        <thead><tr><th>Foto</th><th><button className="btn btn-link p-0 text-dark text-decoration-none" onClick={() => changeSort('nombre')}>Nombre {sortIndicator('nombre')}</button></th><th><button className="btn btn-link p-0 text-dark text-decoration-none" onClick={() => changeSort('apellidos')}>Apellidos {sortIndicator('apellidos')}</button></th><th><button className="btn btn-link p-0 text-dark text-decoration-none" onClick={() => changeSort('teams')}>Equipos {sortIndicator('teams')}</button></th><th><button className="btn btn-link p-0 text-dark text-decoration-none" onClick={() => changeSort('posicion')}>Posición {sortIndicator('posicion')}</button></th><th><button className="btn btn-link p-0 text-dark text-decoration-none" onClick={() => changeSort('numero')}>Número {sortIndicator('numero')}</button></th><th>Acciones</th></tr></thead>
        <tbody>
          {visiblePlayers.map(player => (
            <tr key={player.id}>
              <td>{player.photo_data && <img src={player.photo_data} alt="" style={{ width: 42, height: 42, objectFit: 'cover', borderRadius: '50%' }} />}</td>
              <td>{player.nombre}</td>
              <td>{player.apellidos}</td>
              <td>{player.teams.map(team => team.name).join(', ') || '-'}</td>
              <td>{player.posicion}</td>
              <td>{player.numero}</td>
              <td><button className="btn btn-sm btn-outline-info me-1" onClick={() => openStats(player)} aria-label="Ver estadísticas acumuladas" title="Ver estadísticas acumuladas"><i className="fa-solid fa-chart-column" aria-hidden="true" /></button><button className="btn btn-sm btn-outline-secondary" onClick={() => openEdit(player)} aria-label="Editar jugador" title="Editar jugador"><i className="fa-solid fa-pen" aria-hidden="true" /></button></td>
            </tr>
          ))}
          {!visiblePlayers.length && <tr><td colSpan="7" className="text-center text-muted py-4">No hay jugadores que coincidan con los filtros.</td></tr>}
        </tbody>
      </table>

      {showModal && (
        <>
          <div className="modal fade show d-block" tabIndex={-1} onClick={closeModal}>
            <div className="modal-dialog modal-lg" onClick={event => event.stopPropagation()}>
              <div className="modal-content">
                <div className="modal-header"><h5 className="modal-title">{editingPlayer ? 'Editar jugador' : 'Agregar jugador'}</h5><button type="button" className="btn-close" aria-label="Cerrar" title="Cerrar" onClick={closeModal}></button></div>
                <div className="modal-body">
                  {error && <div className="alert alert-danger">{error}</div>}
                  <div className="row g-2">
                    <div className="col-md-6"><label className="form-label">Nombre</label><input className="form-control" value={form.nombre} onChange={event => setForm({ ...form, nombre: event.target.value })} /></div>
                    <div className="col-md-6"><label className="form-label">Apellidos</label><input className="form-control" value={form.apellidos} onChange={event => setForm({ ...form, apellidos: event.target.value })} /></div>
                    <div className="col-md-8"><label className="form-label">Posición</label><select className="form-select" value={form.posicion} onChange={event => setForm({ ...form, posicion: event.target.value })}>{positions.map(position => <option key={position} value={position}>{position}</option>)}</select></div>
                    <div className="col-md-4"><label className="form-label">Número</label><input className="form-control" type="number" value={form.numero} onChange={event => setForm({ ...form, numero: event.target.value })} /></div>
                    <div className="col-12"><label className="form-label">Equipos</label><div className="border rounded p-2">{teams.map(team => <div className="form-check" key={team.id}><input className="form-check-input" type="checkbox" id={`player-team-${team.id}`} checked={form.team_ids.includes(team.id)} onChange={() => toggleTeam(team.id)} /><label className="form-check-label" htmlFor={`player-team-${team.id}`}>{team.name}</label></div>)}</div></div>
                    <div className="col-12"><label className="form-label">Foto</label><input className="form-control" type="file" accept="image/*" onChange={selectPhoto} /><div className="form-text">Límite de la imagen original: 50 MB. Se adaptará automáticamente a un máximo de 512 × 512 px y 64 KB antes de guardarse.</div>{notice && <div className="alert alert-success mt-2 mb-0">{notice}</div>}{form.photo_data && <img src={form.photo_data} alt="Vista previa" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: '50%', marginTop: 8 }} />}</div>
                  </div>
                </div>
                <div className="modal-footer"><button className="btn btn-secondary" onClick={closeModal} aria-label="Cancelar" title="Cancelar"><i className="fa-solid fa-xmark" aria-hidden="true" /></button><button className="btn btn-success" onClick={savePlayer} aria-label={editingPlayer ? 'Guardar cambios' : 'Agregar jugador'} title={editingPlayer ? 'Guardar cambios' : 'Agregar jugador'}><i className="fa-solid fa-floppy-disk" aria-hidden="true" /></button></div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}

      {statsPlayer && <PlayerStatsModal player={statsPlayer} teams={teams} onClose={() => setStatsPlayer(null)} />}

      {cropState.source && (
        <>
          <div className="modal fade show d-block" tabIndex={-1} onClick={() => setCropState(current => ({ ...current, source: null }))}>
            <div className="modal-dialog" onClick={event => event.stopPropagation()}><div className="modal-content"><div className="modal-header"><h5 className="modal-title">Recortar foto</h5><button type="button" className="btn-close" aria-label="Cerrar" title="Cerrar" onClick={() => setCropState(current => ({ ...current, source: null }))} /></div><div className="modal-body"><div style={{ position: 'relative', height: 320, background: '#222' }}><Cropper image={cropState.source} crop={cropState.crop} zoom={cropState.zoom} aspect={1} cropSize={{ width: 260, height: 260 }} cropShape="round" objectFit="cover" showGrid={false} onCropChange={crop => setCropState(current => ({ ...current, crop }))} onCropComplete={(_, area) => setCropState(current => ({ ...current, area }))} onZoomChange={zoom => setCropState(current => ({ ...current, zoom }))} /></div><input className="form-range mt-3" type="range" min="1" max="3" step="0.1" value={cropState.zoom} onChange={event => setCropState(current => ({ ...current, zoom: Number(event.target.value) }))} /></div><div className="modal-footer"><button className="btn btn-secondary" onClick={() => setCropState(current => ({ ...current, source: null }))} aria-label="Cancelar" title="Cancelar"><i className="fa-solid fa-xmark" aria-hidden="true" /></button><button className="btn btn-primary" onClick={applyCrop} aria-label="Usar foto" title="Usar foto"><i className="fa-solid fa-check" aria-hidden="true" /></button></div></div></div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}
    </div>
  )
}
