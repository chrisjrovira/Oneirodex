import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import * as api from '../api/achievements'
import { AchievementsPanel } from './AchievementsPanel'

vi.mock('../api/achievements', async () => {
  const actual = await vi.importActual('../api/achievements')
  return {
    ...actual,
    fetchGameAchievements: vi.fn(),
    saveRetroAchievementsUsername: vi.fn(),
  }
})

vi.mock('../utils/toast', () => ({
  showToast: vi.fn(),
}))

const GAME_UUID = '11111111-1111-4111-8111-111111111111'

function achievement(id, earned = false) {
  return {
    id,
    title: `Achievement ${id}`,
    description: `Do the thing ${id}`,
    points: id * 5,
    badge_url: `https://media.retroachievements.org/Badge/0000${id}.png`,
    earned,
    earned_hardcore: false,
    display_order: id,
  }
}

beforeEach(() => {
  api.fetchGameAchievements.mockReset()
  api.saveRetroAchievementsUsername.mockReset()
})

test('renders nothing when no set carries achievements', async () => {
  api.fetchGameAchievements.mockResolvedValue({
    supports_achievements: false,
    ra_game_id: null,
    ra_achievements: 0,
    ra_url: null,
    configured: true,
    ra_username: null,
    unlocks_here: false,
    me: null,
  })
  const { container } = render(<AchievementsPanel gameUuid={GAME_UUID} />)
  await waitFor(() => {
    expect(container.querySelector('#achievements')).toBeNull()
  })
})

test('a matched set says it exists and that playing here does not unlock it', async () => {
  api.fetchGameAchievements.mockResolvedValue({
    supports_achievements: true,
    ra_game_id: 1001,
    ra_achievements: 42,
    ra_url: 'https://retroachievements.org/game/1001',
    configured: true,
    ra_username: null,
    unlocks_here: false,
    me: null,
  })
  render(<AchievementsPanel gameUuid={GAME_UUID} />)
  expect(await screen.findByRole('heading', { name: 'Achievements' })).toBeInTheDocument()
  expect(screen.getByText(/does not unlock them/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /view the set/i })).toHaveAttribute(
    'href',
    'https://retroachievements.org/game/1001',
  )
  // No username yet -> the form, not a progress list.
  expect(screen.getByLabelText(/RetroAchievements username/i)).toBeInTheDocument()
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
})

test('saving a username reloads and shows progress', async () => {
  api.fetchGameAchievements
    .mockResolvedValueOnce({
      supports_achievements: true,
      ra_game_id: 1001,
      ra_achievements: 2,
      ra_url: null,
      configured: true,
      ra_username: null,
      unlocks_here: false,
      me: null,
    })
    .mockResolvedValueOnce({
      supports_achievements: true,
      ra_game_id: 1001,
      ra_achievements: 2,
      ra_url: null,
      configured: true,
      ra_username: 'Player_1',
      unlocks_here: false,
      me: {
        username: 'Player_1',
        total: 2,
        earned: 1,
        earned_hardcore: 0,
        completion: '50.00%',
        completion_hardcore: '0.00%',
        achievements: [achievement(1, true), achievement(2, false)],
      },
    })
  api.saveRetroAchievementsUsername.mockResolvedValue({ ra_username: 'Player_1', configured: true })

  render(<AchievementsPanel gameUuid={GAME_UUID} />)
  const input = await screen.findByLabelText(/RetroAchievements username/i)
  await userEvent.type(input, 'Player_1')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => {
    expect(api.saveRetroAchievementsUsername).toHaveBeenCalledWith('Player_1')
  })
  expect(await screen.findByText(/of 2 earned as Player_1/)).toBeInTheDocument()
  const rows = screen.getAllByRole('listitem')
  expect(rows).toHaveLength(2)
  expect(rows[0]).toHaveAttribute('data-earned', 'true')
  expect(rows[1]).toHaveAttribute('data-earned', 'false')
})

test('long sets collapse to twelve until asked', async () => {
  api.fetchGameAchievements.mockResolvedValue({
    supports_achievements: true,
    ra_game_id: 7,
    ra_achievements: 20,
    ra_url: null,
    configured: true,
    ra_username: 'Player_1',
    unlocks_here: false,
    me: {
      username: 'Player_1',
      total: 20,
      earned: 0,
      earned_hardcore: 0,
      completion: '0.00%',
      completion_hardcore: '0.00%',
      achievements: Array.from({ length: 20 }, (_, i) => achievement(i + 1)),
    },
  })
  render(<AchievementsPanel gameUuid={GAME_UUID} />)
  expect(await screen.findAllByRole('listitem')).toHaveLength(12)
  await userEvent.click(screen.getByRole('button', { name: /Show all 20/ }))
  expect(screen.getAllByRole('listitem')).toHaveLength(20)
})
