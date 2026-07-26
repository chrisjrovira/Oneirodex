/** Collapse . / .. segments without relying on node:path typings. */
function resolvePath(input: string): string {
  const isWin = /^[a-zA-Z]:[\\/]/.test(input) || input.includes('\\')
  const sep = isWin ? '\\' : '/'
  let prefix = ''
  let rest = input.replace(/\//g, sep)
  if (/^[a-zA-Z]:\\/.test(rest)) {
    prefix = rest.slice(0, 3)
    rest = rest.slice(3)
  } else if (rest.startsWith('\\\\')) {
    const parts = rest.split(sep).filter(Boolean)
    prefix = `\\\\${parts.shift()}\\${parts.shift()}\\`
    rest = parts.join(sep)
  } else if (rest.startsWith(sep)) {
    prefix = sep
    rest = rest.slice(1)
  }
  const out: string[] = []
  for (const part of rest.split(sep)) {
    if (!part || part === '.') continue
    if (part === '..') {
      out.pop()
      continue
    }
    out.push(part)
  }
  return prefix + out.join(sep)
}

/** Returns true when candidate resolves to a path under root (no traversal escape). */
export function isPathUnderRoot(candidatePath: string, rootPath: string): boolean {
  const normalizedRoot = resolvePath(rootPath)
  const normalizedCandidate = resolvePath(candidatePath)
  if (normalizedCandidate === normalizedRoot) {
    return true
  }
  const rootWithSep = /[\\/]$/.test(normalizedRoot)
    ? normalizedRoot
    : `${normalizedRoot}${normalizedRoot.includes('\\') ? '\\' : '/'}`
  const rootCmp = normalizedRoot.toLowerCase()
  const candCmp = normalizedCandidate.toLowerCase()
  const rootSepCmp = rootWithSep.toLowerCase()
  return candCmp === rootCmp || candCmp.startsWith(rootSepCmp)
}
