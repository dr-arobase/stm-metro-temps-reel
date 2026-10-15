import { useMemo } from 'react'
import { GeoJSON } from 'react-leaflet'

/**
 * Affiche les tracés des lignes (GeoJSON LineString).
 * Accepte `showREM` pour masquer les lignes dont `route_id` commence par 'A' (REM).
 */
export default function LinesLayer({ data, showREM = true }) {
  if (!data) return null

  // Validation utilitaire pour GeoJSON features
  const isValidFeature = f => {
    try {
      if (!f || typeof f !== 'object') return false
      const g = f.geometry
      if (!g || !g.type) return false
      if (!Array.isArray(g.coordinates)) return false
      // Helper to validate a coordinate pair [lng, lat]
      const isCoord = c => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])
      // Reject empty coordinate arrays and any coords that are not valid number pairs
      if (g.type === 'MultiLineString') {
        if (!g.coordinates.some(arr => Array.isArray(arr) && arr.length > 0)) return false
        // ensure at least one valid coordinate pair exists in the multilines
        if (!g.coordinates.some(line => Array.isArray(line) && line.some(isCoord))) return false
      } else if (g.type === 'LineString') {
        if (!g.coordinates.length) return false
        if (!g.coordinates.some(isCoord)) return false
      } else if (g.type === 'Point') {
        if (!isCoord(g.coordinates)) return false
      }
      return true
    } catch (e) {
      return false
    }
  }

  const filtered = useMemo(() => {
    try {
      const features = Array.isArray(data.features) ? data.features.slice() : []
      console.debug('LinesLayer: raw features count', features.length)

      // Optionnel: filtrer REM
      let fList = features
      if (!showREM) {
        fList = fList.filter(f => {
          const props = f && f.properties ? f.properties : {}
          const id = props.route_id || ''
          const name = (props.name || '').toString().toLowerCase()
          const isREM = (typeof id === 'string' && id.startsWith('A')) || name.includes('rem')
          return !isREM
        })
      }

      // Garde seulement les features valides
      const valid = fList.filter(isValidFeature)
      if (valid.length !== fList.length) console.warn('LinesLayer: some features were skipped because they are invalid', fList.length - valid.length)
      // Debug: list invalid feature ids/names
      if (valid.length === 0 && fList.length > 0) {
        console.debug('LinesLayer: feature samples', fList.slice(0,5).map(f => ({ id: f.properties && f.properties.route_id, name: f.properties && f.properties.name, geom: f.geometry && f.geometry.type, coordsLen: f.geometry && Array.isArray(f.geometry.coordinates) ? f.geometry.coordinates.length : 0 })))
      }
      return { ...data, features: valid }
    } catch (err) {
      console.error('LinesLayer: error processing data', err)
      return { ...data, features: [] }
    }
  }, [data, showREM])

  if (!filtered || !Array.isArray(filtered.features) || filtered.features.length === 0) return null

  // Defensive: ensure no invalid features are passed to Leaflet GeoJSON
  const safeFeatures = filtered.features.filter(isValidFeature)
  if (safeFeatures.length !== filtered.features.length) console.warn('LinesLayer: removed invalid features before rendering', filtered.features.length - safeFeatures.length)

  return (
    <GeoJSON
      key="lines"
      data={filtered}
      style={feature => ({
        color: (feature && feature.properties && feature.properties.color) || '#ff00ff',
        weight: 7,
        opacity: 0.95,
        lineJoin: 'round',
        lineCap: 'round'
      })}
      onEachFeature={(feature, layer) => {
        try {
          const name = feature && feature.properties ? feature.properties.name : ''
          layer.bindTooltip(name, {
            permanent: false,
            direction: 'center',
            className: 'line-tooltip'
          })
        } catch (e) {
          // ignore binding errors per-feature
        }
      }}
    />
  )
}
