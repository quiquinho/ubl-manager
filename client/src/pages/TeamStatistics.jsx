import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const statGroups = [
  ['Ataque', 'statistics-group-attack', [['goal_ratio', 'Goles/Lanz.'], ['goal_effectiveness', '% efectividad'], ['turnovers', 'Perdidas']]],
  ['Defensa', 'statistics-group-defense', [['goalkeeper_ratio', 'Paradas/Lanz.'], ['goalkeeper_effectiveness', '% efectividad'], ['blocks', 'Bloqueos'], ['steals', 'Recuperaciones']]],
  ['Sanciones', 'statistics-group-sanctions', [['exclusions_2min', 'Exclusiones'], ['fouls', 'Faltas']]],
  ['7 metros', 'statistics-group-attack', [['seven_meters_for', 'A favor'], ['seven_meters_against', 'En contra']]]
]
const statColumns = statGroups.flatMap(([, , columns]) => columns)
const numericStatFields = ['goals', 'shots', 'turnovers', 'steals', 'saves', 'goals_conceded', 'blocks', 'exclusions_2min', 'fouls', 'seven_meters_scored', 'seven_meters_attempted', 'seven_meters_received', 'seven_meters_saved']

function formatDuration(value) {
  const seconds = Math.max(0, Math.round(Number(value || 0)))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function formatPerMatchDuration(value, matches) {
  return formatDuration(Number(matches || 0) ? Number(value || 0) / Number(matches) : 0)
}

function playerName(player) {
  return `${player.nombre} ${player.apellidos || ''}`.trim()
}

function statValue(player, field) {
  const shots = Number(player.shots || 0)
  if (field === 'goal_ratio') return `${Number(player.goals || 0)}/${shots}`
  if (field === 'goal_effectiveness') return `${shots ? Math.round(Number(player.goals || 0) / shots * 100) : 0}%`
  const goalkeeperLaunches = Number(player.saves || 0) + Number(player.goals_conceded || 0)
  if (field === 'goalkeeper_ratio') return `${Number(player.saves || 0)}/${goalkeeperLaunches}`
  if (field === 'goalkeeper_effectiveness') return `${goalkeeperLaunches ? Math.round(Number(player.saves || 0) / goalkeeperLaunches * 100) : 0}%`
  if (field === 'seven_meters_for') return `${Number(player.seven_meters_scored || 0)}/${Number(player.seven_meters_attempted || 0)}`
  if (field === 'seven_meters_against') return `${Number(player.seven_meters_saved || 0)}/${Number(player.seven_meters_received || 0)}`
  return Number(player[field] || 0)
}

function statSortValue(player, field) {
  const shots = Number(player.shots || 0)
  if (field === 'goal_ratio' || field === 'goal_effectiveness') return shots ? Number(player.goals || 0) / shots : 0
  const goalkeeperLaunches = Number(player.saves || 0) + Number(player.goals_conceded || 0)
  if (field === 'goalkeeper_ratio' || field === 'goalkeeper_effectiveness') return goalkeeperLaunches ? Number(player.saves || 0) / goalkeeperLaunches : 0
  if (field === 'seven_meters_for') return Number(player.seven_meters_scored || 0) / Number(player.seven_meters_attempted || 1)
  if (field === 'seven_meters_against') return Number(player.seven_meters_saved || 0) / Number(player.seven_meters_received || 1)
  return Number(player[field] || 0)
}

export default function TeamStatistics() {
  const [teams, setTeams] = useState([])
  const [filters, setFilters] = useState({ teamId: '', from: '', to: '' })
  const [sort, setSort] = useState({ field: 'numero', direction: 'asc' })
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    axios.get('/api/teams').then(response => setTeams(response.data)).catch(() => setError('No se pudieron cargar los equipos.'))
  }, [])

  useEffect(() => {
    if (!filters.teamId) { setData(null); return }
    const params = new URLSearchParams({ from: filters.from, to: filters.to })
    setData(null)
    axios.get(`/api/teams/${filters.teamId}/statistics?${params}`).then(response => { setData(response.data); setError('') }).catch(response => setError(response.response?.data?.error || 'No se pudieron cargar las estadísticas.'))
  }, [filters.teamId, filters.from, filters.to])

  const sortedPlayers = useMemo(() => {
    if (!data) return []
    return [...data.players].sort((left, right) => {
      const leftValue = sort.field === 'numero'
        ? (left.numero == null ? Number.MAX_SAFE_INTEGER : Number(left.numero))
        : sort.field === 'time_on_court_seconds'
        ? Number(left.time_on_court_seconds || 0) / Number(left.matches || 1)
        : sort.field === 'matches' ? Number(left.matches || 0) : statSortValue(left, sort.field)
      const rightValue = sort.field === 'numero'
        ? (right.numero == null ? Number.MAX_SAFE_INTEGER : Number(right.numero))
        : sort.field === 'time_on_court_seconds'
        ? Number(right.time_on_court_seconds || 0) / Number(right.matches || 1)
        : sort.field === 'matches' ? Number(right.matches || 0) : statSortValue(right, sort.field)
      if (leftValue !== rightValue) return sort.direction === 'asc' ? leftValue - rightValue : rightValue - leftValue
      return playerName(left).localeCompare(playerName(right), 'es')
    })
  }, [data, sort])

  const totals = useMemo(() => data?.players.reduce((result, player) => {
    result.time_on_court_seconds += Number(player.time_on_court_seconds || 0)
    numericStatFields.forEach(field => { result[field] += Number(player[field] || 0) })
    return result
  }, Object.fromEntries([['time_on_court_seconds', 0], ...numericStatFields.map(field => [field, 0])])) || null, [data])

  function updateFilter(event) {
    setFilters(current => ({ ...current, [event.target.name]: event.target.value }))
  }

  function changeSort(field) {
    setSort(current => current.field === field
      ? { field, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { field, direction: 'desc' })
  }

  function sortIndicator(field) {
    return sort.field === field ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''
  }

  function sortHeader(field, label) {
    return <button type="button" className="btn btn-link p-0 text-dark text-nowrap" onClick={() => changeSort(field)}>{label}{sortIndicator(field)}</button>
  }

  return <div className="container-fluid mt-4 pb-4">
    <div className="d-flex justify-content-between align-items-start mb-3"><div><h2 className="mb-1">Estadísticas de equipos</h2><p className="text-muted mb-0">Acumulado por equipo y jugador en los partidos disputados.</p></div><i className="fa-solid fa-chart-column fs-2 text-primary" aria-hidden="true" /></div>
    {error && <div className="alert alert-danger">{error}</div>}
    <div className="card mb-3"><div className="card-body"><div className="row g-2 align-items-end">
      <div className="col-lg-4"><label className="form-label">Equipo <span className="text-danger">*</span></label><select className="form-select" name="teamId" value={filters.teamId} onChange={updateFilter}><option value="">Selecciona un equipo</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name} · {team.category}</option>)}</select></div>
      <div className="col-lg-2"><label className="form-label">Desde</label><input className="form-control" type="date" name="from" value={filters.from} onChange={updateFilter} /></div>
      <div className="col-lg-2"><label className="form-label">Hasta</label><input className="form-control" type="date" name="to" value={filters.to} onChange={updateFilter} /></div>
    </div></div></div>
    {!filters.teamId && <div className="alert alert-info">Selecciona un equipo para consultar sus estadísticas.</div>}
    {data && <div className="card"><div className="card-header d-flex justify-content-between align-items-center"><strong>{data.team.name} · Estadísticas acumuladas</strong><span className="text-muted small">{data.players.length} jugadores · {data.summary.matches} partidos</span></div><div className="table-responsive"><table className="table table-sm table-bordered align-middle mb-0 statistics-table"><thead><tr><th rowSpan="2">{sortHeader('numero', 'Número')}</th><th rowSpan="2">Jugador</th><th rowSpan="2">{sortHeader('matches', 'Partidos')}</th><th rowSpan="2">{sortHeader('time_on_court_seconds', 'Tiempo/partido')}</th>{statGroups.map(([label, className, columns]) => <th className={className} colSpan={columns.length} key={label}>{label}</th>)}</tr><tr>{statColumns.map(([field, label]) => <th key={field}>{sortHeader(field, label)}</th>)}</tr></thead><tbody>{sortedPlayers.map(player => <tr key={player.id}><td>{player.numero || '-'}</td><td className="text-nowrap">{playerName(player)}</td><td>{player.matches}</td><td>{formatPerMatchDuration(player.time_on_court_seconds, player.matches)}</td>{statColumns.map(([field]) => <td key={field}>{statValue(player, field)}</td>)}</tr>)}{!sortedPlayers.length && <tr><td colSpan={4 + statColumns.length} className="text-center text-muted py-3">No hay estadísticas para los filtros seleccionados.</td></tr>}<tr className="table-light"><th>-</th><th>Acumulado</th><th>{data.summary.matches}</th><th>{formatPerMatchDuration(totals.time_on_court_seconds, data.summary.matches)}</th>{statColumns.map(([field]) => <th key={field}>{statValue(totals, field)}</th>)}</tr></tbody></table></div></div>}
  </div>
}