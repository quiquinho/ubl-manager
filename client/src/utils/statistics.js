const attackActions = new Set(['goal', 'outside', 'seven_meter_goal', 'seven_meter_outside'])
const attackZones = ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']

function randomZone() {
  return attackZones[Math.floor(Math.random() * attackZones.length)]
}

export function addMissingAttackZones(events = [], targetShots = 0) {
  const normalized = events.map(event => attackActions.has(event.action) && !event.zone ? { ...event, zone: randomZone() } : event)
  const currentShots = normalized.filter(event => attackActions.has(event.action)).length
  const missingShots = Math.max(0, Number(targetShots || 0) - currentShots)
  for (let index = 0; index < missingShots; index += 1) {
    normalized.push({ id: `synthetic-shot-${index}`, action: 'outside', zone: randomZone(), created_at: new Date().toISOString() })
  }
  return normalized
}