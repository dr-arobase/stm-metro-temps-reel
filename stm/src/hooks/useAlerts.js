import { useState, useEffect } from 'react'

const POLL_INTERVAL = 60_000 // alertes: toutes les 60s

/**
 * Hook : récupère les alertes de service depuis le proxy Express.
 */
export function useAlerts() {
  const [alerts, setAlerts]   = useState([])
  const [error, setError]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let timer

    async function poll() {
      try {
        const res = await fetch('/api/alerts', { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setAlerts(data)
        setError(null)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    poll()
    timer = setInterval(poll, POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [])

  return { alerts, error, loading }
}
