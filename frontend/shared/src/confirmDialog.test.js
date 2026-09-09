import { afterEach, describe, expect, test } from 'vitest'
import { confirmAction } from './confirmDialog.js'

afterEach(() => {
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})

function panel() {
  return document.querySelector('.od-confirm__panel')
}

function buttonNamed(text) {
  return [...document.querySelectorAll('.od-confirm__actions button')].find(
    (b) => b.textContent === text,
  )
}

describe('confirmAction (UID-042)', () => {
  test('names both buttons after the action, not OK/Cancel', async () => {
    const answer = confirmAction({
      title: 'Delete “Shooters”?',
      body: 'The games stay in your catalog — only the collection goes.',
      confirmLabel: 'Delete collection',
      cancelLabel: 'Keep it',
    })

    expect(panel()).toBeTruthy()
    expect(buttonNamed('Delete collection')).toBeTruthy()
    expect(buttonNamed('Keep it')).toBeTruthy()
    expect(document.body.textContent).toContain('only the collection goes')

    buttonNamed('Delete collection').click()
    expect(await answer).toBe(true)
  })

  test('cancel resolves false and clears the dialog', async () => {
    const answer = confirmAction({ title: 'Revoke token?', confirmLabel: 'Revoke token' })
    buttonNamed('Cancel').click()
    expect(await answer).toBe(false)
    expect(panel()).toBeNull()
    expect(document.body.style.overflow).toBe('')
  })

  test('Escape cancels', async () => {
    const answer = confirmAction({ title: 'Archive #general?', confirmLabel: 'Archive room' })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(await answer).toBe(false)
  })

  test('a destructive dialog opens with cancel focused, so a stray Enter does not delete', async () => {
    const answer = confirmAction({ title: 'Delete profile?', confirmLabel: 'Delete profile' })
    expect(document.activeElement).toBe(buttonNamed('Cancel'))
    expect(panel().className).toContain('od-confirm__panel--danger')
    buttonNamed('Cancel').click()
    await answer
  })

  test('a neutral dialog opens on its confirm button and is not marked danger', async () => {
    const answer = confirmAction({
      title: 'Refresh all libraries?',
      confirmLabel: 'Refresh all',
      tone: 'neutral',
    })
    expect(document.activeElement).toBe(buttonNamed('Refresh all'))
    expect(panel().className).toContain('od-confirm__panel--neutral')
    buttonNamed('Refresh all').click()
    expect(await answer).toBe(true)
  })

  test('a second ask while one is open answers no rather than stacking', async () => {
    const first = confirmAction({ title: 'First?', confirmLabel: 'Do it' })
    expect(await confirmAction({ title: 'Second?', confirmLabel: 'Do it too' })).toBe(false)
    expect(document.querySelectorAll('.od-confirm').length).toBe(1)
    buttonNamed('Cancel').click()
    await first
  })

  test('returns focus to whatever opened it', async () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()

    const answer = confirmAction({ title: 'Delete events?', confirmLabel: 'Delete events' })
    buttonNamed('Cancel').click()
    await answer

    expect(document.activeElement).toBe(opener)
  })
})
