export function tileSizeToCssVars(size) {
  const map = { S: '140px', M: '180px', L: '220px', XL: '280px' }
  return { '--gt-tile-min': map[size] || map.M }
}