export function tileSizeToCssVars(size) {
  const minMap = { S: '140px', M: '180px', L: '220px', XL: '280px' }
  const gapMap = { S: '6px', M: '10px', L: '12px', XL: '14px' }
  const key = minMap[size] ? size : 'M'
  return {
    '--gt-tile-min': minMap[key],
    '--gt-tile-gap': gapMap[key],
  }
}
