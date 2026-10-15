const fs = require('fs');
const path = require('path');

const RELATIONS = [3228500, 58433];
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter?data=',
  'https://overpass.kumi.systems/api/interpreter?data=',
  'https://overpass.openstreetmap.fr/api/interpreter?data='
];
const LINES_PATH = path.join(__dirname, '..', 'public', 'data', 'lines.geojson');

async function fetchRelation(id) {
  const query = `[out:json];relation(${id});out geom;`;
  for (const base of OVERPASS_ENDPOINTS) {
    const url = base + encodeURIComponent(query);
    try {
      console.log('Trying Overpass endpoint', url);
      const res = await fetch(url);
      if (!res.ok) {
        console.warn('Endpoint failed', base, 'status', res.status);
        continue;
      }
      const json = await res.json();
      const relation = json.elements && json.elements.find(e => e.type === 'relation' && e.id === id);
      if (!relation) {
        console.warn('Relation', id, 'not found at endpoint', base);
        continue;
      }
      return relation;
    } catch (err) {
      console.warn('Error querying', base, '-', err.message);
      continue;
    }
  }
  throw new Error(`All Overpass endpoints failed for relation ${id}`);
}

function membersToMulti(relation) {
  const multi = [];
  for (const m of relation.members || []) {
    if (!m.geometry || !Array.isArray(m.geometry) || m.geometry.length === 0) continue;
    const coords = m.geometry.map(g => [g.lon, g.lat]);
    multi.push(coords);
  }
  return multi;
}

async function main() {
  if (!fs.existsSync(LINES_PATH)) throw new Error('lines.geojson not found at ' + LINES_PATH);
  const data = JSON.parse(fs.readFileSync(LINES_PATH, 'utf8'));
  if (!Array.isArray(data.features)) throw new Error('Invalid lines.geojson');

  const allMulti = [];
  for (const id of RELATIONS) {
    try {
      const rel = await fetchRelation(id);
      const multi = membersToMulti(rel);
      if (multi.length === 0) console.warn('No member geometries for relation', id);
      else {
        console.log('Relation', id, 'contributed', multi.length, 'members');
        allMulti.push(...multi);
      }
    } catch (err) {
      console.error('Error fetching relation', id, err.message);
    }
  }

  if (allMulti.length === 0) throw new Error('No geometries collected from relations');

  // Find feature with route_id "1"
  const feat = data.features.find(f => f && f.properties && String(f.properties.route_id) === '1');
  if (!feat) throw new Error('Feature with route_id "1" not found in lines.geojson');

  feat.geometry = {
    type: 'MultiLineString',
    coordinates: allMulti
  };
  // Keep name/color

  fs.writeFileSync(LINES_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log('Updated route 1 geometry with combined relations:', RELATIONS.join(', '));
}

main().catch(err => { console.error(err); process.exit(1); });
