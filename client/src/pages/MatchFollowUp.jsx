import React, { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";

const statistics = [
  ["goals", "Goles"],
  ["shots", "Lanzamientos"],
  ["assists", "Asistencias"],
  ["turnovers", "Pérdidas"],
  ["steals", "Robos"],
  ["saves", "Paradas"],
  ["goals_conceded", "Goles recibidos"],
  ["blocks", "Bloqueos"],
  ["exclusions_2min", "Exclusiones 2 min"],
  ["yellow_cards", "Tarjetas amarillas"],
  ["red_cards", "Expulsiones"],
  ["blue_cards", "Tarjetas azules"],
  ["seven_meters", "7 m OK/total"],
  ["seven_meters_received", "7 m recibidos"],
  ["seven_meters_saved", "7m parado/total"],
  ["fouls", "Faltas"],
];

const statisticGroups = [
  {
    key: "attack",
    label: "Ataque",
    fields: ["goals", "shots", "assists", "turnovers", "seven_meters"],
  },
  {
    key: "defense",
    label: "Defensa",
    fields: ["steals", "saves", "goals_conceded", "blocks", "seven_meters_received", "seven_meters_saved"],
  },
  {
    key: "sanctions",
    label: "Sanciones",
    fields: ["exclusions_2min", "yellow_cards", "red_cards", "blue_cards", "fouls"],
  },
];

const shotZones = [
  ["top-left", "Cuadrante arriba izquierda"],
  ["top-center", "Cuadrante arriba centro"],
  ["top-right", "Cuadrante arriba derecha"],
  ["middle-left", "Cuadrante centro izquierda"],
  ["middle-center", "Cuadrante central"],
  ["middle-right", "Cuadrante centro derecha"],
  ["bottom-left", "Cuadrante abajo izquierda"],
  ["bottom-center", "Cuadrante abajo centro"],
  ["bottom-right", "Cuadrante abajo derecha"],
];

const goalkeeperStatistics = new Set([
  "saves",
  "goals_conceded",
  "assists",
  "turnovers",
  "steals",
  "blocks",
  "exclusions_2min",
  "yellow_cards",
  "red_cards",
  "blue_cards",
  "seven_meters_received",
  "seven_meters_saved",
  "fouls",
]);

function isGoalkeeper(player) {
  return String(player.posicion || "")
    .toLocaleLowerCase("es")
    .includes("portero");
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds || 0));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function secondsSinceDate(value, now = Date.now()) {
  if (!value) return 0;
  return Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000));
}

function periodEndStatus(period, periods) {
  return period === `${periods}/${periods}` ? "Finalizado" : "Descanso";
}

function PlayerCircle({ player, selected, onClick, onPhotoClick, compact = false, bench = false }) {
  const name = `${player.nombre} ${player.apellidos || ""}`.trim();
  return (
    <button
      type="button"
      className={`player-circle ${compact ? "player-circle-compact" : ""} ${selected ? "is-selected" : ""}`}
      onClick={onClick}
      aria-label={`Seleccionar estadísticas de ${name}`}
      title={`Ver estadísticas de ${name}`}
    >
      <span
        className="player-circle-photo"
        onClick={(event) => {
          event.stopPropagation();
          onPhotoClick?.(player);
        }}
      >
        {player.photo_data || player.photo_url ? (
          <img src={player.photo_data || player.photo_url} alt={name} />
        ) : player.numero ? (
          <span className="player-circle-fallback-number">{player.numero}</span>
        ) : (
          <i className="fa-solid fa-user" aria-hidden="true" />
        )}
        {!compact && player.numero && <span className="player-circle-number">{player.numero}</span>}
      </span>
      {bench && <span className="bench-chair" aria-hidden="true" />}
      <span className="player-circle-label">{name}</span>
    </button>
  );
}

function StatControl({ player, field, label, onChange, onShot, onSevenMeter }) {
  if (field === "seven_meters") {
    return (
      <button type="button" className="btn btn-sm btn-outline-primary text-nowrap" onClick={() => onSevenMeter(player)} aria-label="Registrar lanzamiento de 7 metros" title="Registrar lanzamiento de 7 metros">
        <span className="badge text-bg-light border">
          {player.seven_meters_scored || 0}/{player.seven_meters_attempted || 0}
        </span>
      </button>
    );
  }
  if (field === "goals" || field === "saves" || field === "goals_conceded") {
    const eventType =
      field === "goals" ? "goal" : field === "saves" ? "save" : "conceded";
    return (
      <button
        type="button"
        className="btn btn-sm btn-outline-primary text-nowrap"
        onClick={() => onShot(player, eventType)}
        aria-label={`Registrar ${label}`}
        title={`Registrar ${label}`}
      >
        <i
          className={`fa-solid ${eventType === "goal" ? "fa-bullseye" : "fa-shield-halved"} me-1`}
          aria-hidden="true"
        />
        {player[field] || 0}
      </button>
    );
  }
  return (
    <div className="d-flex align-items-center gap-1">
      <span className="badge text-bg-light border">{player[field] || 0}</span>
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary py-0 px-1"
        onClick={() => onChange(player, field, -1)}
        aria-label={`Restar ${label}`}
        title={`Restar ${label}`}
      >
        <i className="fa-solid fa-minus" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="btn btn-sm btn-outline-primary py-0 px-1"
        onClick={() => onChange(player, field, 1)}
        aria-label={`Añadir ${label}`}
        title={`Añadir ${label}`}
      >
        <i className="fa-solid fa-plus" aria-hidden="true" />
      </button>
    </div>
  );
}

function PlayerStatsContextMenu({ onSelect }) {
  return (
    <div className="player-stats-context-menu" role="menu" aria-label="Grupo de estadísticas">
      {statisticGroups.map((group) => (
        <button
          type="button"
          key={group.key}
          className={`context-menu-${group.key}`}
          onClick={() => onSelect(group.key)}
          role="menuitem"
        >
          {group.label}
        </button>
      ))}
    </div>
  );
}

export default function MatchFollowUp() {
  const matchId = new URLSearchParams(window.location.search).get("matchId");
  const [matches, setMatches] = useState([]);
  const [followUp, setFollowUp] = useState(null);
  const [shotModal, setShotModal] = useState({
    show: false,
    player: null,
    eventType: "goal",
  });
  const [sevenMeterModal, setSevenMeterModal] = useState({
    show: false,
    player: null,
    outcome: "goal",
  });
  const [statsContextPlayer, setStatsContextPlayer] = useState(null);
  const [statsModal, setStatsModal] = useState({
    show: false,
    player: null,
    group: "attack",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [clockSeconds, setClockSeconds] = useState(0);
  const [courtClock, setCourtClock] = useState(() => Date.now());
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [editingClock, setEditingClock] = useState(false);
  const [clockInput, setClockInput] = useState('00:00');

  useEffect(() => {
    if (matchId) loadFollowUp();
    else
      axios
        .get("/api/matches")
        .then((response) => setMatches(response.data))
        .catch(() => setError("No se pudieron cargar los partidos."));
  }, [matchId]);

  async function loadFollowUp() {
    try {
      const response = await axios.get(`/api/matches/${matchId}/follow-up`);
      setFollowUp(response.data);
      setClockSeconds(0);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.error || "No se pudo cargar el seguimiento.",
      );
    }
  }

  useEffect(() => {
    if (!followUp || followUp.tracking.match_status !== "En juego")
      return undefined;
    const interval = window.setInterval(
      () => {
        setClockSeconds((seconds) => seconds + 1);
        setCourtClock(Date.now());
      },
      1000,
    );
    return () => window.clearInterval(interval);
  }, [followUp?.tracking?.match_status, followUp?.tracking?.elapsed_seconds]);

  async function saveTracking(changes) {
    const tracking = { ...followUp.tracking, ...changes };
    if (changes.elapsed_seconds === undefined && followUp.tracking.match_status === "En juego") {
      tracking.elapsed_seconds = Number(followUp.tracking.elapsed_seconds || 0) + clockSeconds;
    }
    setFollowUp((current) => ({ ...current, tracking }));
    setSaving(true);
    try {
      const response = await axios.put(`/api/matches/${matchId}/follow-up`, tracking);
      setFollowUp((current) => ({ ...current, tracking: response.data }));
      setClockSeconds(0);
      setCourtClock(Date.now());
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "No se pudo guardar el estado del partido.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(status) {
    if (status === "No iniciado") {
      const hasStarted = followUp.tracking.match_status !== "No iniciado" || Number(followUp.tracking.elapsed_seconds || 0) > 0;
      if (hasStarted) {
        const confirmation = await Swal.fire({
          icon: "warning",
          title: "¿Reiniciar el partido?",
          text: "El reloj volverá a 0:00 y se detendrá el partido.",
          showCancelButton: true,
          confirmButtonText: "Sí, reiniciar",
          cancelButtonText: "Cancelar",
          confirmButtonColor: "#dc3545",
        });
        if (!confirmation.isConfirmed) return;
      }
      await saveTracking({ match_status: "No iniciado", elapsed_seconds: 0 });
      return;
    }
    await saveTracking({ match_status: status });
  }

  async function handlePeriodChange(period) {
    const nextStatus = period === "Descanso"
      ? "Descanso"
      : followUp.tracking.match_status === "Descanso"
        ? "En juego"
        : followUp.tracking.match_status;
    await saveTracking({ period, match_status: nextStatus, elapsed_seconds: 0 });
  }

  useEffect(() => {
    if (!followUp || followUp.tracking.match_status !== "En juego" || saving) return;
    const limitSeconds = Number(followUp.duration?.minutes || 0) * 60;
    const elapsed = Number(followUp.tracking.elapsed_seconds || 0) + clockSeconds;
    if (!limitSeconds || elapsed < limitSeconds) return;
    saveTracking({
      match_status: periodEndStatus(followUp.tracking.period, followUp.duration.periods),
      elapsed_seconds: limitSeconds,
    });
  }, [clockSeconds, followUp?.tracking?.match_status, followUp?.tracking?.period, followUp?.tracking?.elapsed_seconds, saving]);

  function beginClockEdit() {
    setClockInput(formatDuration(displayedClock));
    setEditingClock(true);
  }

  async function saveClock() {
    const match = /^(\d+):([0-5]\d)$/.exec(clockInput.trim());
    if (!match) return setError('Introduce el tiempo con formato mm:ss.');
    const elapsedSeconds = Number(match[1]) * 60 + Number(match[2]);
    await saveTracking({ elapsed_seconds: elapsedSeconds });
    setEditingClock(false);
  }

  async function savePlayer(player) {
    try {
      const response = await axios.put(
        `/api/matches/${matchId}/follow-up/players/${player.id}`,
        player,
      );
      return response.data;
    } catch (err) {
      setError(
        err.response?.data?.error || "No se pudo guardar la estadística.",
      );
      loadFollowUp();
      return null;
    }
  }

  async function changePlayerStat(player, field, amount) {
    const updatedPlayer = {
      ...player,
      [field]: Math.max(0, Number(player[field] || 0) + amount),
    };
    if (field === "seven_meters_scored" && amount > 0)
      updatedPlayer.seven_meters_attempted =
        Number(player.seven_meters_attempted || 0) + amount;
    if (field === "seven_meters_attempted")
      updatedPlayer.seven_meters_attempted = Math.max(
        Number(player.seven_meters_scored || 0),
        updatedPlayer.seven_meters_attempted,
      );
    setFollowUp((current) => ({
      ...current,
      players: current.players.map((item) =>
        item.id === player.id ? updatedPlayer : item,
      ),
    }));
    await savePlayer(updatedPlayer);
  }

  function openStatsMenu(player) {
    setStatsContextPlayer((current) => current?.id === player.id ? null : player);
  }

  function openStatsGroup(group) {
    setStatsModal({ show: true, player: statsContextPlayer, group });
    setStatsContextPlayer(null);
  }

  async function toggleCourt(player) {
    const onCourt = !Boolean(player.on_court);
    if (onCourt && followUp.players.filter((item) => item.on_court).length >= 7)
      return setError("No puede haber más de 7 jugadores en pista.");
    const updatedPlayer = { ...player, on_court: onCourt ? 1 : 0 };
    setFollowUp((current) => ({
      ...current,
      players: current.players.map((item) =>
        item.id === player.id ? updatedPlayer : item,
      ),
    }));
    const savedPlayer = await savePlayer(updatedPlayer);
    if (savedPlayer) {
      setFollowUp((current) => ({
        ...current,
        players: current.players.map((item) =>
          item.id === player.id ? { ...item, ...savedPlayer } : item,
        ),
      }));
    }
    if (!onCourt) setSelectedPlayerId((current) => current === player.id ? null : current);
  }

  async function registerShot(zone) {
    const { player, eventType } = shotModal;
    try {
      await axios.post(
        `/api/matches/${matchId}/follow-up/players/${player.id}/shots`,
        { event_type: eventType, zone },
      );
      setShotModal({ show: false, player: null, eventType: "goal" });
      await loadFollowUp();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "No se pudo guardar la zona del lanzamiento.",
      );
    }
  }

  async function registerSevenMeter(zone) {
    const { player, outcome } = sevenMeterModal;
    try {
      await axios.post(
        `/api/matches/${matchId}/follow-up/players/${player.id}/seven-meters`,
        { outcome, zone },
      );
      setSevenMeterModal({ show: false, player: null, outcome: "goal" });
      await loadFollowUp();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "No se pudo guardar el lanzamiento de 7 metros.",
      );
    }
  }

  function renderMatchList() {
    return (
      <div className="table-responsive">
        <table className="table table-striped table-bordered bg-white align-middle">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Local</th>
              <th>Visitante</th>
              <th>Pabellón</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => (
              <tr key={match.id}>
                <td>{formatDate(match.scheduled_at)}</td>
                <td>{formatTime(match.scheduled_at)}</td>
                <td>{match.home_team_name}</td>
                <td>{match.visitor_name}</td>
                <td>{match.venue_name}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      window.location.href = `/partido/seguimiento?matchId=${match.id}`;
                    }}
                    aria-label="Seguir partido"
                    title="Seguir partido"
                  >
                    <i
                      className="fa-solid fa-chart-line me-1"
                      aria-hidden="true"
                    />
                    Seguir partido
                  </button>
                </td>
              </tr>
            ))}
            {!matches.length && (
              <tr>
                <td colSpan="6" className="text-center text-muted py-4">
                  No hay partidos programados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  if (!followUp)
    return (
      <div className="container mt-4">
        <h2 className="mb-1">Seguimiento de partidos</h2>
        <p className="text-muted mb-3">
          Control en directo de jugadores y estadísticas.
        </p>
        {error && <div className="alert alert-danger">{error}</div>}
        {renderMatchList()}
      </div>
    );

  const { match, duration, tracking, players: rawPlayers } = followUp;
  const players = [...rawPlayers].sort(
    (left, right) =>
      Number(right.on_court) - Number(left.on_court) ||
      String(left.numero || "").localeCompare(
        String(right.numero || ""),
        "es",
        { numeric: true },
      ) ||
      String(left.apellidos || left.nombre).localeCompare(
        String(right.apellidos || right.nombre),
        "es",
      ),
  );
  const onCourtPlayers = players.filter((player) => player.on_court);
  const benchPlayers = players.filter((player) => !player.on_court);
  const selectedPlayer = onCourtPlayers.find((player) => player.id === selectedPlayerId);
  const displayedClock = Number(tracking.elapsed_seconds || 0) + clockSeconds;
  const isRunning = tracking.match_status === "En juego";
  const isTimeout = tracking.match_status === "Tiempo muerto local" || tracking.match_status === "Tiempo muerto visitante";
  const periodCount = duration.periods || 2;
  const periodOptions = Array.from({ length: periodCount }, (_, index) => `${index + 1}/${periodCount}`).flatMap((period, index, periods) => index < periods.length - 1 ? [period, "Descanso"] : [period]);

  return (
    <div className="container-fluid mt-4 pb-4">
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary mb-2"
            onClick={() => {
              window.location.href = "/partido/seguimiento";
            }}
            aria-label="Volver a partidos"
            title="Volver a partidos"
          >
            <i className="fa-solid fa-arrow-left" aria-hidden="true" />
          </button>
          <h2 className="mb-1">
            {match.home_team_name} vs {match.visitor_name}
          </h2>
          <p className="text-muted mb-0">
            {formatDate(match.scheduled_at)} · {formatTime(match.scheduled_at)}{" "}
            · {match.venue_name}
          </p>
        </div>
        <span className="badge text-bg-light border fs-6">
          {duration.label}
        </span>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="row g-3 mb-3 match-control-row">
        <div className="col-lg-4">
          <div className="card h-100 match-follow-up-card" id="match-score-card">
            <div className="card-body text-center">
              <div className="small text-muted">Marcador</div>
              <div className="display-4 fw-bold">
                {tracking.home_score} - {tracking.visitor_score}
              </div>
              <div className="small text-muted">{match.home_team_name} · {match.visitor_name}</div>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card h-100 match-follow-up-card" id="match-clock-card">
            <div className="card-body text-center">
              <div className="small text-muted">Tiempo de juego</div>
              <div className="display-5 fw-bold text-primary">{formatDuration(displayedClock)}</div>
              <div className="d-flex justify-content-center align-items-center gap-2 mt-2">
                <span className="small text-muted">Periodo</span>
                <select
                  id="match-period-select"
                  className="form-select form-select-sm match-period-select"
                  value={tracking.period}
                  onChange={(event) => handlePeriodChange(event.target.value)}
                  aria-label="Seleccionar periodo"
                >
                  {periodOptions.map((period, index) => <option key={`${period}-${index}`}>{period}</option>)}
                </select>
                {editingClock ? (
                  <span className="d-inline-flex align-items-center gap-1">
                    <input className="form-control form-control-sm match-clock-input" value={clockInput} onChange={(event) => setClockInput(event.target.value)} aria-label="Editar tiempo de juego" title="Editar tiempo de juego" />
                    <button type="button" className="btn btn-sm btn-success py-0 px-2" onClick={saveClock} aria-label="Guardar tiempo" title="Guardar tiempo"><i className="fa-solid fa-check" aria-hidden="true" /></button>
                    <button type="button" className="btn btn-sm btn-outline-secondary py-0 px-2" onClick={() => setEditingClock(false)} aria-label="Cancelar edición del tiempo" title="Cancelar edición del tiempo"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                  </span>
                ) : (
                  <button type="button" className="btn btn-sm btn-link p-0 text-muted" onClick={beginClockEdit} aria-label="Editar tiempo de juego" title="Editar tiempo de juego"><i className="fa-solid fa-pen" aria-hidden="true" /></button>
                )}
              </div>
              <div className="form-text mt-2">Duración: {duration.label}. Pista: {onCourtPlayers.length}/7.</div>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card h-100 match-follow-up-card" id="match-status-card">
            <div className="card-body">
              <label className="form-label" htmlFor="match-status-select">Estado</label>
              <select
                id="match-status-select"
                className="form-select"
                value={tracking.match_status}
                onChange={(event) => handleStatusChange(event.target.value)}
              >
                <option>No iniciado</option>
                <option>En juego</option>
                <option>Descanso</option>
                <option>Tiempo muerto local</option>
                <option>Tiempo muerto visitante</option>
                <option>Finalizado</option>
              </select>
              <div className="mt-2">
                {!isRunning && !isTimeout && tracking.match_status !== "Finalizado" && <button type="button" className="btn btn-success w-100" onClick={() => saveTracking({ match_status: "En juego", period: periodOptions[0] })} disabled={saving} aria-label="Iniciar partido" title="Iniciar partido"><i className="fa-solid fa-play me-1" aria-hidden="true" />Iniciar partido</button>}
                {isRunning && <div className="d-flex gap-1"><button type="button" className="btn btn-warning flex-fill" onClick={() => saveTracking({ match_status: "Tiempo muerto local" })} disabled={saving} aria-label="Tiempo muerto local" title="Tiempo muerto local"><i className="fa-solid fa-stopwatch me-1" aria-hidden="true" />Local</button><button type="button" className="btn btn-warning flex-fill" onClick={() => saveTracking({ match_status: "Tiempo muerto visitante" })} disabled={saving} aria-label="Tiempo muerto visitante" title="Tiempo muerto visitante"><i className="fa-solid fa-stopwatch me-1" aria-hidden="true" />Visitante</button></div>}
                {isTimeout && <button type="button" className="btn btn-success w-100" onClick={() => saveTracking({ match_status: "En juego" })} disabled={saving} aria-label="Reanudar partido" title="Reanudar partido"><i className="fa-solid fa-play me-1" aria-hidden="true" />Reanudar</button>}
                {(isRunning || isTimeout) && <button type="button" className="btn btn-outline-danger w-100 mt-1" onClick={() => saveTracking({ match_status: "Finalizado" })} disabled={saving} aria-label="Finalizar partido" title="Finalizar partido"><i className="fa-solid fa-flag-checkered me-1" aria-hidden="true" />Finalizar</button>}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="row g-3 mb-3">
        <div className="col-xl-6">
          <div className="card h-100">
            <div className="card-header">
              <strong>En pista</strong>
            </div>
            <div className="card-body court-surface">
              <div className="player-circle-list">
                {onCourtPlayers.map((player) => (
                  <div className="player-circle-item" key={player.id}>
                    <PlayerCircle
                      player={player}
                      compact
                      selected={player.id === selectedPlayerId}
                      onClick={() => setSelectedPlayerId(player.id)}
                      onPhotoClick={openStatsMenu}
                    />
                    {statsContextPlayer?.id === player.id && (
                      <PlayerStatsContextMenu onSelect={openStatsGroup} />
                    )}
                    <div className="player-circle-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary py-0 px-2"
                        onClick={() => toggleCourt(player)}
                        aria-label="Enviar al banquillo"
                        title="Enviar al banquillo"
                      >
                        <i
                          className="fa-solid fa-arrow-down"
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </div>
                ))}
                {!onCourtPlayers.length && (
                  <div className="text-muted">
                    Selecciona jugadores del banquillo para comenzar.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-6">
          <div className="card h-100">
            <div className="card-header">
              <strong>Banquillo</strong>
            </div>
            <div className="card-body bench-surface">
              <div className="player-circle-list">
                {benchPlayers.map((player) => (
                  <div className="player-circle-item bench-player-station" key={player.id}>
                    <PlayerCircle player={player} bench onClick={() => toggleCourt(player)} onPhotoClick={openStatsMenu} />
                    {statsContextPlayer?.id === player.id && (
                      <PlayerStatsContextMenu onSelect={openStatsGroup} />
                    )}
                    <div className="player-circle-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary py-0 px-2"
                        onClick={() => toggleCourt(player)}
                        aria-label="Enviar a pista"
                        title="Enviar a pista"
                      >
                        <i
                          className="fa-solid fa-arrow-up"
                          aria-hidden="true"
                        />{" "}
                      </button>
                    </div>
                  </div>
                ))}
                {!benchPlayers.length && (
                  <div className="text-muted">
                    Todos los convocados están en pista.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {selectedPlayer && <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <strong>Estadísticas de {selectedPlayer.nombre} {selectedPlayer.apellidos || ""}</strong>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedPlayerId(null)} aria-label="Ocultar estadísticas" title="Ocultar estadísticas"><i className="fa-solid fa-eye-slash" aria-hidden="true" /></button>
        </div>
        <div className="table-responsive">
          <table className="table table-sm table-bordered align-middle mb-0 statistics-table">
            <thead>
              <tr className="statistics-group-row">
                <th rowSpan="2">Jugador</th>
                <th rowSpan="2">Tiempo en pista</th>
                {statisticGroups.map((group) => (
                  <th className={`statistics-group-${group.key}`} colSpan={group.fields.length} key={group.key}>
                    {group.label}
                  </th>
                ))}
              </tr>
              <tr>
                {statistics.map(([, label]) => (
                  <th key={label} title={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
                <tr key={selectedPlayer.id}>
                  <td className="text-nowrap">
                    {selectedPlayer.numero ? `#${selectedPlayer.numero} ` : ""}
                    {selectedPlayer.nombre} {selectedPlayer.apellidos || ""}
                  </td>
                  <td className="text-nowrap">{formatDuration(Number(selectedPlayer.time_on_court_seconds || 0) + (isRunning ? secondsSinceDate(selectedPlayer.court_started_at, courtClock) : 0))}</td>
                  {statistics.map(([field, label]) => (
                    <td key={field}>
                      {(
                        isGoalkeeper(selectedPlayer)
                          ? goalkeeperStatistics.has(field)
                          : !["saves", "goals_conceded"].includes(field)
                      ) ? (
                        <StatControl
                          player={selectedPlayer}
                          field={field}
                          label={label}
                          onChange={changePlayerStat}
                          onShot={(selectedPlayer, eventType) =>
                            setShotModal({
                              show: true,
                              player: selectedPlayer,
                              eventType,
                            })
                          }
                          onSevenMeter={(selectedPlayer) =>
                            setSevenMeterModal({
                              show: true,
                              player: selectedPlayer,
                              outcome: "goal",
                            })
                          }
                        />
                      ) : (
                        <span className="text-muted" title="No aplicable">
                          -
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
            </tbody>
          </table>
        </div>
      </div>}
      {statsModal.show && statsModal.player && (
        <>
          <div className="modal fade show d-block" tabIndex={-1} onClick={() => setStatsModal({ show: false, player: null, group: "attack" })}>
            <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(event) => event.stopPropagation()}>
              <div className="modal-content player-stats-modal">
                <div className="modal-header">
                  <div>
                    <h5 className="modal-title">{statisticGroups.find((group) => group.key === statsModal.group)?.label}</h5>
                    <div className="small text-muted">{statsModal.player.nombre} {statsModal.player.apellidos || ""}</div>
                  </div>
                  <button type="button" className="btn-close" onClick={() => setStatsModal({ show: false, player: null, group: "attack" })} aria-label="Cerrar estadísticas" title="Cerrar estadísticas" />
                </div>
                <div className="modal-body">
                  <div className="stats-control-grid">
                    {statisticGroups.find((group) => group.key === statsModal.group)?.fields.map((field) => {
                      const statistic = statistics.find(([itemField]) => itemField === field);
                      if (!statistic) return null;
                      const [, label] = statistic;
                      const goalkeeperBlocked = isGoalkeeper(statsModal.player) && !goalkeeperStatistics.has(field);
                      const fieldBlocked = !isGoalkeeper(statsModal.player) && ["saves", "goals_conceded"].includes(field);
                      return (
                        <div className="stats-control-item" key={field}>
                          <span className="stats-control-label">{label}</span>
                          {goalkeeperBlocked || fieldBlocked ? (
                            <span className="text-muted" title="No aplicable">-</span>
                          ) : (
                            <StatControl
                              player={statsModal.player}
                              field={field}
                              label={label}
                              onChange={changePlayerStat}
                              onShot={(player, eventType) => setShotModal({ show: true, player, eventType })}
                              onSevenMeter={(player) => setSevenMeterModal({ show: true, player, outcome: "goal" })}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      )}
      {shotModal.show && (
        <>
          <div
            className="modal fade show d-block"
            tabIndex={-1}
            onClick={() =>
              setShotModal({ show: false, player: null, eventType: "goal" })
            }
          >
            <div
              className="modal-dialog modal-md"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {shotModal.eventType === "goal"
                      ? "Zona del gol"
                      : shotModal.eventType === "save"
                        ? "Zona de la parada"
                        : "Zona del gol recibido"}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() =>
                      setShotModal({
                        show: false,
                        player: null,
                        eventType: "goal",
                      })
                    }
                    aria-label="Cerrar"
                    title="Cerrar"
                  />
                </div>
                <div className="modal-body text-center">
                  <p className="mb-3">
                    {shotModal.player?.nombre}{" "}
                    {shotModal.player?.apellidos || ""}
                  </p>
                  <button
                    type="button"
                    className="btn btn-outline-secondary mb-2"
                    onClick={() => registerShot("outside")}
                    aria-label="Tiro fuera de portería"
                    title="Tiro fuera de portería"
                  >
                    <i
                      className="fa-solid fa-arrow-up-right-from-square me-1"
                      aria-hidden="true"
                    />
                    Fuera de portería
                  </button>
                  <div className="goal-frame">
                    <div className="goal-grid">
                      {shotZones.map(([zone, label]) => (
                        <button
                          type="button"
                          className="goal-zone"
                          key={zone}
                          onClick={() => registerShot(zone)}
                          aria-label={label}
                          title={label}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      )}
      {sevenMeterModal.show && (
        <>
          <div className="modal fade show d-block" tabIndex={-1} onClick={() => setSevenMeterModal({ show: false, player: null, outcome: "goal" })}>
            <div className="modal-dialog modal-md" onClick={(event) => event.stopPropagation()}>
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">7 metros: cuadrante y resultado</h5>
                  <button type="button" className="btn-close" onClick={() => setSevenMeterModal({ show: false, player: null, outcome: "goal" })} aria-label="Cerrar" title="Cerrar" />
                </div>
                <div className="modal-body text-center">
                  <p className="mb-3">{sevenMeterModal.player?.nombre} {sevenMeterModal.player?.apellidos || ""}</p>
                  <div className="btn-group mb-3" role="group" aria-label="Resultado del lanzamiento de 7 metros">
                    <button type="button" className={`btn ${sevenMeterModal.outcome === "goal" ? "btn-success" : "btn-outline-success"}`} onClick={() => setSevenMeterModal((current) => ({ ...current, outcome: "goal" }))} title="Gol de 7 metros">Gol</button>
                    <button type="button" className={`btn ${sevenMeterModal.outcome === "save" ? "btn-warning" : "btn-outline-warning"}`} onClick={() => setSevenMeterModal((current) => ({ ...current, outcome: "save" }))} title="Parada del portero">Parada</button>
                    <button type="button" className={`btn ${sevenMeterModal.outcome === "outside" ? "btn-secondary" : "btn-outline-secondary"}`} onClick={() => setSevenMeterModal((current) => ({ ...current, outcome: "outside" }))} title="Lanzamiento fuera">Fuera</button>
                  </div>
                  <div className="goal-frame">
                    <div className="goal-grid">
                      {shotZones.map(([zone, label]) => (
                        <button type="button" className="goal-zone" key={zone} onClick={() => registerSevenMeter(zone)} aria-label={`${label}, ${sevenMeterModal.outcome}`} title={`Registrar ${sevenMeterModal.outcome}: ${label}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      )}
    </div>
  );
}
