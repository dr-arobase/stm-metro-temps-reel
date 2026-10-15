import L from 'leaflet'
import { GeoJSON } from 'react-leaflet'
import { getLineName } from '../utils/lines'

function stationIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div class="station-dot" style="background:${color};"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -10]
  })
}

/**
 * Affiche les stations (GeoJSON Point).
 */
export default function StationsLayer({ data }) {
  if (!data) return null

  return (
    <GeoJSON
      key="stations"
      data={data}
      pointToLayer={(feature, latlng) =>
        L.marker(latlng, { icon: stationIcon(feature.properties.color) })
      }
      onEachFeature={(feature, layer) => {
        // Build a robust station popup showing available properties
        const p = feature.properties || {}
        const coords = feature.geometry && feature.geometry.coordinates ? feature.geometry.coordinates : null
        const rows = []
        if (p.name) rows.push(["Nom", p.name])
        if (p.station_id) rows.push(["ID", p.station_id])
        // Accept multiple possible property names for the route identifier
        const routeId = p.route_id ?? p.routeId ?? p.route ?? p.line ?? null
        if (routeId) {
          const name = getLineName(String(routeId)) || `Ligne ${routeId}`
          rows.push(["Ligne", name])
        }
        if (p.color) rows.push(["Couleur", p.color])
        if (coords) rows.push(["Coord.", `${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}`])

        const htmlRows = rows.map(r => `<div style="display:flex;justify-content:space-between;gap:8px;padding:3px 0"><strong style="color:#cbd2e6">${r[0]}</strong><span style="color:#9090b5">${r[1]}</span></div>`).join('')

        layer.bindPopup(`<div style="font-family:Inter,sans-serif;min-width:180px;padding:10px;background:var(--surface2);color:var(--text)">${htmlRows}</div>`)
      }}
    />
  )
}

// removed unused helper to avoid ambiguity
