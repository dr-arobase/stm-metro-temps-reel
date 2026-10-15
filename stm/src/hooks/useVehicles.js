import { useState, useEffect, useRef } from 'react'

const POLL_INTERVAL = 10000 // ms

/**
 * Hook : récupère les positions du métro (simulées) ET des autobus (temps réel).
 * Chaque véhicule a un champ `type`: 'metro' ou 'bus'.
 */
export function useVehicles() {
  const [vehicles, setVehicles] = useState([])
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const prevRef = useRef([])

  useEffect(() => {
    let timer

    async function poll() {
      try {
        const [metroRes, busRes] = await Promise.all([
          fetch('/api/metro-positions', { cache: 'no-store' }),
          fetch('/api/vehicles',        { cache: 'no-store' }),
        ])

        if (!metroRes.ok) throw new Error(`Métro HTTP ${metroRes.status}`)
        if (!busRes.ok)   throw new Error(`Bus HTTP ${busRes.status}`)

        const [metroData, busData] = await Promise.all([
          metroRes.json(),
          busRes.json(),
        ])

        const metro = metroData.map(v => ({ ...v, type: 'metro' }))
        const buses = busData.map(v  => ({ ...v, type: 'bus'   }))
        const all   = [...metro, ...buses]

        prevRef.current = all
        setVehicles(all)
        setError(null)
      } catch (err) {
        setError(err.message)
        setVehicles(prevRef.current)
      } finally {
        setLoading(false)
      }
    }

    poll()
    timer = setInterval(poll, POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [])

  return { vehicles, error, loading }
}
