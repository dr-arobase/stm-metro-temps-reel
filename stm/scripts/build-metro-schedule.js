/**
 * build-metro-schedule.js
 * Pre-processes GTFS static data into a compact JSON index for metro simulation.
 * Reads stop_times.txt (235 MB) once and saves only metro data.
 *
 * Output: public/data/metro-schedule.json
 *
 * Usage: node scripts/build-metro-schedule.js <gtfs_dir>
 */

const fs = require('fs')
const path = require('path')
const readline = require('readline')

const GTFS_DIR = process.argv[2]
if (!GTFS_DIR) {
  console.error('Usage: node scripts/build-metro-schedule.js <gtfs_dir>')
  process.exit(1)
}

const METRO_ROUTES = {
  '1': { name: 'Ligne 1 – Verte',  color: '#00B300' },
  '2': { name: 'Ligne 2 – Orange', color: '#D95700' },
  '4': { name: 'Ligne 4 – Jaune',  color: '#FFD900' },
  '5': { name: 'Ligne 5 – Bleue',  color: '#0095E6' },
}

function readLines(file, onLine) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: fs.createReadStream(path.join(GTFS_DIR, file), { encoding: 'utf8' }),
      crlfDelay: Infinity,
    })
    let header = null
    rl.on('line', line => {
      if (!line.trim()) return
      if (!header) { header = line.split(','); return }
      const fields = line.split(',')
      const obj = {}
      header.forEach((h, i) => { obj[h.trim()] = (fields[i] || '').trim() })
      onLine(obj)
    })
    rl.on('close', resolve)
    rl.on('error', reject)
  })
}

// Convert "HH:MM:SS" (can be > 24h) to seconds since midnight
function timeToSec(t) {
  const [h, m, s] = t.split(':').map(Number)
  return h * 3600 + m * 60 + (s || 0)
}

async function main() {
  console.log('📂 GTFS dir:', GTFS_DIR)

  // ── 1. Lire trips.txt → trouver les metro trips ───────────────────────────
  console.log('🚇 Lecture trips.txt...')
  const metroTrips = {}  // trip_id → { routeId, direction, headsign }
  await readLines('trips.txt', row => {
    if (!METRO_ROUTES[row.route_id]) return
    metroTrips[row.trip_id] = {
      routeId:   row.route_id,
      direction: parseInt(row.direction_id),
      headsign:  row.trip_headsign,
      shapeId:   row.shape_id,
    }
  })
  console.log(`   ${Object.keys(metroTrips).length} metro trips trouvés`)

  // ── 2. Lire stops.txt → coordonnées des stations mère ────────────────────
  console.log('📍 Lecture stops.txt (stations parent)...')
  const parentCoords = {}  // STATION_Mxxx → [lon, lat]
  const stopToParent = {}  // numeric_id → STATION_Mxxx
  await readLines('stops.txt', row => {
    if (row.location_type === '1' && row.stop_id.startsWith('STATION_M')) {
      parentCoords[row.stop_id] = [parseFloat(row.stop_lon), parseFloat(row.stop_lat)]
    } else if (row.location_type === '0' && row.parent_station.startsWith('STATION_M')) {
      stopToParent[row.stop_id] = row.parent_station
    }
  })

  // ── 3. Lire stop_times.txt → horaires metro uniquement ───────────────────
  console.log('🕐 Lecture stop_times.txt (filtre metro)…  [peut prendre 60s]')
  const targetTrips = new Set(Object.keys(metroTrips))

  // trip_id → [ { seq, stop_id, arrSec, depSec } ]
  const tripStopTimes = {}

  await readLines('stop_times.txt', row => {
    if (!targetTrips.has(row.trip_id)) return
    if (!tripStopTimes[row.trip_id]) tripStopTimes[row.trip_id] = []
    tripStopTimes[row.trip_id].push({
      seq:    parseInt(row.stop_sequence),
      stopId: row.stop_id,
      arr:    timeToSec(row.arrival_time),
      dep:    timeToSec(row.departure_time),
    })
  })
  console.log(`   ${Object.keys(tripStopTimes).length} trips avec horaires`)

  // ── 4. Assembler l'index compact ─────────────────────────────────────────
  console.log('📦 Construction de l\'index...')
  const schedule = {}  // trip_id → { routeId, direction, headsign, stops: [{arr,dep,lon,lat}] }

  for (const [tripId, meta] of Object.entries(metroTrips)) {
    const times = tripStopTimes[tripId]
    if (!times || times.length === 0) continue

    times.sort((a, b) => a.seq - b.seq)

    const stops = times.map(t => {
      const parentId = stopToParent[t.stopId]
      const coords = parentId ? parentCoords[parentId] : null
      return {
        arr: t.arr,
        dep: t.dep,
        lon: coords ? coords[0] : null,
        lat: coords ? coords[1] : null,
      }
    }).filter(s => s.lon !== null)

    if (stops.length < 2) continue

    schedule[tripId] = {
      routeId:   meta.routeId,
      direction: meta.direction,
      headsign:  meta.headsign,
      stops,
    }
  }

  console.log(`   ${Object.keys(schedule).length} trips dans l'index`)

  // ── 5. Écrire l'index ─────────────────────────────────────────────────────
  const outDir = path.join(__dirname, '..', 'public', 'data')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'metro-schedule.json')
  fs.writeFileSync(outPath, JSON.stringify(schedule), 'utf8')

  const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2)
  console.log(`✅ metro-schedule.json → ${outPath} (${sizeMB} MB)`)

  // Résumé par ligne
  const counts = {}
  for (const t of Object.values(schedule)) counts[t.routeId] = (counts[t.routeId] || 0) + 1
  for (const [r, c] of Object.entries(counts)) {
    console.log(`   Ligne ${r}: ${c} trips`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
