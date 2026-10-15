/**
 * build-geojson.js
 * Génère public/data/lines.geojson et public/data/stations.geojson
 * à partir des fichiers GTFS de la STM.
 *
 * Usage: node scripts/build-geojson.js <chemin_vers_gtfs_stm>
 * Exemple: node scripts/build-geojson.js "C:\Users\mchir\OneDrive - Collège de Maisonneuve\projet hors École\stm\gtfs_stm"
 */

const fs = require('fs')
const path = require('path')
const readline = require('readline')

const GTFS_DIR = process.argv[2]
if (!GTFS_DIR) {
  console.error('Usage: node scripts/build-geojson.js <gtfs_dir>')
  process.exit(1)
}

// ─── Config ──────────────────────────────────────────────────────────────────
const METRO_ROUTES = {
  '1': { name: 'Ligne 1 – Verte',  color: '#00B300', textColor: '#FFFFFF' },
  '2': { name: 'Ligne 2 – Orange', color: '#D95700', textColor: '#FFFFFF' },
  '4': { name: 'Ligne 4 – Jaune',  color: '#FFD900', textColor: '#000000' },
  '5': { name: 'Ligne 5 – Bleue',  color: '#0095E6', textColor: '#FFFFFF' },
}

// Un trip représentatif par ligne pour récupérer l'ordre des stations
const TRIP_FOR_ROUTE = {
  '290160559': '1',  // Line 1 → Honoré-Beaugrand (shape 11071)
  '290447840': '2',  // Line 2 → Côte-Vertu      (shape 20236)
  '290163710': '4',  // Line 4 → Longueuil        (shape 40024)
  '290164341': '5',  // Line 5 → Saint-Michel     (shape 51763)
}

// Un shape représentatif par ligne pour le tracé visuel
const SHAPE_FOR_ROUTE = {
  '1': '11071',  // 27 pts – Angrignon → Honoré-Beaugrand
  '2': '20236',  // 31 pts – Montmorency → Côte-Vertu (ligne complète)
  '4': '40024',  //  3 pts – Berri-UQAM ↔ Longueuil
  '5': '51763',  // 12 pts – Saint-Michel → Snowdon
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('📂 GTFS dir:', GTFS_DIR)

  // ── 1. Lire stops.txt ─────────────────────────────────────────────────────
  console.log('📍 Lecture stops.txt...')
  const parentStations = {}  // STATION_Mxxx → { name, lat, lon }
  const stopToParent   = {}  // numeric_stop_id → STATION_Mxxx

  await readLines('stops.txt', row => {
    const type = row.location_type
    if (type === '1' && row.stop_id.startsWith('STATION_M')) {
      parentStations[row.stop_id] = {
        name: toTitleCase(row.stop_name.replace(/^STATION /i, '')),
        lat: parseFloat(row.stop_lat),
        lon: parseFloat(row.stop_lon),
        line: null,
      }
    } else if (type === '0' && row.parent_station && row.parent_station.startsWith('STATION_M')) {
      stopToParent[row.stop_id] = row.parent_station
    }
  })
  console.log(`   ${Object.keys(parentStations).length} stations parent trouvées`)

  // ── 2. Lire stop_times.txt (235 MB) – on ne lit que les trips cibles ──────
  console.log('🕐 Lecture stop_times.txt (peut prendre 30-60s)...')
  const tripStops = {}  // trip_id → [ {seq, stop_id} ]
  const targetTrips = new Set(Object.keys(TRIP_FOR_ROUTE))

  await readLines('stop_times.txt', row => {
    if (!targetTrips.has(row.trip_id)) return
    if (!tripStops[row.trip_id]) tripStops[row.trip_id] = []
    tripStops[row.trip_id].push({ seq: parseInt(row.stop_sequence), stop_id: row.stop_id })
  })

  // Assigner chaque station parent à sa ligne
  for (const [tripId, routeId] of Object.entries(TRIP_FOR_ROUTE)) {
    const stops = (tripStops[tripId] || []).sort((a, b) => a.seq - b.seq)
    for (const { stop_id } of stops) {
      const parentId = stopToParent[stop_id]
      if (parentId && parentStations[parentId]) {
        parentStations[parentId].line = routeId
      }
    }
  }

  // Stations sans ligne assignée = stations de correspondance, on garde la dernière assignée
  console.log('   Assignation des lignes terminée')

  // ── 3. Lire shapes.txt (4.5 MB) ──────────────────────────────────────────
  console.log('🗺  Lecture shapes.txt...')
  const targetShapes = new Set(Object.values(SHAPE_FOR_ROUTE))
  const shapes = {}  // shape_id → [ [lon, lat] ] (GeoJSON order)

  await readLines('shapes.txt', row => {
    if (!targetShapes.has(row.shape_id)) return
    if (!shapes[row.shape_id]) shapes[row.shape_id] = []
    shapes[row.shape_id].push({
      seq: parseInt(row.shape_pt_sequence),
      coords: [parseFloat(row.shape_pt_lon), parseFloat(row.shape_pt_lat)],
    })
  })

  // Trier par séquence et extraire uniquement les coordonnées
  for (const id of Object.keys(shapes)) {
    shapes[id] = shapes[id]
      .sort((a, b) => a.seq - b.seq)
      .map(p => p.coords)
  }
  console.log(`   ${Object.keys(shapes).length} shapes extraits`)

  // ── 4. Construire lines.geojson ───────────────────────────────────────────
  console.log('✏️  Génération lines.geojson...')
  const lineFeatures = []

  for (const [routeId, meta] of Object.entries(METRO_ROUTES)) {
    const shapeId = SHAPE_FOR_ROUTE[routeId]
    if (!shapes[shapeId]) { console.warn(`   ⚠ Shape ${shapeId} introuvable`); continue }

    lineFeatures.push({
      type: 'Feature',
      properties: { route_id: routeId, name: meta.name, color: meta.color, textColor: meta.textColor },
      geometry: { type: 'LineString', coordinates: shapes[shapeId] },
    })
  }

  const linesGeoJSON = { type: 'FeatureCollection', features: lineFeatures }

  // ── 5. Construire stations.geojson ────────────────────────────────────────
  console.log('📌 Génération stations.geojson...')
  const stationFeatures = Object.entries(parentStations)
    .filter(([, s]) => s.line !== null && !isNaN(s.lat) && !isNaN(s.lon))
    .map(([stationId, s]) => ({
      type: 'Feature',
      properties: {
        station_id: stationId,
        name: s.name,
        route_id: s.line,
        color: METRO_ROUTES[s.line]?.color || '#888888',
      },
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
    }))

  // Stations de correspondance (plusieurs lignes) : Berri-UQAM, Lionel-Groulx, Snowdon, Jean-Talon
  // On détecte les doublons de coordonnées et on les marque interchange
  const stationsGeoJSON = { type: 'FeatureCollection', features: stationFeatures }

  // ── 6. Écrire les fichiers ─────────────────────────────────────────────────
  const outDir = path.join(__dirname, '..', 'public', 'data')
  fs.mkdirSync(outDir, { recursive: true })

  const linesPath    = path.join(outDir, 'lines.geojson')
  const stationsPath = path.join(outDir, 'stations.geojson')

  fs.writeFileSync(linesPath,    JSON.stringify(linesGeoJSON,    null, 2), 'utf8')
  fs.writeFileSync(stationsPath, JSON.stringify(stationsGeoJSON, null, 2), 'utf8')

  console.log(`✅ ${lineFeatures.length} lignes → ${linesPath}`)
  console.log(`✅ ${stationFeatures.length} stations → ${stationsPath}`)

  // Résumé par ligne
  for (const [routeId, meta] of Object.entries(METRO_ROUTES)) {
    const count = stationFeatures.filter(f => f.properties.route_id === routeId).length
    console.log(`   Ligne ${routeId} (${meta.name}): ${count} stations`)
  }
}

function toTitleCase(str) {
  return str
    .toLowerCase()
    .replace(/(?:^|\s|[-\/])\S/g, c => c.toUpperCase())
    .replace(/\bD(?:'|')([A-Z])/g, (_, c) => `D'${c}`)
}

main().catch(err => { console.error(err); process.exit(1) })
