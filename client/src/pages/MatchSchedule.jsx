import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import Swal from 'sweetalert2'
import MatchStatsModal from '../components/MatchStatsModal'

const emptyForm = { homeTeamId: '', visitorId: '', venueId: '', matchDate: '', matchTime: '', advanceMinutes: 30, playerIds: [] }

function formatMatchDate(value) {
  return new Date(value).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatMatchTime(value) {
  return new Date(value).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

export default function MatchSchedule() {
  const [matches, setMatches] = useState([])
  const [teams, setTeams] = useState([])
  const [visitors, setVisitors] = useState([])
  const [venues, setVenues] = useState([])
  const [teamPlayers, setTeamPlayers] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [filters, setFilters] = useState({ search: '', teamId: '', status: 'upcoming' })
  const [sort, setSort] = useState({ key: 'scheduled_at', direction: 'asc' })
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [editingMatchId, setEditingMatchId] = useState(null)
  const [showPlayersModal, setShowPlayersModal] = useState(false)
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [selectedMatchPlayers, setSelectedMatchPlayers] = useState([])
  const [whatsAppText, setWhatsAppText] = useState('')
  const [showVisitorModal, setShowVisitorModal] = useState(false)
  const [showVenueModal, setShowVenueModal] = useState(false)
  const [showStatsModal, setShowStatsModal] = useState(false)
  const [visitorName, setVisitorName] = useState('')
  const [venueName, setVenueName] = useState('')
  const [venueLocation, setVenueLocation] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (!form.homeTeamId) {
      setTeamPlayers([])
      return
    }
    axios.get(`/api/teams/${form.homeTeamId}/players`)
      .then(response => setTeamPlayers(response.data))
      .catch(() => setError('No se pudieron cargar los jugadores del equipo.'))
  }, [form.homeTeamId])

  async function loadData() {
    try {
      const [matchesResponse, teamsResponse, visitorsResponse, venuesResponse] = await Promise.all([
        axios.get('/api/matches'), axios.get('/api/teams'), axios.get('/api/visitors'), axios.get('/api/venues')
      ])
      setMatches(matchesResponse.data)
      setTeams(teamsResponse.data)
      setVisitors(visitorsResponse.data)
      setVenues(venuesResponse.data)
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron cargar los datos de partidos.')
    }
  }

  function openMatchModal() {
    setForm({ ...emptyForm })
    setEditingMatchId(null)
    setError('')
    setShowMatchModal(true)
  }

  async function editMatch(match) {
    try {
      const response = await axios.get(`/api/matches/${match.id}/players`)
      const [matchDate, matchTime] = match.scheduled_at.split('T')
      setForm({ homeTeamId: String(match.home_team_id), visitorId: String(match.visitor_id), venueId: String(match.venue_id), matchDate, matchTime, advanceMinutes: match.advance_minutes, playerIds: response.data.map(player => player.id) })
      setTeamPlayers([])
      setEditingMatchId(match.id)
      setError('')
      setShowMatchModal(true)
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cargar el partido.')
    }
  }

  async function showMatchPlayers(match) {
    try {
      const response = await axios.get(`/api/matches/${match.id}/players`)
      setSelectedMatch(match)
      setSelectedMatchPlayers(response.data)
      setShowPlayersModal(true)
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cargar la convocatoria.')
    }
  }

  async function openWhatsAppDialog(match) {
    try {
      const response = await axios.get(`/api/matches/${match.id}/players`)
      const matchDate = new Date(match.scheduled_at)
      const arrivalDate = new Date(matchDate.getTime() - Number(match.advance_minutes || 0) * 60000)
      const playersText = response.data.map(player => `- ${player.nombre} ${player.apellidos || ''}${player.numero ? ` (${player.numero})` : ''}`.trim()).join('\n')
      const matchInfo = `*${match.home_team_name}* vs *${match.visitor_name}*\n*Fecha:* ${formatMatchDate(match.scheduled_at)} - *Hora:* ${formatMatchTime(match.scheduled_at)}\n*Estar a las:* ${formatMatchTime(arrivalDate)} en *Pabellón:* ${match.venue_name}\n*Ubicación:* ${match.venue_location}`
      setWhatsAppText(`${matchInfo}\n\n*Convocados:*\n${playersText}`)
      setShowWhatsAppModal(true)
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cargar la convocatoria.')
    }
  }

  async function copyTextToClipboard(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return
      }
    } catch {
      // Continue with the fallback for browsers that block the Clipboard API.
    }

    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.setAttribute('readonly', '')
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.select()
    textArea.setSelectionRange(0, textArea.value.length)
    const copied = document.execCommand('copy')
    document.body.removeChild(textArea)
    if (!copied) throw new Error('No se pudo copiar el texto.')
  }

  async function copyWhatsAppText() {
    try {
      await copyTextToClipboard(whatsAppText)
      await Swal.fire({ icon: 'success', title: 'Copiado', text: 'El mensaje se ha copiado al portapapeles.', confirmButtonColor: '#198754', timer: 1800, showConfirmButton: false })
    } catch {
      await Swal.fire({ icon: 'error', title: 'No se pudo copiar', text: 'El navegador no permitió copiar el mensaje.' })
    }
  }

  function closeMatchModal() {
    setShowMatchModal(false)
    setEditingMatchId(null)
    setForm({ ...emptyForm })
  }

  async function createVisitor(event) {
    event.preventDefault()
    if (!visitorName.trim()) return
    try {
      const response = await axios.post('/api/visitors', { name: visitorName.trim() })
      setVisitors(current => [...current, response.data].sort((left, right) => left.name.localeCompare(right.name, 'es')))
      setForm(current => ({ ...current, visitorId: String(response.data.id) }))
      setVisitorName('')
      setShowVisitorModal(false)
      setError('')
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el visitante.')
    }
  }

  async function createVenue(event) {
    event.preventDefault()
    if (!venueName.trim() || !venueLocation.trim()) return
    try {
      const response = await axios.post('/api/venues', { name: venueName.trim(), location: venueLocation.trim() })
      setVenues(current => [...current, response.data].sort((left, right) => left.name.localeCompare(right.name, 'es')))
      setForm(current => ({ ...current, venueId: String(response.data.id) }))
      setVenueName('')
      setVenueLocation('')
      setShowVenueModal(false)
      setError('')
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el pabellón.')
    }
  }

  async function saveMatch(event) {
    event.preventDefault()
    setError('')
    if (!form.homeTeamId || !form.visitorId || !form.venueId || !form.matchDate || !form.matchTime) {
      setError('Completa equipo local, visitante, fecha, hora y pabellón.')
      return
    }
    if (form.playerIds.length < 7) {
      setError('Selecciona al menos 7 jugadores para la convocatoria.')
      return
    }
    try {
      const payload = {
        home_team_id: form.homeTeamId,
        visitor_id: form.visitorId,
        venue_id: form.venueId,
        scheduled_at: `${form.matchDate}T${form.matchTime}`,
        advance_minutes: Number(form.advanceMinutes),
        player_ids: form.playerIds
      }
      if (editingMatchId) await axios.put(`/api/matches/${editingMatchId}`, payload)
      else await axios.post('/api/matches', payload)
      await loadData()
      closeMatchModal()
      setSuccess(editingMatchId ? 'Partido actualizado correctamente.' : 'Partido programado correctamente.')
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar la programación.')
    }
  }

  function changeSort(key) {
    setSort(current => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' })
  }

  function sortIndicator(key) {
    if (sort.key !== key) return '↕'
    return sort.direction === 'asc' ? '↑' : '↓'
  }

  const visibleMatches = useMemo(() => {
    const now = Date.now()
    const search = filters.search.trim().toLocaleLowerCase('es')
    return matches.filter(match => {
      const matchDate = new Date(match.scheduled_at)
      const statusMatches = filters.status === 'all' || (filters.status === 'upcoming' ? matchDate.getTime() >= now : matchDate.getTime() < now)
      const teamMatches = !filters.teamId || String(match.home_team_id) === filters.teamId
      const text = `${match.home_team_name} ${match.visitor_name} ${match.venue_name}`.toLocaleLowerCase('es')
      return statusMatches && teamMatches && (!search || text.includes(search))
    }).sort((left, right) => {
      const comparison = new Date(left[sort.key]).getTime() - new Date(right[sort.key]).getTime()
      return sort.direction === 'asc' ? comparison : -comparison
    })
  }, [filters, matches, sort])

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div><h2 className="mb-1">Programar partido</h2><p className="text-muted mb-0">Próximos partidos programados.</p></div>
        <button className="btn btn-primary" onClick={openMatchModal} aria-label="Programar partido" title="Programar partido"><i className="fa-solid fa-calendar-plus" aria-hidden="true" /></button>
      </div>
      {error && !showMatchModal && !showVisitorModal && !showVenueModal && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="row g-2 mb-3">
        <div className="col-lg-5"><label className="form-label mb-1">Buscar</label><input className="form-control" placeholder="Equipo visitante o pabellón..." value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value })} /></div>
        <div className="col-md-4 col-lg-3"><label className="form-label mb-1">Equipo local</label><select className="form-select" value={filters.teamId} onChange={event => setFilters({ ...filters, teamId: event.target.value })}><option value="">Todos los equipos</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></div>
        <div className="col-md-4 col-lg-3"><label className="form-label mb-1">Mostrar</label><select className="form-select" value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}><option value="upcoming">Próximos partidos</option><option value="all">Todos los partidos</option><option value="past">Partidos pasados</option></select></div>
        <div className="col-md-4 col-lg-1 d-flex align-items-end"><button className="btn btn-outline-secondary w-100" onClick={() => setFilters({ search: '', teamId: '', status: 'upcoming' })} aria-label="Limpiar filtros" title="Limpiar filtros"><i className="fa-solid fa-rotate-left" aria-hidden="true" /></button></div>
      </div>

      <div className="table-responsive"><table className="table table-striped table-bordered bg-white align-middle mb-0">
        <thead><tr><th><button className="btn btn-link p-0 text-dark text-decoration-none" onClick={() => changeSort('scheduled_at')}>Fecha {sortIndicator('scheduled_at')}</button></th><th>Hora</th><th>Local</th><th>Visitante</th><th>Pabellón</th><th>Antelación</th><th>Convocados</th><th>Acciones</th></tr></thead>
        <tbody>
          {visibleMatches.map(match => <tr key={match.id}><td>{formatMatchDate(match.scheduled_at)}</td><td>{formatMatchTime(match.scheduled_at)}</td><td>{match.home_team_name}</td><td>{match.visitor_name}</td><td><a href={match.venue_location} target="_blank" rel="noreferrer">{match.venue_name}</a></td><td>{match.advance_minutes} min</td><td><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => showMatchPlayers(match)} aria-label={`${Number(match.player_count || 0)} convocados`} title="Ver convocados"><i className="fa-solid fa-users" aria-hidden="true" /> {Number(match.player_count || 0)} Convocados</button></td><td><button type="button" className="btn btn-sm btn-outline-primary me-1" onClick={() => { window.location.href = `/partido/seguimiento?matchId=${match.id}` }} aria-label="Seguir partido" title="Seguir partido"><i className="fa-solid fa-chart-line" aria-hidden="true" /></button><button type="button" className="btn btn-sm btn-outline-info me-1" onClick={() => { setSelectedMatch(match); setShowStatsModal(true) }} aria-label="Ver estadísticas del partido" title="Ver estadísticas del partido"><i className="fa-solid fa-chart-column" aria-hidden="true" /></button><button type="button" className="btn btn-sm btn-outline-secondary me-1" onClick={() => editMatch(match)} aria-label="Editar partido" title="Editar partido"><i className="fa-solid fa-pen" aria-hidden="true" /></button><button type="button" className="btn btn-sm btn-outline-success" onClick={() => openWhatsAppDialog(match)} aria-label="Preparar mensaje de WhatsApp" title="Preparar mensaje de WhatsApp"><i className="fa-brands fa-whatsapp" aria-hidden="true" /></button></td></tr>)}
          {!visibleMatches.length && <tr><td colSpan="8" className="text-center text-muted py-4">No hay partidos que coincidan con los filtros.</td></tr>}
        </tbody>
      </table></div>

      {showMatchModal && <>
        <div className="modal fade show d-block" tabIndex={-1} onClick={closeMatchModal}><div className="modal-dialog modal-lg" onClick={event => event.stopPropagation()}><form className="modal-content" onSubmit={saveMatch}>
          <div className="modal-header"><h5 className="modal-title">{editingMatchId ? 'Editar partido' : 'Programar partido'}</h5><button type="button" className="btn-close" aria-label="Cerrar" title="Cerrar" onClick={closeMatchModal} /></div>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="row g-3">
              <div className="col-md-6"><label className="form-label">Equipo local</label><select className="form-select" required value={form.homeTeamId} onChange={event => setForm({ ...form, homeTeamId: event.target.value, playerIds: [] })}><option value="">Selecciona un equipo</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></div>
              <div className="col-md-6"><label className="form-label">Equipo visitante</label><div className="input-group"><select className="form-select" required value={form.visitorId} onChange={event => setForm({ ...form, visitorId: event.target.value })}><option value="">Selecciona un visitante</option>{visitors.map(visitor => <option key={visitor.id} value={visitor.id}>{visitor.name}</option>)}</select><button className="btn btn-outline-primary" type="button" onClick={() => setShowVisitorModal(true)} aria-label="Añadir visitante" title="Añadir visitante"><i className="fa-solid fa-plus" aria-hidden="true" /></button></div></div>
              <div className="col-md-4"><label className="form-label">Fecha</label><input className="form-control" type="date" required value={form.matchDate} onChange={event => setForm({ ...form, matchDate: event.target.value })} /></div>
              <div className="col-md-4"><label className="form-label">Hora</label><input className="form-control" type="time" required value={form.matchTime} onChange={event => setForm({ ...form, matchTime: event.target.value })} /></div>
              <div className="col-md-4"><label className="form-label">Tiempo de antelación (minutos)</label><input className="form-control" type="number" min="0" step="1" required value={form.advanceMinutes} onChange={event => setForm({ ...form, advanceMinutes: event.target.value })} /></div>
              <div className="col-12"><label className="form-label">Convocatoria <span className={form.playerIds.length >= 7 ? 'text-primary' : 'text-danger'}>({form.playerIds.length}/7 mínimo)</span></label><div className={`border rounded p-2 ${!form.homeTeamId ? 'bg-light' : ''}`}>{!form.homeTeamId && <div className="text-muted">Selecciona primero el equipo local.</div>}{form.homeTeamId && !teamPlayers.length && <div className="text-muted">No hay jugadores en este equipo.</div>}{teamPlayers.map(player => <div className="form-check" key={player.id}><input className="form-check-input" type="checkbox" id={`match-player-${player.id}`} checked={form.playerIds.includes(player.id)} onChange={() => setForm(current => ({ ...current, playerIds: current.playerIds.includes(player.id) ? current.playerIds.filter(id => id !== player.id) : [...current.playerIds, player.id] }))} /><label className="form-check-label" htmlFor={`match-player-${player.id}`}>{player.numero ? `${player.numero} - ` : ''}{player.nombre} {player.apellidos || ''}</label></div>)}</div><div className="form-text">Selecciona al menos 7 jugadores que participarán en el partido.</div></div>
              <div className="col-12"><label className="form-label">Lugar</label><div className="input-group"><select className="form-select" required value={form.venueId} onChange={event => setForm({ ...form, venueId: event.target.value })}><option value="">Selecciona un pabellón</option>{venues.map(venue => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select><button className="btn btn-outline-primary" type="button" onClick={() => setShowVenueModal(true)} aria-label="Añadir pabellón" title="Añadir pabellón"><i className="fa-solid fa-plus" aria-hidden="true" /></button></div>{form.venueId && (() => { const venue = venues.find(item => String(item.id) === form.venueId); return venue && <a className="small" href={venue.location} target="_blank" rel="noreferrer">Ver ubicación en Google Maps</a> })()}</div>
            </div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={closeMatchModal} aria-label="Cancelar" title="Cancelar"><i className="fa-solid fa-xmark" aria-hidden="true" /></button><button type="submit" className="btn btn-primary" aria-label={editingMatchId ? 'Guardar cambios' : 'Guardar programación'} title={editingMatchId ? 'Guardar cambios' : 'Guardar programación'}><i className="fa-solid fa-floppy-disk" aria-hidden="true" /></button></div>
        </form></div></div><div className="modal-backdrop fade show" />
      </>}

      {showPlayersModal && <><div className="modal fade show d-block" tabIndex={-1} onClick={() => setShowPlayersModal(false)}><div className="modal-dialog modal-sm" onClick={event => event.stopPropagation()}><div className="modal-content"><div className="modal-header"><h5 className="modal-title">Convocados</h5><button type="button" className="btn-close" aria-label="Cerrar" onClick={() => setShowPlayersModal(false)} /></div><div className="modal-body"><p className="small text-muted mb-2">{selectedMatch?.home_team_name} - {selectedMatch?.visitor_name}</p><ol className="mb-0">{selectedMatchPlayers.map(player => <li key={player.id}>{player.numero ? `${player.numero} - ` : ''}{player.nombre} {player.apellidos || ''}</li>)}</ol></div></div></div></div><div className="modal-backdrop fade show" /></>}

      {showWhatsAppModal && <><div className="modal fade show d-block" tabIndex={-1} onClick={() => setShowWhatsAppModal(false)}><div className="modal-dialog modal-lg" onClick={event => event.stopPropagation()}><div className="modal-content"><div className="modal-header"><h5 className="modal-title"><i className="fa-brands fa-whatsapp text-success me-2" aria-hidden="true" />Mensaje de WhatsApp</h5><button type="button" className="btn-close" aria-label="Cerrar" title="Cerrar" onClick={() => setShowWhatsAppModal(false)} /></div><div className="modal-body"><label className="form-label">Mensaje con convocados</label><textarea className="form-control" rows="16" value={whatsAppText} readOnly /></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowWhatsAppModal(false)} aria-label="Cerrar" title="Cerrar"><i className="fa-solid fa-xmark" aria-hidden="true" /></button><button type="button" className="btn btn-success" onClick={copyWhatsAppText} aria-label="Copiar mensaje" title="Copiar mensaje"><i className="fa-solid fa-copy" aria-hidden="true" /></button></div></div></div></div><div className="modal-backdrop fade show" /></>}

      {showStatsModal && selectedMatch && <MatchStatsModal matchId={selectedMatch.id} matchLabel={`${selectedMatch.home_team_name} vs ${selectedMatch.visitor_name}`} onClose={() => setShowStatsModal(false)} />}

      {showVisitorModal && <><div className="modal fade show d-block" tabIndex={-1} onClick={() => setShowVisitorModal(false)}><div className="modal-dialog modal-sm" onClick={event => event.stopPropagation()}><form className="modal-content" onSubmit={createVisitor}><div className="modal-header"><h5 className="modal-title">Nuevo visitante</h5><button type="button" className="btn-close" onClick={() => setShowVisitorModal(false)} /></div><div className="modal-body"><label className="form-label">Nombre</label><input className="form-control" autoFocus value={visitorName} onChange={event => setVisitorName(event.target.value)} /></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowVisitorModal(false)}>Cancelar</button><button type="submit" className="btn btn-primary">Añadir</button></div></form></div></div><div className="modal-backdrop fade show" /></>}
      {showVenueModal && <><div className="modal fade show d-block" tabIndex={-1} onClick={() => setShowVenueModal(false)}><div className="modal-dialog modal-sm" onClick={event => event.stopPropagation()}><form className="modal-content" onSubmit={createVenue}><div className="modal-header"><h5 className="modal-title">Nuevo pabellón</h5><button type="button" className="btn-close" onClick={() => setShowVenueModal(false)} /></div><div className="modal-body"><label className="form-label">Nombre</label><input className="form-control mb-3" autoFocus value={venueName} onChange={event => setVenueName(event.target.value)} required /><label className="form-label">Enlace de Google Maps</label><input className="form-control" type="text" value={venueLocation} onChange={event => setVenueLocation(event.target.value)} placeholder="maps.google.com/..." required /></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowVenueModal(false)}>Cancelar</button><button type="submit" className="btn btn-primary">Añadir</button></div></form></div></div><div className="modal-backdrop fade show" /></>}
    </div>
  )
}
