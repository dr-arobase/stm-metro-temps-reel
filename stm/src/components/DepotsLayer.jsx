import { useEffect, useState } from 'react'
import L from 'leaflet'
import { GeoJSON } from 'react-leaflet'

function depotIcon() {
  return L.divIcon({
    className: '',
    html: `<div class="depot-marker" style="width:14px;height:14px;border-radius:3px;background:#ff6b6b;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10]
  })
}

export default function DepotsLayer({ data: propData }) {
  const [data, setData] = useState(propData || null)

  useEffect(() => {
    if (propData) return // prop takes precedence
    // try to load public/data/depots.geojson if it exists
    fetch('/data/depots.geojson')
      .then(r => { if (!r.ok) throw new Error('no depots file') ; return r.json() })
      .then(j => setData(j))
      .catch(() => setData(null))
  }, [propData])

  if (!data) return null

  return (
    <GeoJSON
      key="depots"
      data={data}
      pointToLayer={(feature, latlng) => L.marker(latlng, { icon: depotIcon() })}
      onEachFeature={(feature, layer) => {
        const p = feature.properties || {}
        const rows = []
        if (p.name) rows.push(['Nom', p.name])
        if (p.type) rows.push(['Type', p.type])
        if (p.capacity) rows.push(['Capacité', p.capacity])
        if (p.address) rows.push(['Adresse', p.address])

        const coords = feature.geometry && feature.geometry.coordinates ? feature.geometry.coordinates : null
        if (coords) rows.push(['Coord.', `${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}`])

        const htmlRows = rows.map(r => `<div style="display:flex;justify-content:space-between;gap:8px;padding:3px 0"><strong style="color:#cbd2e6">${r[0]}</strong><span style="color:#9090b5">${r[1]}</span></div>`).join('')

        layer.bindPopup(`<div style="font-family:Inter,sans-serif;min-width:180px;padding:10px;background:var(--surface2);color:var(--text)">${htmlRows}</div>`)
      }}
    />
  )
}
