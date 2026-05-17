export function formatOccupied(mins) {
  const m = Math.floor(mins ?? 0)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem > 0 ? `${h}hr ${rem}m` : `${h}hr`
}
