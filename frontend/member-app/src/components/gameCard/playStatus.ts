/* Play-status options moved out of GameCard (v11 cycle, H-D.2), unchanged. */

export interface StatusOption {
  value: string
  color: string
  label: string
}

export const STATUS_OPTIONS: StatusOption[] = [
  { value: 'unplayed', color: 'var(--od-status-unplayed)', label: 'Unplayed' },
  { value: 'unfinished', color: 'var(--od-status-unfinished)', label: 'Unfinished' },
  { value: 'beaten', color: 'var(--od-status-beaten)', label: 'Beaten' },
  { value: 'completed', color: 'var(--od-status-completed)', label: 'Completed' },
  { value: 'null', color: 'var(--od-status-wont-play)', label: "Won't Play" },
  { value: '', color: 'var(--od-status-none)', label: 'Clear Status' },
]

export const NO_STATUS: StatusOption = {
  value: '',
  color: 'var(--od-status-none)',
  label: 'No Status',
}

export function statusConfig(status: string | null | undefined): StatusOption {
  if (!status) {
    return NO_STATUS
  }
  return STATUS_OPTIONS.find((option) => option.value === status) || NO_STATUS
}
