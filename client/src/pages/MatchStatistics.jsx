import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const statColumns = [
  ['goals', 'Goles'], ['shots', 'Lanzamientos'], ['assists', 'Asistencias'], ['saves', 'Paradas'],
  ['goals_conceded', 'Goles recibidos'], ['steals', 'Robos'], ['turnovers', 'Pérdidas'], ['blocks', 'Bloqueos'],
  ['exclusions_2min', 'Exclusiones'], ['yellow_cards', 'Amarillas'], ['red_cards', 'Rojas'],
  ['seven_meters_scored', '7 m marcados'], ['seven_meters_attempted', '7 m lanzados'], ['fouls', 'Faltas']
]

const actionLabels = {
  goal: 'Gol', save: 'Parada', conceded: 'Gol recibido', outside: 'Fuera',
  seven_meter_goal: '7 m gol', seven_meter_save: '7 m parada', seven_meter_outside: '7 m fuera'
}

const zoneLabels = {
  'top-left': 'Arriba izquierda', 'top-center': 'Arriba centro', 'top-right': 'Arriba derecha',
  'middle-left': 'Centro izquierda', 'middle-center': 'Centro', 'middle-right': 'Centro derecha',
  'bottom-left': 'Abajo izquierda', 'bottom-center': 'Abajo centro', 'bottom-right': 'Abajo derecha', outside: 'Fuera'
}

const goalZones = Object.keys(zoneLabels).filter(zone => zone !== 'outside')

function formatDate(value) {
  return new Date(value).toLocaleDateString('es-ES')
}

function formatDuration(value) {
  const seconds = Math.max(0, Number(value || 0))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function playerName(player) {
  return `${player.nombre} ${player.apellidos || ''}`.trim()
}

export default function MatchStatistics() {
  const [matches, setMatches] = useState([])
  const [selectedMatchId, setSelectedMatchId] = useState('')
  const [data, setData] = useState(null)
  const [filters, setFilters] = useState({ player: '', action: '', zone: '', query: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    axios.get('/api/matches').then(response => {
      setMatches(response.data)
      if (response.data[0]) setSelectedMatchId(String(response.data[0].id))
    }).catch(() => setError('No se pudieron cargar los partidos.'))
  }, [])

  useEffect(() => {
    if (!selectedMatchId) return
    setData(null)
    axios.get(`/api/matches/${selectedMatchId}/statistics`).then(response => {
      setData(response.data)
      setError('')
    }).catch(errorResponse => setError(errorResponse.response?.data?.error || 'No se pudieron cargar las estadísticas.'))
  }, [selectedMatchId])

  const filteredEvents = useMemo(() => {
    if (!data) return []
    return data.events.filter(event =>
      (!filters.player || String(event.player_id) === filters.player) &&
      (!filters.action || event.action === filters.action) &&
      (!filters.zone || event.zone === filters.zone) &&
      (!filters.query || `${event.player_name} ${actionLabels[event.action] || event.action}`.toLocaleLowerCase('es').includes(filters.query.toLocaleLowerCase('es')))
    )
  }, [data, filters])

  const filteredPlayers = useMemo(() => {
    if (!data) return []
    return data.players.filter(player => !filters.player || String(player.id) === filters.player)
  }, [data, filters.player])

  const zoneStats = useMemo(() => {
    function buildStats(events, positiveActions) {
      return goalZones.map(zone => {
        const zoneEvents = events.filter(event => event.zone === zone)
        const positive = zoneEvents.filter(event => positiveActions.includes(event.action)).length
        return { zone, shots: zoneEvents.length, positive, ratio: zoneEvents.length ? positive / zoneEvents.length : 0 }
      })
    }
    return {
      attack: buildStats(filteredEvents.filter(event => ['goal', 'outside', 'seven_meter_goal', 'seven_meter_outside'].includes(event.action)), ['goal', 'seven_meter_goal']),
      own: buildStats(filteredEvents.filter(event => ['save', 'conceded', 'seven_meter_save'].includes(event.action)), ['save', 'seven_meter_save'])
    }
  }, [filteredEvents])

  function updateFilter(event) {
    setFilters(current => ({ ...current, [event.target.name]: event.target.value }))
  }

  return (
    <div className="container-fluid mt-4 pb-4">
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div><h2 className="mb-1">Estadísticas de partidos</h2><p className="text-muted mb-0">Rendimiento individual y acciones registradas durante el partido.</p></div>
        <i className="fa-solid fa-chart-line fs-2 text-primary" aria-hidden="true" />
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="card mb-3"><div className="card-body"><div className="row g-2 align-items-end">
        <div className="col-lg-5"><label className="form-label">Partido</label><select className="form-select" value={selectedMatchId} onChange={event => setSelectedMatchId(event.target.value)}><option value="">Selecciona un partido</option>{matches.map(match => <option key={match.id} value={match.id}>{formatDate(match.scheduled_at)} · {match.home_team_name} vs {match.visitor_name}</option>)}</select></div>
        <div className="col-lg-3"><label className="form-label">Jugador</label><select className="form-select" name="player" value={filters.player} onChange={updateFilter}><option value="">Todos</option>{data?.players.map(player => <option key={player.id} value={player.id}>{playerName(player)}</option>)}</select></div>
        <div className="col-lg-2"><label className="form-label">Acción</label><select className="form-select" name="action" value={filters.action} onChange={updateFilter}><option value="">Todas</option>{Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="col-lg-2"><label className="form-label">Buscar</label><input className="form-control" name="query" value={filters.query} onChange={updateFilter} placeholder="Jugador o acción" /></div>
      </div><div className="row g-2 mt-1"><div className="col-lg-3"><label className="form-label">Zona</label><select className="form-select" name="zone" value={filters.zone} onChange={updateFilter}><option value="">Todas</option>{[...new Set(data?.events.map(event => event.zone).filter(Boolean) || [])].map(zone => <option key={zone} value={zone}>{zone}</option>)}</select></div></div></div></div>
      {data && <>
        <div className="row g-3 mb-3"><div className="col-md-3"><div className="card h-100"><div className="card-body"><small className="text-muted">Marcador</small><div className="display-6 fw-bold">{data.summary.home_score} - {data.summary.visitor_score}</div><small>{data.match.home_team_name} · {data.match.visitor_name}</small></div></div></div><div className="col-md-3"><div className="card h-100"><div className="card-body"><small className="text-muted">Goles y lanzamientos</small><div className="display-6 fw-bold">{data.summary.goals}</div><small>{data.summary.shots} lanzamientos</small></div></div></div><div className="col-md-3"><div className="card h-100"><div className="card-body"><small className="text-muted">7 metros</small><div className="display-6 fw-bold">{data.summary.seven_meters}</div><small>lanzamientos</small></div></div></div><div className="col-md-3"><div className="card h-100"><div className="card-body"><small className="text-muted">Tiempo acumulado</small><div className="display-6 fw-bold">{formatDuration(data.summary.time_on_court_seconds)}</div><small>{data.players.length} jugadores</small></div></div></div></div>
        <div className="card mb-3"><div className="card-header d-flex justify-content-between"><strong>Rendimiento por jugador</strong><span className="text-muted small">{filteredPlayers.length} jugadores</span></div><div className="table-responsive"><table className="table table-sm table-bordered align-middle mb-0"><thead><tr><th>Jugador</th><th>Posición</th><th>Situación</th><th>Tiempo</th>{statColumns.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{filteredPlayers.map(player => <tr key={player.id}><td className="text-nowrap">{player.numero ? `#${player.numero} ` : ''}{playerName(player)}</td><td>{player.posicion || 'Sin posición'}</td><td>{player.on_court ? 'Pista' : 'Banquillo'}</td><td>{formatDuration(player.time_on_court_seconds)}</td>{statColumns.map(([field]) => <td key={field}>{player[field] || 0}</td>)}</tr>)}</tbody></table></div></div>
        <div className="row g-3 mb-3"><div className="col-xl-6"><div className="card h-100"><div className="card-header d-flex justify-content-between"><strong>Portería ajena</strong><span className="text-muted small">Tiros y goles</span></div><div className="card-body"><div className="goal-frame statistics-goal-frame"><div className="goal-grid statistics-goal-grid">{zoneStats.attack.map(({ zone, shots, positive, ratio }) => <div className={`statistics-goal-zone ${shots === 0 ? 'zone-neutral' : ratio > 0 ? 'zone-positive' : 'zone-negative'}`} key={zone}><strong>{zoneLabels[zone]}</strong><span><i className="fa-solid fa-bullseye" aria-hidden="true" /> {shots} tiros</span><span><i className="fa-solid fa-check" aria-hidden="true" /> {positive} goles</span><b>{Math.round(ratio * 100)}%</b></div>)}</div></div></div></div></div><div className="col-xl-6"><div className="card h-100"><div className="card-header d-flex justify-content-between"><strong>Portería propia</strong><span className="text-muted small">Paradas y goles recibidos</span></div><div className="card-body"><div className="goal-frame statistics-goal-frame"><div className="goal-grid statistics-goal-grid">{zoneStats.own.map(({ zone, shots, positive, ratio }) => <div className={`statistics-goal-zone ${shots === 0 ? 'zone-neutral' : ratio > 0 ? 'zone-positive' : 'zone-negative'}`} key={zone}><strong>{zoneLabels[zone]}</strong><span><i className="fa-solid fa-bullseye" aria-hidden="true" /> {shots} tiros</span><span><i className="fa-solid fa-shield-halved" aria-hidden="true" /> {positive} paradas</span><b>{Math.round(ratio * 100)}%</b></div>)}</div></div></div></div></div><div className="col-12"><div className="small text-muted text-center"><i className="fa-solid fa-circle-info me-1" aria-hidden="true" />Portería ajena: verde es gol. Portería propia: verde es parada y rojo es gol recibido. Gris: sin acciones.</div></div></div>
        <div className="card"><div className="card-header d-flex justify-content-between"><strong>Acciones registradas</strong><span className="text-muted small">{filteredEvents.length} resultados</span></div><div className="table-responsive"><table className="table table-sm table-hover align-middle mb-0"><thead><tr><th>Jugador</th><th>Acción</th><th>Zona</th><th>Minuto</th><th>Fecha</th></tr></thead><tbody>{filteredEvents.map(event => <tr key={`${event.action}-${event.id}`}><td>{event.player_name}</td><td>{actionLabels[event.action] || event.action}</td><td>{zoneLabels[event.zone] || event.zone || 'Sin zona'}</td><td>{event.minute || '-'}</td><td>{new Date(event.created_at).toLocaleString('es-ES')}</td></tr>)}{!filteredEvents.length && <tr><td colSpan="5" className="text-center text-muted py-3">No hay acciones para los filtros seleccionados.</td></tr>}</tbody></table></div></div>
      </>}
    </div>
  )
}
