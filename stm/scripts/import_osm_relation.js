const fs = require('fs');
const path = require('path');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter?data=[out:json];relation(6170009);out geom;';
const LINES_PATH = path.join(__dirname, '..', 'public', 'data', 'lines.geojson');

async function main() {
  console.log('Fetching Overpass relation 6170009...');
  const res = await fetch(OVERPASS_URL);
  if (!res.ok) throw new Error('Overpass request failed: ' + res.status);
  const json = await res.json();

  const relation = json.elements && json.elements.find(e => e.type === 'relation' && e.id === 6170009);
  if (!relation) throw new Error('Relation 6170009 not found in Overpass response');
  if (!Array.isArray(relation.members) || relation.members.length === 0) throw new Error('No members with geometry found');

  // Build MultiLineString coordinates: for each member that has geometry, map to [lon, lat] pairs
  const multi = [];
  for (const m of relation.members) {
    if (!m.geometry || !Array.isArray(m.geometry) || m.geometry.length === 0) continue;
    const coords = m.geometry.map(g => [g.lon, g.lat]);
    multi.push(coords);
  }

  if (multi.length === 0) throw new Error('No member geometries to build MultiLineString');

  console.log('Loaded', multi.length, 'member geometries');

  // Read existing lines.geojson
  const data = JSON.parse(fs.readFileSync(LINES_PATH, 'utf8'));
  if (!Array.isArray(data.features)) throw new Error('Invalid lines.geojson format');

  // Find feature with route_id A2
  const feat = data.features.find(f => f && f.properties && String(f.properties.route_id) === 'A2');
  if (!feat) throw new Error('Feature with route_id "A2" not found in lines.geojson');

  feat.geometry = {
    type: 'MultiLineString',
    coordinates: multi
  };

  fs.writeFileSync(LINES_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log('Updated', LINES_PATH, 'with OSM relation geometry (A2)');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
