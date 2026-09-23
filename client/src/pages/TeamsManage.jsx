import React, { useEffect, useState } from 'react'
import axios from 'axios'
import Cropper from 'react-easy-crop'

const MAX_PHOTO_DIMENSION = 512
const MAX_INPUT_DIMENSION = 2048
const MAX_PHOTO_BYTES = 64 * 1024
const teamCategories = ['Benjamin', 'Alevin', 'Infantil', 'Cadete', 'Juvenil', 'Senior']
const genderLabels = { M: 'Masculino', F: 'Femenino', X: 'Mixto' }

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => resolve(reader.result)
    reader.readAsDataURL(file)
  })
}

function dataUrlBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1] || ''
  return Math.floor(base64.length * 0.75)
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
      if (blob && blob.size <= MAX_PHOTO_BYTES) {
        return fileToDataUrl(blob)
      }
    }
    outputSize = Math.floor(outputSize * 0.8)
  }
  throw new Error('photo too large')
}

export default function TeamsManage() {
  const [teams, setTeams] = useState([])
  const [form, setForm] = useState({ name: '', category: 'Infantil', gender: 'M' })
  const [showModal, setShowModal] = useState(false)
  const [editingTeam, setEditingTeam] = useState(null)
  const [playersModal, setPlayersModal] = useState({ show: false, team: null, players: [] })
  const [showPlayerFormModal, setShowPlayerFormModal] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [cropState, setCropState] = useState({ source: null, crop: { x: 0, y: 0 }, zoom: 1, area: null })
  const [photoError, setPhotoError] = useState('')
  const [photoNotice, setPhotoNotice] = useState('')
  const positions = [
    'Portero',
    'Lateral Izquierdo',
    'Lateral Derecho',
    'Central',
    'Extremo Izquierdo',
    'Extremo Derecho',
    'Pivote'
  ]

  useEffect(() => { fetchTeams() }, [])

  function fetchTeams() {
    axios.get('/api/teams').then(r => setTeams(r.data)).catch(console.error)
  }

  function openCreate() {
    setForm({ name: '', category: 'Infantil', gender: 'M' })
    setEditingTeam(null)
    setShowModal(true)
  }

  function openEdit(team) {
    setForm({ name: team.name || '', category: team.category || 'Infantil', gender: team.gender || 'M' })
    setEditingTeam(team.id)
    setShowModal(true)
  }

  async function openPlayers(team) {
    // open modal first so user sees dialog even if fetch fails
    setPlayersModal({ show: true, team, players: [], error: null })
    try {
      const res = await axios.get(`/api/teams/${team.id}/players`)
      setPlayersModal({ show: true, team, players: res.data, error: null })
    } catch (err) {
      console.error(err)
      const message = err.response?.data?.error || err.message || 'Error al cargar jugadores'
      setPlayersModal({ show: true, team, players: [], error: message })
    }
  }

  function closePlayers() {
    setPlayersModal({ show: false, team: null, players: [] })
    cancelEditPlayer()
  }

  const [playerForm, setPlayerForm] = useState({ nombre: '', apellidos: '', posicion: positions[0], numero: '', photo_data: '' })

  function openCreatePlayer() {
    cancelEditPlayer()
    setShowPlayerFormModal(true)
  }

  function editPlayer(player) {
    setEditingPlayer(player.id)
    setPlayerForm({ nombre: player.nombre || '', apellidos: player.apellidos || '', posicion: player.posicion || positions[0], numero: player.numero || '', photo_data: player.photo_data || '' })
    setPhotoError('')
    setPhotoNotice('')
    setShowPlayerFormModal(true)
  }

  function cancelEditPlayer() {
    setEditingPlayer(null)
    setPlayerForm({ nombre: '', apellidos: '', posicion: positions[0], numero: '', photo_data: '' })
    setPhotoError('')
    setPhotoNotice('')
    setShowPlayerFormModal(false)
  }

  function selectPhoto(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setPhotoError('')
    setPhotoNotice('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError('Formato no válido. Usa una imagen JPG, PNG o WEBP.')
      event.target.value = ''
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setPhotoError('La imagen original supera el máximo permitido de 50 MB.')
      event.target.value = ''
      return
    }
    fileToDataUrl(file)
      .then(dataUrl => resizeImage(dataUrl))
      .then(source => {
        setPhotoNotice(`Imagen adaptada correctamente: ${(dataUrlBytes(source) / 1024).toFixed(0)} KB. Ahora puedes recortarla.`)
        setCropState({ source, crop: { x: 0, y: 0 }, zoom: 1, area: null })
      })
      .catch(() => setPhotoError('No se pudo adaptar la imagen. Usa otra foto con un máximo de 50 MB.'))
      .finally(() => { event.target.value = '' })
  }

  async function applyCrop() {
    if (!cropState.source || !cropState.area) {
      setPhotoError('Selecciona un área de recorte antes de continuar.')
      return
    }
    try {
      const photoData = await cropImage(cropState.source, cropState.area)
      if (!photoData) throw new Error('empty image')
      setPlayerForm(form => ({ ...form, photo_data: photoData }))
      setPhotoError('')
      setPhotoNotice(`Foto recortada y preparada: ${(dataUrlBytes(photoData) / 1024).toFixed(0)} KB.`)
      setCropState({ source: null, crop: { x: 0, y: 0 }, zoom: 1, area: null })
    } catch {
      setPhotoError('No se pudo recortar la imagen. Prueba con otra foto.')
    }
  }

  async function savePlayer() {
    try {
      const teamId = playersModal.team.id
      const payload = { ...playerForm, numero: playerForm.numero ? Number(playerForm.numero) : null }
      if (editingPlayer) await axios.put(`/api/players/${editingPlayer}`, payload)
      else await axios.post(`/api/teams/${teamId}/players`, payload)
      const res = await axios.get(`/api/teams/${teamId}/players`)
      setPlayersModal(s => ({ ...s, players: res.data }))
      cancelEditPlayer()
    } catch (err) {
      console.error(err)
      setPhotoError(err.response?.data?.error || err.message || 'No se pudo guardar la foto o el jugador.')
    }
  }

  function closeModal() {
    setShowModal(false)
    setEditingTeam(null)
  }

  async function save() {
    try {
      if (editingTeam) await axios.put(`/api/teams/${editingTeam}`, form)
      else await axios.post('/api/teams', form)
      fetchTeams()
      closeModal()
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.error || 'Error')
    }
  }

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Gestionar Equipos</h2>
        <button className="btn btn-primary" onClick={openCreate} aria-label="Crear equipo" title="Crear equipo"><i className="fa-solid fa-plus" aria-hidden="true" /></button>
      </div>

      <table className="table table-striped bg-white">
        <thead>
          <tr><th>ID</th><th>Nombre</th><th>Categoría</th><th>Género</th><th>Nº de jugadores</th><th>Creado</th><th>Acciones</th></tr>
        </thead>
        <tbody>
          {teams.map(t => (
            <tr key={t.id}>
              <td>{t.id}</td>
              <td>{t.name}</td>
              <td>{t.category}</td>
              <td>{genderLabels[t.gender] || t.gender}</td>
              <td><span className={Number(t.player_count || 0) < 7 ? 'text-danger fw-bold' : 'text-primary fw-bold'}>{t.player_count || 0}</span></td>
              <td>{new Date(t.created_at).toLocaleString('es-ES')}</td>
              <td><button className="btn btn-sm btn-outline-secondary" onClick={() => openEdit(t)} aria-label="Editar equipo" title="Editar equipo"><i className="fa-solid fa-pen" aria-hidden="true" /></button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <>
          <div className="modal fade show d-block" tabIndex={-1} onClick={closeModal}>
            <div className="modal-dialog" onClick={e => e.stopPropagation()}>
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">{editingTeam ? 'Editar equipo' : 'Crear equipo'}</h5>
                  <button type="button" className="btn-close" aria-label="Cerrar" title="Cerrar" onClick={closeModal}></button>
                </div>
                <div className="modal-body">
                  <label className="form-label">Nombre</label>
                  <input className="form-control mb-2" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  <label className="form-label">Categoría</label>
                  <select className="form-select mb-2" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {teamCategories.map(category => <option key={category} value={category}>{category}</option>)}
                  </select>
                  <label className="form-label">Género</label>
                  <select className="form-select" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                    <option value="M">Masc</option>
                    <option value="F">Fem</option>
                    <option value="X">Mixto</option>
                  </select>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={closeModal} aria-label="Cancelar" title="Cancelar"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                  <button className="btn btn-success" onClick={save} aria-label={editingTeam ? 'Guardar cambios' : 'Crear equipo'} title={editingTeam ? 'Guardar cambios' : 'Crear equipo'}><i className="fa-solid fa-floppy-disk" aria-hidden="true" /></button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}

      {/* Players modal */}
      {playersModal.show && (
        <>
          <div className="modal fade show d-block" tabIndex={-1} onClick={closePlayers}>
            <div className="modal-dialog modal-lg" onClick={e => e.stopPropagation()}>
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Jugadores - {playersModal.team.name}</h5>
                  <button type="button" className="btn-close" aria-label="Cerrar" title="Cerrar" onClick={closePlayers}></button>
                </div>
                <div className="modal-body">
                  {playersModal.error && <div className="alert alert-danger">{playersModal.error}</div>}
                  <table className="table table-sm">
                    <thead>
                      <tr><th>Foto</th><th>ID</th><th>Nombre</th><th>Apellidos</th><th>Posición</th><th>Número</th><th>Acciones</th></tr>
                    </thead>
                    <tbody>
                      {playersModal.players.map(p => (
                        <tr key={p.id}>
                          <td>{p.photo_data && <img src={p.photo_data} alt="" style={{ width: 42, height: 42, objectFit: 'cover', borderRadius: '50%' }} />}</td>
                          <td>{p.id}</td><td>{p.nombre}</td><td>{p.apellidos}</td><td>{p.posicion}</td><td>{p.numero}</td>
                          <td><button className="btn btn-sm btn-outline-secondary" onClick={() => editPlayer(p)} aria-label="Editar jugador" title="Editar jugador"><i className="fa-solid fa-pen" aria-hidden="true" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                </div>
                <div className="modal-footer">
                  <button className="btn btn-primary" onClick={openCreatePlayer} aria-label="Agregar jugador" title="Agregar jugador"><i className="fa-solid fa-user-plus" aria-hidden="true" /></button>
                  <button className="btn btn-secondary" onClick={closePlayers} aria-label="Cerrar" title="Cerrar"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}

      {showPlayerFormModal && (
        <>
          <div className="modal fade show d-block" tabIndex={-1} onClick={cancelEditPlayer}>
            <div className="modal-dialog" onClick={e => e.stopPropagation()}>
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">{editingPlayer ? 'Editar jugador' : 'Agregar jugador'}</h5>
                  <button type="button" className="btn-close" aria-label="Cerrar" title="Cerrar" onClick={cancelEditPlayer}></button>
                </div>
                <div className="modal-body">
                  <div className="row g-2">
                    <div className="col-md-6"><label className="form-label">Nombre</label><input className="form-control" value={playerForm.nombre} onChange={e => setPlayerForm({ ...playerForm, nombre: e.target.value })} /></div>
                    <div className="col-md-6"><label className="form-label">Apellidos</label><input className="form-control" value={playerForm.apellidos} onChange={e => setPlayerForm({ ...playerForm, apellidos: e.target.value })} /></div>
                    <div className="col-md-8"><label className="form-label">Posición</label><select className="form-select" value={playerForm.posicion} onChange={e => setPlayerForm({ ...playerForm, posicion: e.target.value })}>{positions.map(pos => <option key={pos} value={pos}>{pos}</option>)}</select></div>
                    <div className="col-md-4"><label className="form-label">Número</label><input className="form-control" type="number" value={playerForm.numero} onChange={e => setPlayerForm({ ...playerForm, numero: e.target.value })} /></div>
                    <div className="col-12">
                      <label className="form-label">Foto</label>
                      <input className="form-control" type="file" accept="image/*" onChange={selectPhoto} />
                      <div className="form-text">Límite de la imagen original: 50 MB. Se adaptará automáticamente a un máximo de 512 × 512 px y 64 KB antes de guardarse.</div>
                      {photoNotice && <div className="alert alert-success mt-2 mb-0">{photoNotice}</div>}
                      {photoError && <div className="alert alert-danger mt-2 mb-0">{photoError}</div>}
                      {playerForm.photo_data && <img src={playerForm.photo_data} alt="Vista previa" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: '50%', marginTop: 8 }} />}
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={cancelEditPlayer} aria-label="Cancelar" title="Cancelar"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                  <button className="btn btn-success" onClick={savePlayer} aria-label={editingPlayer ? 'Guardar cambios' : 'Agregar jugador'} title={editingPlayer ? 'Guardar cambios' : 'Agregar jugador'}><i className="fa-solid fa-floppy-disk" aria-hidden="true" /></button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}

      {cropState.source && (
        <>
          <div className="modal fade show d-block" tabIndex={-1} onClick={() => setCropState(s => ({ ...s, source: null }))}>
            <div className="modal-dialog" onClick={e => e.stopPropagation()}>
              <div className="modal-content">
                <div className="modal-header"><h5 className="modal-title">Recortar foto</h5><button type="button" className="btn-close" aria-label="Cerrar" title="Cerrar" onClick={() => setCropState(s => ({ ...s, source: null }))} /></div>
                <div className="modal-body">
                  <div style={{ position: 'relative', height: 320, background: '#222' }}>
                    <Cropper image={cropState.source} crop={cropState.crop} zoom={cropState.zoom} aspect={1} cropSize={{ width: 260, height: 260 }} cropShape="round" objectFit="cover" showGrid={false} onCropChange={crop => setCropState(s => ({ ...s, crop }))} onCropComplete={(_, area) => setCropState(s => ({ ...s, area }))} onZoomChange={zoom => setCropState(s => ({ ...s, zoom }))} />
                  </div>
                  <input className="form-range mt-3" type="range" min="1" max="3" step="0.1" value={cropState.zoom} onChange={e => setCropState(s => ({ ...s, zoom: Number(e.target.value) }))} />
                </div>
                <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setCropState(s => ({ ...s, source: null }))} aria-label="Cancelar" title="Cancelar"><i className="fa-solid fa-xmark" aria-hidden="true" /></button><button className="btn btn-primary" onClick={applyCrop} aria-label="Usar foto" title="Usar foto"><i className="fa-solid fa-check" aria-hidden="true" /></button></div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}
    </div>
  )
}
