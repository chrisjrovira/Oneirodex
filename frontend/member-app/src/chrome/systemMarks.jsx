/** Family marks for Systems hub tiles (B+C). */

const base = {
  width: 28,
  height: 28,
  viewBox: '0 0 28 28',
  fill: 'none',
  'aria-hidden': true,
  focusable: 'false',
}

export function MarkNintendo(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="8" width="22" height="12" rx="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="10" cy="14" r="2" fill="currentColor" />
      <rect x="16" y="11" width="6" height="2" rx="1" fill="currentColor" />
      <rect x="16" y="15" width="6" height="2" rx="1" fill="currentColor" />
    </svg>
  )
}

export function MarkSony(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 18c4-8 12-8 16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="14" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export function MarkXbox(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="14" cy="14" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M8 10c3 2 9 2 12 0M8 18c3-2 9-2 12 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function MarkSega(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 14h18M9 9l-3 5 3 5M19 9l3 5-3 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function MarkPc(props) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="6" width="20" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M10 22h8M14 19v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function MarkRetro(props) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="7" width="18" height="14" rx="1" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11h3v3H8zM13 11h3v3h-3zM18 11h2v2h-2zM18 15h2v2h-2z" fill="currentColor" />
    </svg>
  )
}

const BY_FAMILY = {
  nintendo: MarkNintendo,
  sony: MarkSony,
  xbox: MarkXbox,
  sega: MarkSega,
  pc: MarkPc,
  atari: MarkRetro,
}

export function SystemFamilyMark({ family, ...props }) {
  const Icon = BY_FAMILY[family] || MarkPc
  return <Icon {...props} />
}
