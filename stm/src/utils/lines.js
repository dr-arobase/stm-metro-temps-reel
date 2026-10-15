/** Correspondance routeId STM → couleur hex */
export const LINE_COLORS = {
  '1': '#00A650', // Verte
  '2': '#F4790B', // Orange
  '4': '#FFD700', // Jaune
  '5': '#0085CA', // Bleue
}

export const LINE_NAMES = {
  '1': 'Ligne Verte',
  '2': 'Ligne Orange',
  '4': 'Ligne Jaune',
  '5': 'Ligne Bleue',
}

export function getLineColor(routeId) {
  return LINE_COLORS[routeId] ?? '#888'
}

export function getLineName(routeId) {
  if (!routeId && routeId !== 0) return null
  return LINE_NAMES[routeId] ?? `Route ${routeId}`
}
