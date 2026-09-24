import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const statColumns = [
  ['goals', 'Goles'], ['shots', 'Lanzamientos'], ['assists', 'Asistencias'], ['turnovers', 'Pérdidas'],
  ['steals', 'Robos'], ['saves', 'Paradas'], ['goals_conceded', 'Goles recibidos'], ['blocks', 'Bloqueos'],
  ['exclusions_2min', 'Exclusiones'], ['yellow_cards', 'Amarillas'], ['red_cards', 'Rojas'], ['blue_cards', 'Azules'],
  ['seven_meters_scored', '7 m marcados'], ['seven_meters_attempted', '7 m lanzados'], ['seven_meters_received', '7 m recibidos'],
  ['seven_meters_saved', '7 m parados'], ['fouls', 'Faltas']
]

const zones = [
  ['top-left', 'Arriba izquierda'], ['top-center', 'Arriba centro'], ['top-right', 'Arriba derecha'],
  ['middle-left', 'Centro izquierda'], ['middle-center', 'Centro'], ['middle-right', 'Centro derecha'],
  ['bottom-left', 'Abajo izquierda'], ['bottom-center', 'Abajo centro'], ['bottom-right', 'Abajo derecha']
]

const fieldGoalActions = new Set(['goal', 'seven_meter_goal'])
const goalkeeperGoalActions = new Set(['conceded', 'seven_meter_goal'])
const goalkeeperSaveActions = new Set(['save', 'seven_meter_save'])

function formatDuration(value) {
  const seconds = Math.max(0, Number(value || 0))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function playerName(player) {
  return `${player.nombre} ${player.apellidos || ''}`.trim()
}

function averageDuration(player) {
  const matches = Number(player.matches || 0)
  return formatDuration(matches ? Number(player.time_on_court_seconds || 0) / matches : 0)
}

function isGoalkeeper(player) {
  return player.posicion === 'Portero'
}

export default function PlayerStatsModal({ player, teams, onClose }) {
  const [filters, setFilters] = useState({ teamId: '', category: '', from: '', to: '' })
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const availableTeams = useMemo(() => {
    if (Array.isArray(player.teams)) return player.teams
    return teams.filter(team => (player.team_ids || []).includes(team.id))
  }, [player, teams])
  const availableCategories = useMemo(() => {
    const selectedTeam = availableTeams.find(team => String(team.id) === filters.teamId)
    const categoryTeams = selectedTeam ? [selectedTeam] : availableTeams
    return [...new Set(categoryTeams.map(team => team.category).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'es'))
  }, [availableTeams, filters.teamId])

  useEffect(() => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value) })
    setData(null)
    setError('')
    axios.get(`/api/players/${player.id}/statistics?${params.toString()}`)
      .then(response => setData({ ...response.data.player, events: response.data.events || [] }))
      .catch(response => setError(response.response?.data?.error || 'No se pudieron cargar las estadísticas acumuladas.'))
  }, [filters, player.id])

  function updateFilter(event) {
    const { name, value } = event.target
    setFilters(current => ({ ...current, [name]: value, ...(name === 'teamId' ? { category: '' } : {}) }))
  }

  return <>
    <div className="modal fade show d-block" tabIndex={-1} onClick={onClose}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable" onClick={event => event.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <div><h5 className="modal-title">Estadísticas acumuladas</h5><div className="small text-muted">{playerName(player)}</div></div>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Cerrar" title="Cerrar" />
          </div>
          <div className="modal-body">
            <div className="row g-2 mb-3">
              <div className="col-md-6 col-lg-3"><label className="form-label mb-1">Equipo</label><select className="form-select" name="teamId" value={filters.teamId} onChange={updateFilter}><option value="">Todos los equipos</option>{availableTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></div>
              <div className="col-md-6 col-lg-3"><label className="form-label mb-1">Categoría</label><select className="form-select" name="category" value={filters.category} onChange={updateFilter}><option value="">Todas las categorías</option>{availableCategories.map(category => <option key={category} value={category}>{category}</option>)}</select></div>
              <div className="col-md-6 col-lg-3"><label className="form-label mb-1">Desde</label><input className="form-control" type="date" name="from" value={filters.from} onChange={updateFilter} /></div>
              <div className="col-md-6 col-lg-3"><label className="form-label mb-1">Hasta</label><input className="form-control" type="date" name="to" value={filters.to} onChange={updateFilter} /></div>
            </div>
            {error && <div className="alert alert-danger">{error}</div>}
            {!data && !error && <div className="text-center text-muted py-4">Cargando estadísticas...</div>}
            {data && <>
              <div className="row g-3 mb-3">
                <div className="col-sm-4"><div className="card h-100"><div className="card-body"><small className="text-muted">Partidos</small><div className="display-6 fw-bold">{data.matches}</div></div></div></div>
                <div className="col-sm-4"><div className="card h-100"><div className="card-body"><small className="text-muted">Tiempo medio por partido</small><div className="display-6 fw-bold">{averageDuration(data)}</div></div></div></div>
                <div className="col-sm-4"><div className="card h-100"><div className="card-body"><small className="text-muted">Posición</small><div className="fs-4 fw-bold">{data.posicion || '-'}</div></div></div></div>
              </div>
              <div className="card mb-3">
                <div className="card-header"><strong>{isGoalkeeper(data) ? 'Lanzamientos recibidos en portería' : 'Lanzamientos y goles marcados'}</strong></div>
                <div className="card-body">
                  <div className="goal-frame statistics-goal-frame">
                    <div className="goal-grid statistics-goal-grid">
                      {zones.map(([zone, label]) => {
                        const zoneEvents = (data.events || []).filter(event => event.zone === zone)
                        const goalkeeper = isGoalkeeper(data)
                        const goals = zoneEvents.filter(event => (goalkeeper ? goalkeeperGoalActions : fieldGoalActions).has(event.action)).length
                        const saves = zoneEvents.filter(event => goalkeeperSaveActions.has(event.action)).length
                        const positiveActions = goalkeeper ? saves : goals
                        const positive = zoneEvents.length > 0 && positiveActions / zoneEvents.length > 0.5
                        const effectiveness = zoneEvents.length ? Math.round((positiveActions / zoneEvents.length) * 100) : 0
                        return <div className={`statistics-goal-zone ${zoneEvents.length ? (positive ? 'zone-positive' : 'zone-negative') : 'zone-neutral'}`} key={zone}>
                          <strong>{label}</strong>
                          <span><i className={`fa-solid ${goalkeeper ? 'fa-shield-halved' : 'fa-futbol'}`} aria-hidden="true" /> {positiveActions}/{zoneEvents.length} · {effectiveness}%</span>
                        </div>
                      })}
                    </div>
                  </div>
                </div>
              </div>
              <div className="table-responsive"><table className="table table-sm table-bordered align-middle mb-0 statistics-table"><thead><tr>{statColumns.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead><tbody><tr>{statColumns.map(([field]) => <td key={field}>{data[field] || 0}</td>)}</tr></tbody></table></div>
            </>}
          </div>
        </div>
      </div>
    </div>
    <div className="modal-backdrop fade show" />
  </>
}
