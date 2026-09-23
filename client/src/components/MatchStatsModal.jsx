import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const statColumns = [
  ['goals', 'Goles'], ['shots', 'Lanzamientos'], ['assists', 'Asistencias'], ['turnovers', 'Perdidas'],
  ['steals', 'Robos'], ['saves', 'Paradas'], ['goals_conceded', 'Goles recibidos'], ['blocks', 'Bloqueos'],
  ['exclusions_2min', 'Exclusiones'], ['yellow_cards', 'Amarillas'], ['red_cards', 'Rojas'], ['blue_cards', 'Azules'],
  ['seven_meters_scored', '7 m marcados'], ['seven_meters_attempted', '7 m lanzados'], ['seven_meters_received', '7 m recibidos'],
  ['seven_meters_saved', '7 m parados'], ['fouls', 'Faltas']
]

const zoneLabels = {
  'top-left': 'Arriba izquierda', 'top-center': 'Arriba centro', 'top-right': 'Arriba derecha',
  'middle-left': 'Centro izquierda', 'middle-center': 'Centro', 'middle-right': 'Centro derecha',
  'bottom-left': 'Abajo izquierda', 'bottom-center': 'Abajo centro', 'bottom-right': 'Abajo derecha'
}

const zones = Object.keys(zoneLabels)
const playerName = player => `${player.nombre} ${player.apellidos || ''}`.trim()
const formatDuration = value => `${String(Math.floor(Number(value || 0) / 60)).padStart(2, '0')}:${String(Number(value || 0) % 60).padStart(2, '0')}`

function ZoneSummary({ events, title, positiveActions, icon }) {
  return (
    <div className="col-xl-6">
      <div className="card h-100">
        <div className="card-header"><strong>{title}</strong></div>
        <div className="card-body">
          <div className="goal-frame statistics-goal-frame">
            <div className="goal-grid statistics-goal-grid">
              {zones.map(zone => {
                const zoneEvents = events.filter(event => event.zone === zone)
                const positive = zoneEvents.filter(event => positiveActions.includes(event.action)).length
                return <div className={`statistics-goal-zone ${!zoneEvents.length ? 'zone-neutral' : positive ? 'zone-positive' : 'zone-negative'}`} key={zone}>
                  <strong>{zoneLabels[zone]}</strong>
                  <span><i className="fa-solid fa-bullseye" aria-hidden="true" /> {zoneEvents.length} acciones</span>
                  <span><i className={`fa-solid ${icon}`} aria-hidden="true" /> {positive} positivas</span>
                </div>
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MatchStatsModal({ matchId, matchLabel, onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [tableFilter, setTableFilter] = useState('')
  const [sort, setSort] = useState({ field: 'nombre', direction: 'asc' })

  useEffect(() => {
    axios.get(`/api/matches/${matchId}/statistics?_=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } })
      .then(async response => {
        const statsData = response.data
        if (statsData.players.some(player => player.photo_data || player.photo_url)) {
          setData(statsData)
          return
        }
        const followUpResponse = await axios.get(`/api/matches/${matchId}/follow-up?_=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } })
        const photosByPlayer = new Map(followUpResponse.data.players.map(player => [player.id, { photo_data: player.photo_data, photo_url: player.photo_url }]))
        setData({ ...statsData, players: statsData.players.map(player => ({ ...player, ...(photosByPlayer.get(player.id) || {}) })) })
      })
      .catch(response => setError(response.response?.data?.error || 'No se pudieron cargar las estadisticas del partido.'))
  }, [matchId])

  const filteredPlayers = useMemo(() => {
    if (!data) return []
    const query = tableFilter.trim().toLocaleLowerCase('es')
    return data.players
      .filter(player => !query || playerName(player).toLocaleLowerCase('es').includes(query) || String(player.numero || '').includes(query))
      .sort((left, right) => {
        const leftValue = sort.field === 'nombre' ? playerName(left) : Number(left[sort.field] || 0)
        const rightValue = sort.field === 'nombre' ? playerName(right) : Number(right[sort.field] || 0)
        const comparison = typeof leftValue === 'string' ? leftValue.localeCompare(rightValue, 'es') : leftValue - rightValue
        return sort.direction === 'asc' ? comparison : -comparison
      })
  }, [data, tableFilter, sort])

  const teamTotals = useMemo(() => {
    return statColumns.map(([field, label]) => [field, label, filteredPlayers.reduce((total, player) => total + Number(player[field] || 0), 0)])
  }, [filteredPlayers])
  const filteredTime = filteredPlayers.reduce((total, player) => total + Number(player.time_on_court_seconds || 0), 0)

  function changeSort(field) {
    setSort(current => current.field === field
      ? { field, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { field, direction: 'desc' })
  }

  function sortIndicator(field) {
    return sort.field === field ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''
  }

  function exportCsv() {
    if (!data) return
    const headers = ['Jugador', 'Tiempo', ...statColumns.map(([, label]) => label)]
    const rows = filteredPlayers.map(player => [playerName(player), formatDuration(player.time_on_court_seconds), ...statColumns.map(([field]) => player[field] || 0)])
    const csv = [headers, ...rows].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\r\n')
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `estadisticas-${matchId}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function exportExcel() {
    if (!data) return
    const escapeHtml = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
    const visibleIds = new Set(filteredPlayers.map(player => player.id))
    const exportEvents = data.events.filter(event => visibleIds.has(event.player_id))
    const buildQuadrantTable = (events, positiveActions) => zones.map(zone => {
      const zoneEvents = events.filter(event => event.zone === zone)
      const positive = zoneEvents.filter(event => positiveActions.includes(event.action)).length
      const tone = !zoneEvents.length ? '#e9ecef' : positive ? '#d1e7dd' : '#f8d7da'
      return `<td style="background:${tone};border:1px solid #777;padding:12px;text-align:center"><strong>${escapeHtml(zoneLabels[zone])}</strong><br>${zoneEvents.length} acciones<br>${positive} positivas</td>`
    }).reduce((rows, cell, index) => { const row = Math.floor(index / 3); rows[row] = `${rows[row] || ''}${cell}`; return rows }, []).map(row => `<tr>${row}</tr>`).join('')
    const playerRows = filteredPlayers.map(player => `<tr><td>${escapeHtml(playerName(player))}</td><td>${formatDuration(player.time_on_court_seconds)}</td>${statColumns.map(([field]) => `<td>${player[field] || 0}</td>`).join('')}</tr>`).join('')
    const headers = statColumns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join('')
    const html = `<html><head><meta charset="utf-8"><style>body{font-family:Arial;color:#222}table{border-collapse:collapse;margin:12px 0}th,td{border:1px solid #aaa;padding:6px}th{background:#d9eaf7}.chart td{width:150px;height:70px}</style></head><body>
      <h1>Estadisticas ${escapeHtml(matchLabel)}</h1><h2>Resumen</h2><p>Marcador: ${data.summary.home_score} - ${data.summary.visitor_score}</p>
      <h2>Acumulado y jugadores</h2><table><tr><th>Jugador</th><th>Tiempo</th>${headers}</tr><tr><th>Acumulado</th><th>${formatDuration(filteredTime)}</th>${teamTotals.map(([, , value]) => `<th>${value}</th>`).join('')}</tr>${playerRows}</table>
      <h2>Goles marcados por cuadrante</h2><table class="chart">${buildQuadrantTable(exportEvents.filter(event => ['goal', 'outside', 'seven_meter_goal', 'seven_meter_outside'].includes(event.action)), ['goal', 'seven_meter_goal'])}</table>
      <h2>Goles recibidos y paradas por cuadrante</h2><table class="chart">${buildQuadrantTable(exportEvents.filter(event => ['save', 'conceded', 'seven_meter_save'].includes(event.action)), ['save', 'seven_meter_save'])}</table>
      </body></html>`
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `estadisticas-${matchId}.xls`
    link.click()
    URL.revokeObjectURL(url)
  }

  const attackEvents = data?.events.filter(event => ['goal', 'outside', 'seven_meter_goal', 'seven_meter_outside'].includes(event.action)) || []
  const defenseEvents = data?.events.filter(event => ['save', 'conceded', 'seven_meter_save'].includes(event.action)) || []

  return <>
    <div className="modal fade show d-block" tabIndex={-1} onClick={onClose}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable" onClick={event => event.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <div><h5 className="modal-title">Estadisticas del partido</h5><div className="small text-muted">{matchLabel}</div></div>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Cerrar" title="Cerrar" />
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            {!data && !error && <div className="text-center text-muted py-4">Cargando estadisticas...</div>}
            {data && <>
              <div className="row g-3 mb-3">
                <div className="col-md-4"><div className="card h-100"><div className="card-body"><small className="text-muted">Marcador</small><div className="display-6 fw-bold">{data.summary.home_score} - {data.summary.visitor_score}</div><small>{data.match.home_team_name} · {data.match.visitor_name}</small></div></div></div>
                <div className="col-md-4"><div className="card h-100"><div className="card-body"><small className="text-muted">Equipo local</small><div className="small">{data.match.home_team_name}</div><div className="fw-bold">{data.summary.goals} goles</div></div></div></div>
                <div className="col-md-4"><div className="card h-100"><div className="card-body"><small className="text-muted">Equipo visitante</small><div className="small">{data.match.visitor_name}</div><div className="fw-bold">{data.summary.visitor_score} goles recibidos</div></div></div></div>
              </div>
              <div className="card mb-3">
                <div className="card-header d-flex flex-wrap gap-2 justify-content-between align-items-center">
                  <strong>Acumulado del equipo y detalle por jugador</strong>
                  <div className="d-flex gap-2">
                    <input className="form-control form-control-sm" value={tableFilter} onChange={event => setTableFilter(event.target.value)} placeholder="Buscar jugador..." aria-label="Filtrar jugadores" />
                    <button type="button" className="btn btn-sm btn-outline-success text-nowrap" onClick={exportExcel} aria-label="Exportar estadísticas a Excel" title="Exportar estadísticas a Excel"><i className="fa-solid fa-file-excel me-1" aria-hidden="true" />Excel</button>
                    <button type="button" className="btn btn-sm btn-outline-success text-nowrap" onClick={exportCsv} aria-label="Exportar estadísticas a CSV" title="Exportar estadísticas a CSV"><i className="fa-solid fa-file-csv me-1" aria-hidden="true" />Exportar</button>
                  </div>
                </div>
                <div className="table-responsive"><table className="table table-sm table-bordered align-middle mb-0 statistics-table"><thead><tr><th>Foto</th><th>Jugador</th><th>Tiempo</th>{statColumns.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>
                  <tr className="table-light"><th>Acumulado</th><th>-</th><th>{formatDuration(filteredTime)}</th>{teamTotals.map(([field, label, value]) => <th key={field}>{value}</th>)}</tr>
                  <tr className="statistics-sort-row"><th></th><th><button type="button" className="btn btn-link p-0 text-dark" onClick={() => changeSort('nombre')}>Jugador{sortIndicator('nombre')}</button></th><th><button type="button" className="btn btn-link p-0 text-dark" onClick={() => changeSort('time_on_court_seconds')}>Tiempo{sortIndicator('time_on_court_seconds')}</button></th>{statColumns.map(([field, label]) => <th key={field}><button type="button" className="btn btn-link p-0 text-dark" onClick={() => changeSort(field)}>{label}{sortIndicator(field)}</button></th>)}</tr>
                  {filteredPlayers.map(player => <tr key={player.id}><td><span className="match-stats-player-photo">{player.photo_data || player.photo_url ? <img src={player.photo_data || player.photo_url} alt={playerName(player)} /> : <i className="fa-solid fa-user" aria-hidden="true" />}</span></td><td className="text-nowrap">{player.numero ? `#${player.numero} ` : ''}{playerName(player)}</td><td>{formatDuration(player.time_on_court_seconds)}</td>{statColumns.map(([field]) => <td key={field}>{player[field] || 0}</td>)}</tr>)}
                </tbody></table></div>
              </div>
              <div className="row g-3"><ZoneSummary events={attackEvents} title="Goles marcados por cuadrante" positiveActions={['goal', 'seven_meter_goal']} icon="fa-check" /><ZoneSummary events={defenseEvents} title="Goles recibidos y paradas por cuadrante" positiveActions={['save', 'seven_meter_save']} icon="fa-shield-halved" /></div>
            </>}
          </div>
        </div>
      </div>
    </div>
    <div className="modal-backdrop fade show" />
  </>
}
