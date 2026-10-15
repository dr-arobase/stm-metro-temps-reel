const fs = require('fs');
const path = require('path');

const OVERPASS_URL = 'https://overpass.kumi.systems/api/interpreter?data=[out:json];relation(19760936);out geom;';
const LINES_PATH = path.join(__dirname, '..', 'public', 'data', 'lines.geojson');

async function main() {
  console.log('Fetching Overpass relation 19760936...');
  const res = await fetch(OVERPASS_URL);
  if (!res.ok) throw new Error('Overpass request failed: ' + res.status);
  const json = await res.json();

  const relation = json.elements && json.elements.find(e => e.type === 'relation' && e.id === 19760936);
  if (!relation) throw new Error('Relation 19760936 not found in Overpass response');

  const multi = [];
  for (const m of relation.members) {
    if (!m.geometry || !Array.isArray(m.geometry) || m.geometry.length === 0) continue;
    const coords = m.geometry.map(g => [g.lon, g.lat]);
    multi.push(coords);
  }

  if (multi.length === 0) throw new Error('No member geometries to build MultiLineString');

  const data = JSON.parse(fs.readFileSync(LINES_PATH, 'utf8'));

  // Create a new feature for this relation (id 19760936)
  const feature = {
    type: 'Feature',
    properties: {
      route_id: '19760936',
      name: relation.tags && relation.tags.name ? relation.tags.name : 'OSM 19760936',
      color: '#888888',
      textColor: '#ffffff',
      source: 'osm_relation_19760936'
    },
    geometry: {
      type: 'MultiLineString',
      coordinates: multi
    }
  };

  data.features.push(feature);
  fs.writeFileSync(LINES_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log('Inserted OSM relation 19760936 into', LINES_PATH);
}

main().catch(err => { console.error(err); process.exit(1); });
