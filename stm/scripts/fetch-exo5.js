const https = require('https');
const fs = require('fs');
const path = require('path');

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter?data=[out:json];relation(9344069);out%20geom;',
  'https://overpass.kumi.systems/api/interpreter?data=[out:json];relation(9344069);out%20geom;',
  'https://overpass.openstreetmap.fr/api/interpreter?data=[out:json];relation(9344069);out%20geom;'
];
const TARGET = path.join(__dirname, '..', 'public', 'data', 'lines', 'EXO_5.json');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': 'fetch-exo5-script/1.0 (+https://github.com)',
        Accept: 'application/json'
      }
    };
    https.get(url, opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          // Try parse JSON; if server returned XML error, surface a helpful message
          const ct = (res.headers['content-type'] || '').toLowerCase();
          if (ct.includes('xml') || data.trim().startsWith('<')) {
            return reject(new Error('Overpass returned XML (possible error or rate limit). Response starts with: ' + data.slice(0, 200)));
          }
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

function dedupeConsecutive(coords) {
  const out = [];
  for (let i = 0; i < coords.length; i++) {
    if (i === 0) out.push(coords[i]);
    else {
      const a = coords[i - 1];
      const b = coords[i];
      if (a[0] !== b[0] || a[1] !== b[1]) out.push(b);
    }
  }
  return out;
}

async function main() {
  console.log('Fetching relation 9344069 from Overpass (trying multiple endpoints)...');
  let json = null;
  let lastErr = null;
  for (const url of ENDPOINTS) {
    try {
      json = await fetchJson(url);
      console.log('Fetched from', url);
      break;
    } catch (err) {
      lastErr = err;
      console.warn('Endpoint failed:', url, err.message && err.message.slice(0, 200));
    }
  }
  if (!json) throw lastErr || new Error('All endpoints failed');
  const relation = Array.isArray(json.elements)
    ? json.elements.find((e) => e.type === 'relation')
    : null;
  if (!relation) throw new Error('Relation not found in Overpass response');

  const members = relation.members || [];
  const coords = [];
  for (const m of members) {
    if (m.geometry && m.geometry.length && m.type === 'way') {
      for (const p of m.geometry) coords.push([p.lon, p.lat]);
    }
  }
  const cleaned = dedupeConsecutive(coords);

  const targetPath = path.join(__dirname, '..', 'public', 'data', 'lines', 'EXO_5.json');
  if (!fs.existsSync(targetPath)) throw new Error('Target file not found: ' + targetPath);
  const data = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  if (!data.features || !data.features[0]) throw new Error('Unexpected GeoJSON structure in target file');

  data.features[0].geometry = data.features[0].geometry || { type: 'LineString', coordinates: [] };
  data.features[0].geometry.coordinates = cleaned;

  // prefer relation colour tag (some relations use 'colour')
  const tags = relation.tags || {};
  const colour = tags.colour || tags.color || '#FF00FF';
  data.features[0].properties = data.features[0].properties || {};
  data.features[0].properties.color = colour;
  if (tags.text_color) data.features[0].properties.textColor = tags.text_color;
  data.features[0].properties.osm_relation = relation.id;

  fs.writeFileSync(targetPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('Updated', targetPath, '->', cleaned.length, 'points');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
