import axios from 'axios'

const databaseName = 'ublmanager-offline'
const databaseVersion = 1
const recordsStore = 'records'
const operationsStore = 'operations'
const mappingsStore = 'mappings'
let syncInProgress = false

export function createClientId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(recordsStore)) database.createObjectStore(recordsStore, { keyPath: 'key' })
      if (!database.objectStoreNames.contains(operationsStore)) database.createObjectStore(operationsStore, { keyPath: 'id', autoIncrement: true })
      if (!database.objectStoreNames.contains(mappingsStore)) database.createObjectStore(mappingsStore, { keyPath: 'localId' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transaction(storeName, mode, action) {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = action(database.transaction(storeName, mode).objectStore(storeName))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function isLocalMatchId(matchId) {
  return String(matchId).startsWith('local-')
}

export function createLocalId() {
  return `local-${createClientId()}`
}

export async function saveOfflineRecord(key, value) {
  await transaction(recordsStore, 'readwrite', store => store.put({ key, value, updatedAt: Date.now() }))
}

export async function getOfflineRecord(key) {
  const record = await transaction(recordsStore, 'readonly', store => store.get(key))
  return record?.value ?? null
}

export async function queueOfflineOperation(operation) {
  await transaction(operationsStore, 'readwrite', store => store.add({
    ...operation,
    clientOperationId: createClientId(),
    createdAt: Date.now(),
    attempts: 0,
  }))
  window.dispatchEvent(new Event('offline-queue-changed'))
}

export async function getPendingOfflineOperations() {
  return (await transaction(operationsStore, 'readonly', store => store.getAll()))
    .sort((left, right) => left.id - right.id)
}

export async function removeOfflineOperation(id) {
  await transaction(operationsStore, 'readwrite', store => store.delete(id))
  window.dispatchEvent(new Event('offline-queue-changed'))
}

export async function getOfflineQueueSize() {
  return transaction(operationsStore, 'readonly', store => store.count())
}

export async function getOfflineMatchStatistics(matchId) {
  const followUp = await getOfflineRecord(`followup:${matchId}`)
  if (!followUp) return null
  const events = (await getOfflineRecord(`history:${matchId}`)) || followUp.events || []
  const summary = {
    matches: 1,
    home_score: Number(followUp.tracking?.home_score || 0),
    visitor_score: Number(followUp.tracking?.visitor_score || 0),
    goals: followUp.players.reduce((total, player) => total + Number(player.goals || 0), 0),
    shots: followUp.players.reduce((total, player) => total + Number(player.shots || 0), 0),
    seven_meters: followUp.players.reduce((total, player) => total + Number(player.seven_meters_attempted || 0), 0),
    time_on_court_seconds: followUp.players.reduce((total, player) => total + Number(player.time_on_court_seconds || 0), 0),
  }
  return { match: followUp.match, duration: followUp.duration, tracking: followUp.tracking, players: followUp.players, events, summary }
}

async function saveMatchMapping(localId, serverId) {
  await transaction(mappingsStore, 'readwrite', store => store.put({ localId, serverId }))
}

async function getMatchMappings() {
  return transaction(mappingsStore, 'readonly', store => store.getAll())
}

function replaceMatchId(value, mappings) {
  if (typeof value === 'string' || typeof value === 'number') {
    const mapping = mappings.find(item => String(item.localId) === String(value))
    if (mapping) return mapping.serverId
    if (typeof value === 'string') return mappings.reduce((result, item) => result.replaceAll(String(item.localId), String(item.serverId)), value)
    return value
  }
  if (Array.isArray(value)) return value.map(item => replaceMatchId(item, mappings))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceMatchId(item, mappings)]))
  return value
}

function isNetworkError(error) {
  return !error.response || error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED'
}

export async function requestOrQueue({ method, url, data, operationType, localMatchId }) {
  if (navigator.onLine !== false) {
    try {
      return { response: await axios({ method, url, data, headers: { 'X-Client-Operation-Id': createClientId() } }), offline: false }
    } catch (error) {
      if (!isNetworkError(error)) throw error
    }
  }
  await queueOfflineOperation({ method, url, data, operationType, localMatchId })
  return { response: null, offline: true }
}

export async function syncOfflineOperations() {
  if (syncInProgress) return { synced: 0, pending: await getOfflineQueueSize() }
  if (navigator.onLine === false) return { synced: 0, pending: await getOfflineQueueSize() }
  syncInProgress = true
  try {
    const operations = await getPendingOfflineOperations()
    const mappings = await getMatchMappings()
    let synced = 0
    for (const operation of operations) {
      try {
        const url = replaceMatchId(operation.url, mappings)
        const data = replaceMatchId(operation.data, mappings)
        const response = await axios({ method: operation.method, url, data, headers: { 'X-Client-Operation-Id': operation.clientOperationId } })
        if (operation.operationType === 'create-match' && operation.localMatchId && response.data?.id) {
          await saveMatchMapping(operation.localMatchId, response.data.id)
          const cachedMatch = await getOfflineRecord(`match:${operation.localMatchId}`)
          if (cachedMatch) {
            await saveOfflineRecord(`match:${response.data.id}`, { ...cachedMatch, ...response.data, id: response.data.id, synced: true })
            await saveOfflineRecord(`match:${operation.localMatchId}`, null)
          }
        }
        await removeOfflineOperation(operation.id)
        synced += 1
      } catch (error) {
        if (!isNetworkError(error)) console.error('No se pudo sincronizar una operación offline', error)
        break
      }
    }
    return { synced, pending: await getOfflineQueueSize() }
  } finally {
    syncInProgress = false
  }
}

export function startOfflineSync() {
  const sync = () => syncOfflineOperations().catch(error => console.error('Error sincronizando datos offline', error))
  window.addEventListener('online', sync)
  window.addEventListener('offline', () => window.dispatchEvent(new Event('offline-queue-changed')))
  window.addEventListener('offline-queue-changed', sync)
  sync()
  return () => {
    window.removeEventListener('online', sync)
    window.removeEventListener('offline-queue-changed', sync)
  }
}