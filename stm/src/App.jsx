import { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, ZoomControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import Sidebar from './components/Sidebar.jsx'
import LinesLayer from './components/LinesLayer.jsx'
import StationsLayer from './components/StationsLayer.jsx'
import VehicleLayer from './components/VehicleLayer.jsx'
import DepotsLayer from './components/DepotsLayer.jsx'

import { useVehicles } from './hooks/useVehicles.js'
import { useAlerts } from './hooks/useAlerts.js'

import styles from './App.module.css'

const MTL_CENTER = [45.508, -73.587]
const MTL_ZOOM   = 12

export default function App() {
  const [linesData,    setLinesData]    = useState(null)
  const [stationsData, setStationsData] = useState(null)

  const [filter, setFilter] = useState({
    mode:       'all',                        // 'all' | 'metro' | 'bus'
    metroLines: new Set(['1','2','4','5']),   // lignes métro visibles
    busRoute:   '',                           // recherche par numéro de route
    direction:  null,                         // null | 0 | 1
  })

  const [now, setNow] = useState(new Date())
  const [showDepots, setShowDepots] = useState(true)
  const [showREM, setShowREM] = useState(true)
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const { vehicles, error: vehicleError, loading: vehicleLoading } = useVehicles()
  const { alerts,   error: alertsError,  loading: alertsLoading  } = useAlerts()

  useEffect(() => {
    // Charge toutes les features depuis un dossier en lisant son manifest.json
    async function loadFromFolder(folder, defaultIds, filePrefix) {
      let ids = defaultIds
      try {
        const mr = await fetch(`/data/${folder}/manifest.json`)
        if (mr.ok) {
          const m = await mr.json()
          if (Array.isArray(m) && m.length > 0) ids = m
        }
      } catch (e) { /* use default ids */ }

      const features = []
      await Promise.all(ids.map(async id => {
        // Try .geojson first; if missing, try .json as fallback (some files are .json)
        const candidates = [`/data/${folder}/${filePrefix}${id}.geojson`, `/data/${folder}/${filePrefix}${id}.json`]
        for (const url of candidates) {
          try {
            const r = await fetch(url)
            if (!r.ok) continue
            const d = await r.json()
            if (d && Array.isArray(d.features)) {
              const valid = d.features.filter(f => {
                if (!f || !f.geometry) return false
                const c = f.geometry.coordinates
                if (!Array.isArray(c) || c.length === 0) return false
                if (f.geometry.type === 'MultiLineString') {
                  return c.some(arr => Array.isArray(arr) && arr.length > 0)
                }
                return true
              })
              features.push(...valid)
              break
            } else if (d && d.type === 'Feature' && d.geometry) {
              features.push(d)
              break
            }
          } catch (e) {
            // try next candidate
          }
        }
      }))
      return features
    }

    async function loadAll() {
      const [lineFeatures, stationFeatures] = await Promise.all([
        loadFromFolder('lines',    ['1','2','4','5'], ''),
        loadFromFolder('stations', ['1','2','4','5','REM'], 'station_'),
      ])
      if (lineFeatures.length > 0) {
        setLinesData({ type: 'FeatureCollection', features: lineFeatures })
      }
      if (stationFeatures.length > 0) {
        setStationsData({ type: 'FeatureCollection', features: stationFeatures })
      }
    }

    loadAll()
  }, [])

  const metroCount = vehicles.filter(v => v.type === 'metro').length
  const busCount   = vehicles.filter(v => v.type === 'bus').length

  // Liste unique de routes bus (triée numériquement) pour le panneau de filtre
  const busRoutes = useMemo(() =>
    [...new Set(vehicles.filter(v => v.type === 'bus').map(v => v.routeId))]
      .sort((a, b) => Number(a) - Number(b)),
  [vehicles])

  // Véhicules filtrés selon les critères actifs
  const filteredVehicles = useMemo(() => vehicles.filter(v => {
    if (filter.mode === 'metro' && v.type !== 'metro') return false
    if (filter.mode === 'bus'   && v.type !== 'bus')   return false
    if (v.type === 'metro' && !filter.metroLines.has(v.routeId)) return false
    if (v.type === 'bus' && filter.busRoute &&
        !String(v.routeId).includes(filter.busRoute.trim())) return false
    if (filter.direction !== null &&
        v.directionId !== null && v.directionId !== undefined &&
        v.directionId !== filter.direction) return false
    return true
  }), [vehicles, filter])

  const shownMetro = filteredVehicles.filter(v => v.type === 'metro').length
  const shownBus   = filteredVehicles.filter(v => v.type === 'bus').length

  return (
    <div className={styles.layout}>
      <Sidebar
        alerts={alerts}
        alertsError={alertsError}
        alertsLoading={alertsLoading}
        metroCount={vehicleLoading ? '…' : metroCount}
        busCount={vehicleLoading ? '…' : busCount}
        shownMetro={shownMetro}
        shownBus={shownBus}
        vehicleError={vehicleError}
        filter={filter}
        onFilterChange={setFilter}
        busRoutes={busRoutes}
        now={now}
        showDepots={showDepots}
        onToggleDepots={() => setShowDepots(s => !s)}
        showREM={showREM}
        onToggleREM={() => setShowREM(s => !s)}
      />

      <div className={styles.mapContainer}>
        <div className={styles.statusBar}>
          <span className={styles.statusLeft}>
            <span className={styles.liveDot} />
            {vehicleLoading
              ? 'Chargement…'
              : vehicleError
              ? 'Erreur — affichage des dernières positions'
              : `${shownMetro} rame${shownMetro !== 1 ? 's' : ''} métro · ${shownBus} autobus affichés`
            }
          </span>
          <span className={styles.clock}>
            {now.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        <MapContainer
          center={MTL_CENTER}
          zoom={MTL_ZOOM}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <ZoomControl position="bottomright" />
          <LinesLayer data={linesData} showREM={showREM} />
          <StationsLayer data={stationsData} />
          {showDepots && <DepotsLayer />}
          <VehicleLayer vehicles={filteredVehicles} />
        </MapContainer>
      </div>
    </div>
  )
}
