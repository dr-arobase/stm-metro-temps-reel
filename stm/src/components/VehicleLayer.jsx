import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useMap } from 'react-leaflet'
import { getLineColor, getLineName } from '../utils/lines'

function buildIcon(v) {
  const bearing = v.bearing ?? 0

  if (v.type === 'bus') {
    // Bus : carré arrondi gris-bleu, plus petit
    const html = `
      <div class="bus-marker" style="transform:rotate(${bearing}deg)">
        <div class="vehicle-arrow"></div>
        <span class="vehicle-label">${v.routeId ?? '?'}</span>
      </div>`
    return L.divIcon({ className: '', html, iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -14] })
  }

  // Métro : cercle coloré par ligne
  const color = getLineColor(v.routeId)
  const html = `
    <div class="vehicle-marker" style="background:${color};transform:rotate(${bearing}deg)">
      <div class="vehicle-arrow"></div>
      <span class="vehicle-label">${v.routeId ?? '?'}</span>
    </div>`
  return L.divIcon({ className: '', html, iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -16] })
}

function buildPopup(v) {
  const muted = '#9090b5'
  const surfBg = '#18182a'
  // Build a generic, robust info table for any vehicle (bus or metro)
  const kmh = v.speed != null ? Math.round(v.speed * 3.6) : null
  const dirLabel = v.directionId === 0 ? 'Aller' : v.directionId === 1 ? 'Retour' : (v.directionId == null ? null : String(v.directionId))

  function fmtTimestamp(ts) {
    if (!ts && ts !== 0) return null
    // GTFS RT uses seconds; if timestamp looks like seconds (<=1e12) convert
    const n = Number(ts)
    const ms = n > 1e12 ? n : n * 1000
    const d = new Date(ms)
    if (Number.isNaN(d.getTime())) return String(ts)
    return d.toLocaleString('fr-CA')
  }

  const lines = []
  lines.push(['ID', v.id ?? '-'])
  const routeId = v.routeId ?? v.route ?? v.line ?? null
  if (routeId) {
    const lineLabel = v.type === 'metro' ? (getLineName(routeId) || `Ligne ${routeId}`) : `Route ${routeId}`
    lines.push(['Ligne', lineLabel])
  }
  if (v.tripId) lines.push(['Trip', v.tripId])
  if (v.label) lines.push(['Label', v.label])
  if (v.vehicleId) lines.push(['VehicleId', v.vehicleId])
  if (v.headsign) lines.push(['Headsign', v.headsign])
  if (v.lat != null && v.lon != null) lines.push(['Coordonnées', `${v.lat.toFixed(6)}, ${v.lon.toFixed(6)}`])
  if (v.bearing != null) lines.push(['Cap', `${Math.round(v.bearing)}°`])
  if (kmh != null) lines.push(['Vitesse', `${kmh} km/h`])
  if (dirLabel) lines.push(['Direction', dirLabel])
  if (v.timestamp != null) lines.push(['Horodatage', fmtTimestamp(v.timestamp)])

  // Render HTML table
  const rows = lines.map(([k, val]) => `<div style="display:flex;justify-content:space-between;gap:8px;padding:4px 0"><strong style="color:#cbd2e6;font-size:0.82rem">${k}</strong><span style="color:${muted};font-size:0.82rem;white-space:nowrap">${val}</span></div>`).join('')

  const title = v.type === 'metro' ? `${getLineName(v.routeId) || 'Métro'} — ${v.routeId ?? ''}`.trim() : `Bus ${v.routeId ?? ''}`

  return `<div style="padding:12px 16px;min-width:220px;font-family:Inter,sans-serif;background:${surfBg};color:#eaeaf2;border-radius:10px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <div style="width:36px;height:36px;border-radius:6px;background:${v.type === 'metro' ? getLineColor(v.routeId) : 'linear-gradient(135deg,#1a7abf,#0e5a8a)'};display:inline-flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:13px;flex-shrink:0"></div>
      <strong style="font-size:0.95rem;color:#eaeaf2">${title}</strong>
    </div>
    <div style="font-size:0.86rem">${rows}</div>
  </div>`
}

/**
 * Composant qui gère les marqueurs des véhicules (métro simulé + bus temps réel).
 */
export default function VehicleLayer({ vehicles }) {
  const map = useMap()
  const markersRef = useRef(new Map()) // id → L.Marker

  useEffect(() => {
    const currentIds = new Set(vehicles.map(v => v.id))

    for (const v of vehicles) {
      const icon = buildIcon(v)

      if (markersRef.current.has(v.id)) {
        const marker = markersRef.current.get(v.id)
        marker.setLatLng([v.lat, v.lon])
        marker.setIcon(icon)
      } else {
        const marker = L.marker([v.lat, v.lon], { icon })
          .bindPopup(buildPopup(v))
          .addTo(map)
        markersRef.current.set(v.id, marker)
      }
    }

    // Supprimer les marqueurs disparus
    for (const [id, marker] of markersRef.current) {
      if (!currentIds.has(id)) {
        map.removeLayer(marker)
        markersRef.current.delete(id)
      }
    }
  }, [vehicles, map])

  return null
}
