import React, { useEffect, useState } from 'react'
import { getOfflineQueueSize } from '../utils/offlineStore'

export default function OfflineStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  const [pending, setPending] = useState(0)

  useEffect(() => {
    const refresh = () => getOfflineQueueSize().then(setPending).catch(() => setPending(0))
    const updateConnection = () => {
      setOnline(navigator.onLine)
      refresh()
    }
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    window.addEventListener('offline-queue-changed', refresh)
    refresh()
    return () => {
      window.removeEventListener('online', updateConnection)
      window.removeEventListener('offline', updateConnection)
      window.removeEventListener('offline-queue-changed', refresh)
    }
  }, [])

  return (
    <div className={`offline-status ${online ? 'is-online' : 'is-offline'}`} role="status" aria-live="polite" title={online ? 'Con conexión al servidor' : 'Sin conexión al servidor'}>
      <i className={`fa-solid ${online ? 'fa-wifi' : 'fa-cloud-arrow-down'}`} aria-hidden="true" />
      <span>{online ? 'Conectado' : 'Sin conexión'}</span>
      {pending > 0 && <strong>{pending} pendiente{pending === 1 ? '' : 's'}</strong>}
    </div>
  )
}