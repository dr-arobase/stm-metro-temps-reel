const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'public', 'data', 'lines.geojson');
const outDir = path.join(__dirname, '..', 'public', 'data', 'lines');

if (!fs.existsSync(src)) {
  console.error('Source file not found:', src);
  process.exit(1);
}

const raw = fs.readFileSync(src, 'utf8');
let fc;
try {
  fc = JSON.parse(raw);
} catch (err) {
  console.error('Failed to parse lines.geojson:', err.message);
  process.exit(1);
}

if (!fc.features || !Array.isArray(fc.features)) {
  console.error('Invalid FeatureCollection in lines.geojson');
  process.exit(1);
}

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const written = [];

fc.features.forEach((feat, i) => {
  const props = feat.properties || {};
  const route = props.route_id || props.name || `feature_${i}`;
  const safe = String(route).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = path.join(outDir, `${safe}.geojson`);
  const out = {
    type: 'FeatureCollection',
    features: [feat],
  };
  fs.writeFileSync(filename, JSON.stringify(out, null, 2));
  written.push({ route, filename });
});

console.log('Wrote', written.length, 'files to', outDir);
written.forEach(w => console.log('-', w.route, '->', w.filename));
