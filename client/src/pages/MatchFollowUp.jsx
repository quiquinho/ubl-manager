import React, { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import MatchStatsModal from "../components/MatchStatsModal";

const statistics = [
  ["goals", "Goles"],
  ["shots", "Lanzamientos"],
  ["assists", "Asistencias"],
  ["turnovers", "Pérdidas"],
  ["steals", "Robos"],
  ["saves", "Paradas"],
  ["blocks", "Bloqueos"],
  ["exclusions_2min", "Exclusiones 2 min"],
  ["yellow_cards", "Tarjetas amarillas"],
  ["red_cards", "Expulsiones"],
  ["blue_cards", "Tarjetas azules"],
  ["seven_meters", "7m A favor"],
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
    fields: ["steals", "saves", "blocks", "seven_meters_received", "seven_meters_saved"],
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

const historyActionLabels = {
  goal: "Gol", outside: "Parada", save: "Parada", conceded: "Gol recibido",
  assists: "Asistencia", turnovers: "Pérdida", steals: "Recuperación", blocks: "Bloqueo",
  exclusions_2min: "Exclusión 2 min", yellow_cards: "Tarjeta amarilla", red_cards: "Expulsión",
  blue_cards: "Tarjeta azul", fouls: "Falta", seven_meter_goal: "7m Gol", seven_meter_save: "7m Parada", seven_meter_outside: "7m Fuera",
};

const goalkeeperStatistics = new Set([
  "goals",
  "shots",
  "saves",
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
        {player.numero && <span className="player-circle-number">{player.numero}</span>}
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
        <i className="fa-solid fa-bullseye me-1" aria-hidden="true" />{player.seven_meters_scored || 0}/{player.seven_meters_attempted || 0}
      </button>
    );
  }
  if (field === "shots") {
    const goalkeeper = isGoalkeeper(player);
    const launches = goalkeeper ? Number(player.saves || 0) + Number(player.goals_conceded || 0) : Number(player.shots || 0);
    return (
      <button type="button" className="btn btn-sm btn-outline-primary text-nowrap" onClick={() => onShot(player, goalkeeper ? "defense" : "attack")} aria-label={goalkeeper ? "Registrar lanzamiento recibido" : "Registrar lanzamiento"} title={goalkeeper ? "Registrar lanzamiento recibido" : "Registrar lanzamiento"}>
        <i className={`fa-solid ${goalkeeper ? "fa-shield-halved" : "fa-bullseye"} me-1`} aria-hidden="true" />{goalkeeper ? `${player.saves || 0}/${launches}` : `${player.goals || 0}/${player.shots || 0}`}
      </button>
    );
  }
  if (field === "seven_meters_saved") {
    return (
      <button type="button" className="btn btn-sm btn-outline-primary text-nowrap" onClick={() => onSevenMeter(player)} aria-label="Registrar parada de 7 metros" title="Registrar parada de 7 metros">
        <i className="fa-solid fa-shield-halved me-1" aria-hidden="true" />{player.seven_meters_saved || 0}/{player.seven_meters_received || 0}
      </button>
    );
  }
  if (field === "goals_conceded") return <span className="badge text-bg-light border">{player.goals_conceded || 0}</span>;
  if (field === "goals" || field === "saves") {
    const eventType = field === "goals" ? "goal" : "defense";
    return (
      <button type="button" className="btn btn-sm btn-outline-primary text-nowrap" onClick={() => onShot(player, eventType)} aria-label={`Registrar ${label}`} title={`Registrar ${label}`}>
        <i className={`fa-solid ${eventType === "goal" ? "fa-bullseye" : "fa-shield-halved"} me-1`} aria-hidden="true" />{player[field] || 0}
      </button>
    );
  }
  return (
    <div className="d-flex align-items-center gap-1">
      <span className="badge text-bg-light border">{player[field] || 0}</span>
      <button type="button" className="btn btn-sm btn-outline-secondary py-0 px-1" onClick={() => onChange(player, field, -1)} aria-label={`Restar ${label}`} title={`Restar ${label}`}><i className="fa-solid fa-minus" aria-hidden="true" /></button>
      <button type="button" className="btn btn-sm btn-outline-primary py-0 px-1" onClick={() => onChange(player, field, 1)} aria-label={`Añadir ${label}`} title={`Añadir ${label}`}><i className="fa-solid fa-plus" aria-hidden="true" /></button>
    </div>
  );
}

function PlayerStatsContextMenu({ onSelect, onQuickAction, onSevenMeter, bench, onMoveToCourt }) {
  return (
    <div className={`player-stats-context-menu ${bench ? "player-stats-context-menu-bench" : ""}`} role="menu" aria-label="Grupo de estadísticas">
      {bench ? (
        <button type="button" className="context-menu-quick" onClick={onMoveToCourt} role="menuitem">A pista</button>
      ) : <>
        <div className="player-stats-context-side player-stats-context-left">
          {onSevenMeter ? <>
            <button type="button" className="context-menu-defense context-menu-quick" onClick={() => onQuickAction("saves")} role="menuitem"><i className="fa-solid fa-shield-halved me-1" aria-hidden="true" />Paradas</button>
            <button type="button" className="context-menu-defense context-menu-quick" onClick={onSevenMeter} role="menuitem"><i className="fa-solid fa-bullseye me-1" aria-hidden="true" />7m parado/total</button>
          </> : <>
            <button type="button" className="context-menu-attack context-menu-quick" onClick={() => onQuickAction("shots")} role="menuitem"><i className="fa-solid fa-bullseye me-1" aria-hidden="true" />Lanzamientos</button>
            <button type="button" className="context-menu-attack context-menu-quick" onClick={() => onQuickAction("assists")} role="menuitem"><i className="fa-solid fa-handshake me-1" aria-hidden="true" />Asistencias</button>
          </>}
        </div>
        <div className="player-stats-context-side player-stats-context-right">
          {statisticGroups.map((item) => (
            <button type="button" key={item.key} className={`context-menu-${item.key}`} onClick={() => onSelect(item.key)} role="menuitem">
              <i className={`fa-solid ${item.key === "attack" ? "fa-rocket" : item.key === "defense" ? "fa-shield-halved" : "fa-triangle-exclamation"} me-1`} aria-hidden="true" />{item.label}
            </button>
          ))}
        </div>
      </>}
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
    eventType: "attack",
    zone: null,
  });
  const [sevenMeterModal, setSevenMeterModal] = useState({
    show: false,
    player: null,
    outcome: "goal",
    zone: null,
  });
  const [statsContextPlayer, setStatsContextPlayer] = useState(null);
  const [benchContextPlayer, setBenchContextPlayer] = useState(null);
  const [statsModal, setStatsModal] = useState({
    show: false,
    player: null,
    group: "attack",
  });
  const [showMatchStatsModal, setShowMatchStatsModal] = useState(false);
  const [historyModal, setHistoryModal] = useState({ show: false, events: [], loading: false });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [clockSeconds, setClockSeconds] = useState(0);
  const [courtClock, setCourtClock] = useState(() => Date.now());
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [sanctionedPlayers, setSanctionedPlayers] = useState([]);
  const [editingClock, setEditingClock] = useState(false);
  const [clockInput, setClockInput] = useState('00:00');

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSanctionedPlayers(current => current.map(item => {
        if (!item.running || item.remaining <= 0) return item
        const remaining = Math.max(0, item.remaining - 1)
        return { ...item, remaining, running: remaining > 0 }
      }))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

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
      const response = await axios.get(`/api/matches/${matchId}/follow-up?_=${Date.now()}`, {
        headers: {
          "Cache-Control": "no-cache, no-store, max-age=0",
          Pragma: "no-cache",
        },
      });
      const freshFollowUp = response.data.tracking.match_status === "No iniciado"
        ? {
            ...response.data,
            players: response.data.players.map((player) => ({
              ...player,
              on_court: 0,
              time_on_court_seconds: 0,
              court_started_at: null,
              goals: 0,
              shots: 0,
              assists: 0,
              turnovers: 0,
              steals: 0,
              saves: 0,
              goals_conceded: 0,
              blocks: 0,
              exclusions_2min: 0,
              yellow_cards: 0,
              red_cards: 0,
              blue_cards: 0,
              seven_meters_scored: 0,
              seven_meters_attempted: 0,
              seven_meters_received: 0,
              seven_meters_saved: 0,
              fouls: 0,
            })),
            tracking: { ...response.data.tracking, home_score: 0, visitor_score: 0, elapsed_seconds: 0 },
          }
        : response.data;
      setFollowUp(freshFollowUp);
      setStatsModal((current) => {
        if (!current.player) return current;
        const refreshedPlayer = freshFollowUp.players.find((player) => player.id === current.player.id);
        return refreshedPlayer ? { ...current, player: refreshedPlayer } : current;
      });
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
      if (changes.match_status === "No iniciado") {
        setSelectedPlayerId(null);
        setStatsContextPlayer(null);
        setStatsModal({ show: false, player: null, group: "attack" });
        await loadFollowUp();
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "No se pudo guardar el estado del partido.",
      );
    } finally {
      setSaving(false);
    }
  }

  function adjustGameClock(delta) {
    const currentSeconds = Number(followUp?.tracking?.elapsed_seconds || 0) + clockSeconds;
    saveTracking({ elapsed_seconds: Math.max(0, currentSeconds + delta) });
  }

  async function handleStatusChange(status) {
    if (status === "No iniciado") {
      const hasStarted = followUp.tracking.match_status !== "No iniciado" || Number(followUp.tracking.elapsed_seconds || 0) > 0;
      if (hasStarted) {
        const confirmation = await Swal.fire({
          icon: "warning",
          title: "¿Reiniciar el partido?",
          text: "Se vaciarán las estadísticas de todos los jugadores, el marcador volverá a 0 - 0 y el reloj se pondrá a 0:00.",
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

  async function resumeMatch() {
    await saveTracking({ match_status: "En juego" });
    setFollowUp((current) => current ? {
      ...current,
      tracking: { ...current.tracking, match_status: "En juego" },
    } : current);
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

  function showStatNotice(player, statistic, positive) {
    const name = `${player.nombre} ${player.apellidos || ""}`.trim();
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: positive ? "success" : "error",
      title: `${name}: ${statistic}`,
      showConfirmButton: false,
      timer: 1800,
      timerProgressBar: true,
    });
  }

  function addTwoMinuteSanction(player) {
    setSanctionedPlayers(current => current.some(item => item.playerId === player.id)
      ? current
      : [...current, { playerId: player.id, playerName: `${player.nombre} ${player.apellidos || ""}`.trim(), remaining: 120, running: false }])
  }

  function formatSanctionTime(seconds) {
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
  }

  async function askSanctionTime(item) {
    const currentMinutes = Math.floor(displayedClock / 60)
    const currentSeconds = displayedClock % 60
    const result = await Swal.fire({
      title: "Momento de la sanción",
      width: 620,
      html: `<p class="text-muted text-start mb-3">Se sumarán 2 minutos al tiempo de juego para calcular la vuelta.</p><div class="row g-3 text-start"><div class="col-6"><label class="form-label" for="sanction-minute">Minuto de juego</label><input id="sanction-minute" class="swal2-input m-0 w-100" type="number" min="0" value="${currentMinutes}"></div><div class="col-6"><label class="form-label" for="sanction-second">Segundo de juego</label><input id="sanction-second" class="swal2-input m-0 w-100" type="number" min="0" max="59" value="${String(currentSeconds).padStart(2, "0")}"></div></div>`,
      showCancelButton: true,
      confirmButtonText: "Marcar 2 minutos",
      cancelButtonText: "Cancelar",
      focusConfirm: false,
      preConfirm: () => {
        const minute = Number(document.getElementById("sanction-minute")?.value)
        const second = Number(document.getElementById("sanction-second")?.value)
        if (!Number.isInteger(minute) || minute < 0 || !Number.isInteger(second) || second < 0 || second > 59) {
          Swal.showValidationMessage("Introduce un minuto válido y segundos entre 0 y 59")
          return null
        }
        return { minute, second }
      },
    })
    if (!result.isConfirmed || !result.value) return
    const returnAt = result.value.minute * 60 + result.value.second + 120
    setSanctionedPlayers(current => current.map(entry => entry.playerId === item.playerId ? { ...entry, remaining: 120, returnAt, running: false } : entry))
  }

  function toggleSanctionTimer(item) {
    if (item.running) {
      setSanctionedPlayers(current => current.map(entry => entry.playerId === item.playerId ? { ...entry, running: false } : entry))
      return
    }
    if (item.remaining <= 0) return
    setSanctionedPlayers(current => current.map(entry => entry.playerId === item.playerId ? { ...entry, running: true } : entry))
  }

  function editSanctionReturnTime(item) {
    askSanctionTime(item)
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
    setStatsModal((current) => current.player?.id === player.id ? { ...current, player: updatedPlayer } : current);
    const savedPlayer = await savePlayer(updatedPlayer);
    if (savedPlayer) {
      if (field === "exclusions_2min" && amount > 0) addTwoMinuteSanction(player)
      showStatNotice(player, amount > 0 ? `+${amount} ${field}` : `${amount} ${field}`, amount > 0);
    }
  }

  function openStatsMenu(player) {
    setStatsContextPlayer((current) => current?.id === player.id ? null : player);
  }

  async function openHistory() {
    setHistoryModal({ show: true, events: [], loading: true });
    try {
      const response = await axios.get(`/api/matches/${matchId}/follow-up/history`);
      setHistoryModal({ show: true, events: response.data, loading: false });
    } catch (err) {
      setHistoryModal({ show: true, events: [], loading: false });
      setError(err.response?.data?.error || "No se pudo cargar el historial.");
    }
  }

  async function deleteHistoryEvent(event) {
    const result = await Swal.fire({
      icon: "warning",
      title: "¿Borrar acción?",
      text: `${event.player_name} · ${historyActionLabels[event.action] || event.action}`,
      showCancelButton: true,
      confirmButtonText: "Borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc3545",
    });
    if (!result.isConfirmed) return;
    try {
      await axios.delete(`/api/matches/${matchId}/follow-up/history/${event.id}`);
      await loadFollowUp();
      setHistoryModal(current => ({ ...current, events: current.events.filter(item => item.id !== event.id) }));
      Swal.fire({ toast: true, position: "top-end", icon: "success", title: "Acción borrada", showConfirmButton: false, timer: 1500 });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo borrar", text: err.response?.data?.error || "Inténtalo de nuevo." });
    }
  }

  function openBenchMenu(player) {
    setBenchContextPlayer((current) => current?.id === player.id ? null : player);
  }

  function openStatsGroup(group) {
    setStatsModal({ show: true, player: statsContextPlayer, group });
    setStatsContextPlayer(null);
  }

  function openQuickAttackAction(action) {
    const player = statsContextPlayer;
    setStatsContextPlayer(null);
    if (action === "shots") {
      setShotModal({ show: true, player, eventType: isGoalkeeper(player) ? "defense" : "attack", zone: null });
      return;
    }
    if (action === "saves") {
      setShotModal({ show: true, player, eventType: "defense", zone: null });
      return;
    }
    changePlayerStat(player, action, 1);
  }

  function openGoalkeeperSevenMeter(player) {
    setStatsContextPlayer(null);
    setSevenMeterModal({ show: true, player, outcome: "save", zone: null });
  }

  async function toggleCourt(player) {
    const onCourt = !Boolean(player.on_court);
    setStatsContextPlayer(null);
    setBenchContextPlayer(null);
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

  async function registerShot(result, selectedZone = shotModal.zone) {
    const { player, eventType } = shotModal;
    const storedEventType = eventType === "attack" || eventType === "defense" ? result : eventType;
    if (eventType === "defense" && result === "outside") {
      setShotModal({ show: false, player: null, eventType: "attack", zone: null });
      return;
    }
    try {
      await axios.post(
        `/api/matches/${matchId}/follow-up/players/${player.id}/shots`,
        { event_type: storedEventType, zone: selectedZone },
      );
      const shotField = storedEventType === "goal" ? "goals" : storedEventType === "conceded" ? "goals_conceded" : storedEventType === "save" ? "saves" : "shots";
      const updatedPlayer = { ...player, [shotField]: Number(player[shotField] || 0) + 1 };
      setFollowUp((current) => ({
        ...current,
        players: current.players.map((item) => item.id === player.id ? { ...item, ...updatedPlayer } : item),
      }));
      setStatsModal((current) => current.player?.id === player.id ? { ...current, player: updatedPlayer } : current);
      const statistic = storedEventType === "goal" ? "Gol" : storedEventType === "save" || storedEventType === "outside" ? "Parada" : "Gol recibido";
      showStatNotice(player, statistic, storedEventType === "goal" || storedEventType === "save");
      setShotModal({ show: false, player: null, eventType: "attack", zone: null });
      await loadFollowUp();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "No se pudo guardar la zona del lanzamiento.",
      );
    }
  }

  async function registerSevenMeter(result = sevenMeterModal.outcome, selectedZone = sevenMeterModal.zone) {
    const { player } = sevenMeterModal;
    try {
      await axios.post(
        `/api/matches/${matchId}/follow-up/players/${player.id}/seven-meters`,
        { outcome: result, zone: selectedZone },
      );
      showStatNotice(player, `7 metros: ${result === "goal" ? "Gol" : result === "save" ? "Parada" : "Fuera"}`, result === "goal");
      setSevenMeterModal({ show: false, player: null, outcome: "goal", zone: null });
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
  const homeScore = tracking.match_status === "No iniciado"
    ? 0
    : players.reduce((total, player) => total + Number(player.goals || 0), 0);
  const visitorScore = tracking.match_status === "No iniciado"
    ? 0
    : players.reduce((total, player) => total + Number(player.goals_conceded || 0), 0);
  const statsModalPlayer = statsModal.player
    ? players.find((player) => player.id === statsModal.player.id) || statsModal.player
    : null;
  const statsModalPlayerTime = statsModalPlayer
    ? Number(statsModalPlayer.time_on_court_seconds || 0) + (isRunning && statsModalPlayer.on_court ? secondsSinceDate(statsModalPlayer.court_started_at, courtClock) : 0)
    : 0;

  return (
    <div className="container-fluid mt-4 pb-4">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => {
              window.location.href = "/partido/seguimiento";
            }}
            aria-label="Volver a partidos"
            title="Volver a partidos"
          >
            <i className="fa-solid fa-arrow-left" aria-hidden="true" />
          </button>
          <h2 className="mb-0">
            <span>
              {match.home_team_name}
              {tracking.match_status === "Tiempo muerto local" && (
                <i
                  className="fa-solid fa-stopwatch ms-2 text-warning"
                  aria-label={`Tiempo muerto solicitado por ${match.home_team_name}`}
                  title={`Tiempo muerto: ${match.home_team_name}`}
                />
              )}
            </span>
            {" vs "}
            <span>
              {match.visitor_name}
              {tracking.match_status === "Tiempo muerto visitante" && (
                <i
                  className="fa-solid fa-stopwatch ms-2 text-info"
                  aria-label={`Tiempo muerto solicitado por ${match.visitor_name}`}
                  title={`Tiempo muerto: ${match.visitor_name}`}
                />
              )}
            </span>
          </h2>
          <button type="button" className="btn btn-sm btn-outline-info" onClick={() => setShowMatchStatsModal(true)} aria-label="Ver estadisticas completas del partido" title="Ver estadisticas completas del partido"><i className="fa-solid fa-chart-column me-1" aria-hidden="true" />Estadisticas</button>
          <p className="text-muted mb-0 text-nowrap">
            {formatDate(match.scheduled_at)} · {formatTime(match.scheduled_at)}{" "}
            · {match.venue_name}
          </p>
        </div>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={openHistory} aria-label="Ver historial de acciones" title="Ver historial de acciones"><i className="fa-solid fa-clock-rotate-left me-1" aria-hidden="true" />Historial</button>
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
                {homeScore} - {visitorScore}
              </div>
              <div className="small text-muted">{match.home_team_name} · {match.visitor_name}</div>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card h-100 match-follow-up-card" id="match-clock-card">
            <div className="card-body text-center">
              <div className="small text-muted">Tiempo de juego</div>
              <div className="d-flex justify-content-center align-items-center gap-2">
                <div className="btn-group btn-group-sm" role="group" aria-label="Ajustar minutos"><button type="button" className="btn btn-outline-secondary" onClick={() => adjustGameClock(-60)} aria-label="Restar un minuto" title="Restar un minuto">−</button><button type="button" className="btn btn-outline-secondary" onClick={() => adjustGameClock(60)} aria-label="Sumar un minuto" title="Sumar un minuto">+</button></div>
                <div className="display-5 fw-bold text-primary">{formatDuration(displayedClock)}</div>
                <div className="btn-group btn-group-sm" role="group" aria-label="Ajustar segundos"><button type="button" className="btn btn-outline-secondary" onClick={() => adjustGameClock(-1)} aria-label="Restar un segundo" title="Restar un segundo">−</button><button type="button" className="btn btn-outline-secondary" onClick={() => adjustGameClock(1)} aria-label="Sumar un segundo" title="Sumar un segundo">+</button></div>
              </div>
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
              <div className="small text-muted mb-2">Estado: {tracking.match_status}</div>
              <div className="mt-2">
                {!isRunning && !isTimeout && tracking.match_status !== "Finalizado" && <button type="button" className="btn btn-success w-100" onClick={() => saveTracking({ match_status: "En juego", period: periodOptions[0] })} disabled={saving} aria-label="Iniciar partido" title="Iniciar partido"><i className="fa-solid fa-play me-1" aria-hidden="true" />Inicio</button>}
                {isRunning && <button type="button" className="btn btn-warning w-100 mb-2" onClick={() => saveTracking({ match_status: "Descanso" })} disabled={saving} aria-label="Pausar partido" title="Pausar partido"><i className="fa-solid fa-pause me-1" aria-hidden="true" />Pausa</button>}
                {isRunning && <div className="d-flex gap-1"><button type="button" className="btn btn-warning flex-fill" onClick={() => saveTracking({ match_status: "Tiempo muerto local" })} disabled={saving} aria-label={`Tiempo muerto ${match.home_team_name}`} title={`Tiempo muerto ${match.home_team_name}`}><i className="fa-solid fa-stopwatch me-1" aria-hidden="true" />{match.home_team_name}</button><button type="button" className="btn btn-warning flex-fill" onClick={() => saveTracking({ match_status: "Tiempo muerto visitante" })} disabled={saving} aria-label={`Tiempo muerto ${match.visitor_name}`} title={`Tiempo muerto ${match.visitor_name}`}><i className="fa-solid fa-stopwatch me-1" aria-hidden="true" />{match.visitor_name}</button></div>}
                {isTimeout && <button type="button" className="btn btn-success w-100" onClick={resumeMatch} disabled={saving} aria-label="Reanudar partido" title="Reanudar partido"><i className="fa-solid fa-play me-1" aria-hidden="true" />Reanudar</button>}
                {(isRunning || isTimeout) && <button type="button" className="btn btn-outline-danger w-100 mt-1" onClick={() => saveTracking({ match_status: "Finalizado" })} disabled={saving} aria-label="Finalizar partido" title="Finalizar partido"><i className="fa-solid fa-flag-checkered me-1" aria-hidden="true" />Finalizar</button>}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="row g-3 mb-3">
        <div className="col-lg-6">
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
                      <PlayerStatsContextMenu onSelect={openStatsGroup} onQuickAction={openQuickAttackAction} onSevenMeter={isGoalkeeper(player) ? () => openGoalkeeperSevenMeter(player) : null} />
                    )}
                    <div className="player-circle-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-danger py-0 px-2"
                        onClick={() => toggleCourt(player)}
                        aria-label="Enviar al banquillo"
                        title="Enviar al banquillo"
                      >
                        <i
                          className="fa-solid fa-arrow-right"
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </div>
                ))}
                {!onCourtPlayers.length && (
                  <div className="alert alert-warning text-center w-100 mb-0 empty-court-notice">
                    <i className="fa-solid fa-triangle-exclamation me-2" aria-hidden="true" />
                    Selecciona jugadores del banquillo para comenzar.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header">
              <strong>Banquillo</strong>
            </div>
            <div className="card-body bench-surface">
              <div className="player-circle-list">
                {benchPlayers.map((player) => (
                  <div className="player-circle-item bench-player-station" key={player.id}>
                    <PlayerCircle player={player} bench onClick={() => openBenchMenu(player)} onPhotoClick={openStatsMenu} />
                    {benchContextPlayer?.id === player.id && (
                      <PlayerStatsContextMenu bench onMoveToCourt={() => { setBenchContextPlayer(null); toggleCourt(player) }} />
                    )}
                    <div className="player-circle-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-success py-0 px-2"
                        onClick={() => toggleCourt(player)}
                        aria-label="Enviar a pista"
                        title="Enviar a pista"
                      >
                        <i
                          className="fa-solid fa-arrow-left"
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
                {statistics.map(([field, label]) => {
                  const displayedLabel = isGoalkeeper(selectedPlayer) && field === "shots" ? "Lanz. Rec." : label;
                  return <th key={field} title={displayedLabel}>{displayedLabel}</th>;
                })}
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
                              zone: null,
                            })
                          }
                          onSevenMeter={(selectedPlayer) =>
                            setSevenMeterModal({
                              show: true,
                              player: selectedPlayer,
                              outcome: "goal",
                              zone: null,
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
      <div className="card mb-3 w-100">
        <div className="card-header d-flex justify-content-between align-items-center">
          <strong><i className="fa-solid fa-hourglass-half me-2" aria-hidden="true" />Sancionados 2 minutos</strong>
          <span className="text-muted small">{sanctionedPlayers.length} jugadores</span>
        </div>
        <div className="table-responsive">
          <table className="table table-sm table-bordered align-middle mb-0">
            <thead><tr><th>Jugador</th><th>Tiempo restante</th><th>Vuelve en marcador</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {sanctionedPlayers.map(item => (
                <tr key={item.playerId}>
                  <td>{item.playerName}</td>
                  <td className="fw-bold">{formatSanctionTime(item.remaining)}</td>
                  <td className="text-nowrap">{item.returnAt == null ? "-" : formatDuration(item.returnAt)} <button type="button" className="btn btn-sm btn-link p-0 text-secondary" onClick={() => editSanctionReturnTime(item)} aria-label="Editar hora de regreso" title="Editar hora de regreso"><i className="fa-solid fa-pen" aria-hidden="true" /></button></td>
                  <td>{item.remaining === 0 ? "Finalizada" : item.running ? "En marcha" : "Pendiente"}</td>
                  <td className="text-nowrap">
                    <button type="button" className={`btn btn-sm ${item.running ? "btn-warning" : "btn-success"} me-1`} onClick={() => toggleSanctionTimer(item)} aria-label={item.running ? "Pausar sanción" : "Iniciar cuenta atrás"} title={item.running ? "Pausar sanción" : "Iniciar cuenta atrás"}><i className={`fa-solid ${item.running ? "fa-pause" : "fa-play"}`} aria-hidden="true" /></button>
                    <button type="button" className="btn btn-sm btn-outline-primary me-1" onClick={() => editSanctionReturnTime(item)} aria-label="Marcar momento de sanción" title="Marcar momento de sanción"><i className="fa-solid fa-clock" aria-hidden="true" /></button>
                    <button type="button" className="btn btn-sm btn-outline-secondary me-1" onClick={() => setSanctionedPlayers(current => current.map(entry => entry.playerId === item.playerId ? { ...entry, remaining: 120, running: false, returnAt: null } : entry))} aria-label="Reiniciar sanción" title="Reiniciar sanción"><i className="fa-solid fa-rotate-left" aria-hidden="true" /></button>
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setSanctionedPlayers(current => current.filter(entry => entry.playerId !== item.playerId))} aria-label="Quitar sanción" title="Quitar sanción"><i className="fa-solid fa-trash" aria-hidden="true" /></button>
                  </td>
                </tr>
              ))}
              {!sanctionedPlayers.length && <tr><td colSpan="4" className="text-center text-muted py-3">No hay jugadores sancionados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {statsModal.show && statsModalPlayer && (
        <>
          <div className="modal fade show d-block" tabIndex={-1} onClick={() => setStatsModal({ show: false, player: null, group: "attack" })}>
            <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(event) => event.stopPropagation()}>
              <div className="modal-content player-stats-modal">
                <div className="modal-header">
                  <div>
                    <h5 className="modal-title">{statisticGroups.find((group) => group.key === statsModal.group)?.label} · {formatDuration(statsModalPlayerTime)}</h5>
                    <div className="small text-muted">{statsModalPlayer.nombre} {statsModalPlayer.apellidos || ""} · Tiempo en pista</div>
                  </div>
                  <button type="button" className="btn-close" onClick={() => setStatsModal({ show: false, player: null, group: "attack" })} aria-label="Cerrar estadísticas" title="Cerrar estadísticas" />
                </div>
                <div className="modal-body">
                  <div className="stats-control-grid">
                    {statisticGroups.find((group) => group.key === statsModal.group)?.fields.map((field) => {
                      const statistic = statistics.find(([itemField]) => itemField === field);
                      if (!statistic) return null;
                      const [, label] = statistic;
                      const goalkeeperBlocked = isGoalkeeper(statsModalPlayer) && !goalkeeperStatistics.has(field);
                      const fieldBlocked = !isGoalkeeper(statsModalPlayer) && ["saves", "goals_conceded"].includes(field);
                      return (
                        <div className="stats-control-item" key={field}>
                          <span className="stats-control-label">{label}</span>
                          {goalkeeperBlocked || fieldBlocked ? (
                            <span className="text-muted" title="No aplicable">-</span>
                          ) : (
                            <StatControl
                              player={statsModalPlayer}
                              field={field}
                              label={label}
                              onChange={changePlayerStat}
                              onShot={(player, eventType) => setShotModal({ show: true, player, eventType, zone: null })}
                              onSevenMeter={(player) => setSevenMeterModal({ show: true, player, outcome: "goal", zone: null })}
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
      {showMatchStatsModal && <MatchStatsModal matchId={matchId} matchLabel={`${match.home_team_name} vs ${match.visitor_name}`} onClose={() => setShowMatchStatsModal(false)} />}
      {historyModal.show && (
        <>
          <div className="modal fade show d-block" tabIndex={-1} onClick={() => setHistoryModal(current => ({ ...current, show: false }))}>
            <div className="modal-dialog modal-lg modal-dialog-scrollable" onClick={event => event.stopPropagation()}>
              <div className="modal-content">
                <div className="modal-header"><h5 className="modal-title"><i className="fa-solid fa-clock-rotate-left me-2" aria-hidden="true" />Historial de acciones</h5><button type="button" className="btn-close" onClick={() => setHistoryModal(current => ({ ...current, show: false }))} aria-label="Cerrar" title="Cerrar" /></div>
                <div className="modal-body">
                  {historyModal.loading && <div className="text-center text-muted py-4">Cargando historial...</div>}
                  {!historyModal.loading && !historyModal.events.length && <div className="alert alert-info mb-0">No hay acciones registradas.</div>}
                  {!historyModal.loading && historyModal.events.length > 0 && <div className="table-responsive"><table className="table table-sm table-hover align-middle mb-0"><thead><tr><th>Jugador</th><th>Acción</th><th>Cuadrante</th><th>Minuto</th><th>Fecha</th><th></th></tr></thead><tbody>{historyModal.events.map(event => <tr key={event.id}><td>{event.player_name}</td><td>{historyActionLabels[event.action] || event.action}</td><td>{shotZones.find(([zone]) => zone === event.zone)?.[1] || event.zone || "-"}</td><td>{event.minute || "-"}</td><td>{new Date(event.created_at).toLocaleString("es-ES")}</td><td><button type="button" className="btn btn-sm btn-danger" onClick={() => deleteHistoryEvent(event)} aria-label={`Borrar ${historyActionLabels[event.action] || event.action}`} title="Borrar acción"><i className="fa-solid fa-trash" aria-hidden="true" /></button></td></tr>)}</tbody></table></div>}
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
              className="modal-dialog modal-lg"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {shotModal.eventType === "attack" || shotModal.eventType === "defense"
                      ? shotModal.zone ? "Resultado del lanzamiento" : "Zona del lanzamiento"
                      : shotModal.eventType === "goal"
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
                        eventType: "attack",
                        zone: null,
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
                  <button type="button" className="btn btn-outline-secondary mb-2" onClick={() => registerShot("outside", "outside")} aria-label="Tiro fuera de portería" title="Tiro fuera de portería"><i className="fa-solid fa-arrow-up-right-from-square me-1" aria-hidden="true" />Fuera de portería</button>
                  <div className="goal-frame">
                    <div className="goal-grid">
                      {shotZones.map(([zone, label]) => (
                        <button
                          type="button"
                          className={`goal-zone ${shotModal.zone === zone ? "is-selected" : ""}`}
                          key={zone}
                          onClick={() => setShotModal((current) => ({ ...current, zone }))}
                          aria-label={label}
                          title={label}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {shotModal.zone && (
                    <div className="mt-3">
                      <div className="small text-muted mb-2">Resultado en {shotZones.find(([zone]) => zone === shotModal.zone)?.[1]}</div>
                      <div className="row justify-content-center g-2" role="group" aria-label="Resultado del lanzamiento">
                        {shotModal.eventType === "defense" ? (
                          <>
                            <div className="col-6 col-lg-2"><button type="button" className="btn btn-success w-100" onClick={() => registerShot("save")} title="Registrar parada">Parada</button></div>
                            <div className="col-6 col-lg-2"><button type="button" className="btn btn-danger w-100" onClick={() => registerShot("conceded")} title="Registrar gol recibido">Gol</button></div>
                          </>
                        ) : (
                          <>
                            <div className="col-6 col-lg-2"><button type="button" className="btn btn-success w-100" onClick={() => registerShot("goal")} title="Registrar gol">Gol</button></div>
                            <div className="col-6 col-lg-2"><button type="button" className="btn btn-danger w-100" onClick={() => registerShot("outside")} title="Registrar parada">Parada</button></div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      )}
      {sevenMeterModal.show && (
        <>
          <div className="modal fade show d-block" tabIndex={-1} onClick={() => setSevenMeterModal({ show: false, player: null, outcome: "goal", zone: null })}>
            <div className="modal-dialog modal-lg" onClick={(event) => event.stopPropagation()}>
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">7 metros: cuadrante y resultado</h5>
                  <button type="button" className="btn-close" onClick={() => setSevenMeterModal({ show: false, player: null, outcome: "goal", zone: null })} aria-label="Cerrar" title="Cerrar" />
                </div>
                <div className="modal-body text-center">
                  <p className="mb-3">{sevenMeterModal.player?.nombre} {sevenMeterModal.player?.apellidos || ""}</p>
                  <button type="button" className="btn btn-outline-secondary mb-2" onClick={() => registerSevenMeter("outside", "outside")} aria-label="Lanzamiento de 7 metros fuera de portería" title="Lanzamiento de 7 metros fuera de portería"><i className="fa-solid fa-arrow-up-right-from-square me-1" aria-hidden="true" />Fuera de portería</button>
                  <div className="goal-frame">
                    <div className="goal-grid">
                      {shotZones.map(([zone, label]) => (
                        <button type="button" className={`goal-zone ${sevenMeterModal.zone === zone ? "is-selected" : ""}`} key={zone} onClick={() => setSevenMeterModal((current) => ({ ...current, zone }))} aria-label={label} title={label}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {sevenMeterModal.zone && (
                    <div className="mt-3">
                      <div className="small text-muted mb-2">Resultado en {shotZones.find(([zone]) => zone === sevenMeterModal.zone)?.[1]}</div>
                      <div className="row justify-content-center g-2" role="group" aria-label="Resultado del lanzamiento de 7 metros">
                        <div className="col-6 col-lg-2"><button type="button" className="btn btn-success w-100" onClick={() => registerSevenMeter("goal")} title="Gol de 7 metros">Gol</button></div>
                        <div className="col-6 col-lg-2"><button type="button" className="btn btn-danger w-100" onClick={() => registerSevenMeter("save")} title="Parada del portero">Parada</button></div>
                        <div className="col-6 col-lg-2"><button type="button" className="btn btn-secondary w-100" onClick={() => registerSevenMeter("outside")} title="Lanzamiento fuera">Fuera</button></div>
                      </div>
                    </div>
                  )}
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
