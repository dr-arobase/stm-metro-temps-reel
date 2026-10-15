const fs = require('fs')
const path = require('path')

function usage() {
  console.log('Usage: node pretty-json.js <file.json>')
}

const argv = process.argv.slice(2)
if (argv.length < 1) {
  usage()
  process.exit(1)
}

const file = path.resolve(argv[0])
if (!fs.existsSync(file)) {
  console.error('File not found:', file)
  process.exit(2)
}

try {
  const raw = fs.readFileSync(file, 'utf8')
  const parsed = JSON.parse(raw)
  const pretty = JSON.stringify(parsed, null, 2)
  // Write to the same file (overwrite)
  fs.writeFileSync(file, pretty + '\n', 'utf8')
  console.log('Formatted', file)
} catch (e) {
  console.error('Error formatting JSON:', e.message)
  process.exit(3)
}
