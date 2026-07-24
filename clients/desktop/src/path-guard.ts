import path from 'node:path'

/** Returns true when candidate resolves to a path under root (no traversal escape). */
export function isPathUnderRoot(candidatePath: string, rootPath: string): boolean {
  const normalizedRoot = path.resolve(rootPath)
  const normalizedCandidate = path.resolve(candidatePath)
  const relative = path.relative(normalizedRoot, normalizedCandidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}
