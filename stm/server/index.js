/**
 * server/index.js — Proxy Express pour les flux GTFS-Realtime de la STM
 *
 * Endpoints exposés :
 *   GET /api/vehicles  — positions des rames (VehiclePosition)
 *   GET /api/alerts    — alertes de service (ServiceAlert)
 *
 * Variables d'environnement requises (fichier .env) :
 *   STM_API_KEY  — votre clé API STM (portail developpeurs.stm.info)
 */

const express = require('express')
const cors = require('cors')
const fetch = require('node-fetch')
const GtfsRealtimeBindings = require('gtfs-realtime-bindings')
require('dotenv').config()

const app = express()
app.use(cors())

const PORT = process.env.PORT || 3002
const API_KEY = process.env.STM_API_KEY || ''

// Base URL du portail STM
const STM_BASE = 'https://api.stm.info/pub/od/gtfs-rt/ic/v2'

const FEEDS = {
  vehicles: `${STM_BASE}/vehiclePositions`,
  alerts:   `${STM_BASE}/serviceAlerts`,
  trips:    `${STM_BASE}/tripUpdates`
}

/**
 * Récupère et décode un flux GTFS-RT protobuf de la STM.
 * Retourne le FeedMessage désérialisé.
 */
async function fetchGtfsRt(url) {
  const res = await fetch(url, {
    headers: {
      apikey: API_KEY,
      accept: 'application/x-protobuf'
    }
  })
  if (!res.ok) {
    throw new Error(`STM API error ${res.status}: ${await res.text()}`)
  }
  const buffer = await res.buffer()
  return GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
    new Uint8Array(buffer)
  )
}

// ─── GET /api/vehicles ───────────────────────────────────────────────────────
app.get('/api/vehicles', async (req, res) => {
  try {
    const feed = await fetchGtfsRt(FEEDS.vehicles)
    const vehicles = feed.entity
      .filter(e => e.vehicle && e.vehicle.position)
      .map(e => {
        const v = e.vehicle
        return {
          id:        e.id,
          tripId:    v.trip?.tripId  ?? null,
          routeId:   v.trip?.routeId ?? null,
          label:       v.vehicle?.label ?? e.id,
          lat:         v.position.latitude,
          lon:         v.position.longitude,
          bearing:     v.position.bearing ?? 0,
          speed:       v.position.speed   ?? 0,
          directionId: v.trip?.directionId ?? null,
          timestamp:   v.timestamp ? Number(v.timestamp) : null
        }
      })
    res.json(vehicles)
  } catch (err) {
    console.error('[/api/vehicles]', err.message)
    res.status(502).json({ error: err.message })
  }
})

// ─── GET /api/alerts ─────────────────────────────────────────────────────────
// serviceAlerts non disponible avec la souscription PUBLIC STM → retourne []
app.get('/api/alerts', (_req, res) => res.json([]))

// ─── GET /api/metro-positions ─────────────────────────────────────────────────
// Simule les positions des rames de métro à partir des horaires GTFS statiques.
// Interpolation linéaire entre les arrêts selon l'heure actuelle.
let metroSchedule = null

function loadMetroSchedule() {
  if (metroSchedule) return metroSchedule
  const p = require('path').join(__dirname, '..', 'public', 'data', 'metro-schedule.json')
  try {
    metroSchedule = JSON.parse(require('fs').readFileSync(p, 'utf8'))
    console.log(`[metro] Schedule loaded: ${Object.keys(metroSchedule).length} trips`)
  } catch (e) {
    console.warn('[metro] metro-schedule.json not found:', e.message)
    metroSchedule = {}
  }
  return metroSchedule
}

app.get('/api/metro-positions', (req, res) => {
  const schedule = loadMetroSchedule()
  const now = new Date()
  // Secondes depuis minuit (heure locale de Montréal = UTC-4 en été, UTC-5 en hiver)
  const tzOffset = now.getTimezoneOffset() * 60  // en secondes
  const nowSec = (now.getTime() / 1000 - tzOffset) % 86400

  const positions = []

  for (const [tripId, trip] of Object.entries(schedule)) {
    const stops = trip.stops
    if (!stops.length) continue

    const firstDep = stops[0].dep
    const lastArr  = stops[stops.length - 1].arr

    // Le trip est actif si l'heure actuelle est entre le départ du 1er arrêt et l'arrivée au dernier
    // On tolère ±2h pour les services de fin de nuit (dep > 24h)
    const active = (nowSec >= firstDep - 60) && (nowSec <= lastArr + 60)
    if (!active) continue

    // Trouver le segment actuel [i, i+1]
    let pos = null
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i]
      const b = stops[i + 1]
      if (nowSec >= a.dep && nowSec <= b.arr) {
        // Interpolation linéaire
        const t = (nowSec - a.dep) / Math.max(b.arr - a.dep, 1)
        const lon = a.lon + t * (b.lon - a.lon)
        const lat = a.lat + t * (b.lat - a.lat)

        // Bearing approximatif
        const dx = b.lon - a.lon
        const dy = b.lat - a.lat
        const bearing = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360

        pos = { lon, lat, bearing }
        break
      }
      // Entre l'arrivée et le départ d'un arrêt (train immobilisé)
      if (nowSec >= a.arr && nowSec < a.dep) {
        pos = { lon: a.lon, lat: a.lat, bearing: 0 }
        break
      }
    }

    // Si on est après le dernier départ, placer à la dernière station
    if (!pos) {
      const last = stops[stops.length - 1]
      if (nowSec >= last.arr) pos = { lon: last.lon, lat: last.lat, bearing: 0 }
    }

    if (pos) {
      positions.push({
        id:          tripId,
        tripId,
        routeId:     trip.routeId,
        label:       `${trip.routeId}-${tripId.slice(-4)}`,
        lat:         pos.lat,
        lon:         pos.lon,
        bearing:     pos.bearing,
        speed:       0,
        headsign:    trip.headsign,
        directionId: trip.direction ?? null,
        simulated:   true,
      })
    }
  }

  res.json(positions)
})

// ─── GET /api/alerts ─── retourne [] si non disponible ────────────────────────
// (serviceAlerts non disponible avec cette souscription — retourné silencieusement)

// ─── Healthcheck ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.listen(PORT, () =>
  console.log(`[STM proxy] Listening on http://localhost:${PORT}`)
)
