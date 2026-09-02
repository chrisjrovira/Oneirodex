/**
 * Colour a library's game count against the platform's released-set size.
 *
 * Green when we have (nearly) the full set; red when we have none or very
 * little. Returns null when there is no total to judge against — the UI must
 * stay neutral then, not treat "unknown" as empty.
 */
export function gameCountHeat(owned, total) {
  const have = Number(owned)
  const goal = Number(total)
  if (!Number.isFinite(goal) || goal <= 0 || !Number.isFinite(have) || have < 0) {
    return null
  }
  const ratio = Math.min(1, have / goal)
  const hue = Math.round(ratio * 120)
  return {
    ratio,
    hue,
    color: `hsl(${hue} 72% 52%)`,
    title: `${have} of ${goal} released`,
  }
}
