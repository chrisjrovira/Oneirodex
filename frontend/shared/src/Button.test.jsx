import { createRef } from 'react'

import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import { Button } from './Button.jsx'

test('renders a <button> carrying od-btn plus the variant class', () => {
  render(<Button variant="primary">Save</Button>)
  const el = screen.getByRole('button', { name: 'Save' })
  expect(el.tagName).toBe('BUTTON')
  expect(el).toHaveClass('od-btn', 'od-btn--primary')
})

test('default variant is the bare .od-btn with no modifier', () => {
  render(<Button>Go</Button>)
  const el = screen.getByRole('button', { name: 'Go' })
  expect(el).toHaveClass('od-btn')
  expect(el.className).toBe('od-btn')
})

test('size="sm" adds od-btn--sm; md adds nothing', () => {
  const { rerender } = render(<Button size="sm">A</Button>)
  expect(screen.getByRole('button')).toHaveClass('od-btn', 'od-btn--sm')
  rerender(
    <Button size="md" variant="danger">
      A
    </Button>,
  )
  const el = screen.getByRole('button')
  expect(el).toHaveClass('od-btn', 'od-btn--danger')
  expect(el).not.toHaveClass('od-btn--sm')
})

test('type defaults to "button" so a form is not submitted', () => {
  render(<Button>Safe</Button>)
  expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
})

test('type="submit" is honored', () => {
  render(<Button type="submit">Send</Button>)
  expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
})

test('onClick fires', () => {
  const onClick = vi.fn()
  render(<Button onClick={onClick}>Click</Button>)
  fireEvent.click(screen.getByRole('button'))
  expect(onClick).toHaveBeenCalledTimes(1)
})

test('disabled blocks the click', () => {
  const onClick = vi.fn()
  render(
    <Button disabled onClick={onClick}>
      Nope
    </Button>,
  )
  fireEvent.click(screen.getByRole('button'))
  expect(onClick).not.toHaveBeenCalled()
  expect(screen.getByRole('button')).toBeDisabled()
})

test('className is appended after the computed classes', () => {
  render(
    <Button variant="primary" className="my-hook">
      X
    </Button>,
  )
  const el = screen.getByRole('button')
  expect(el).toHaveClass('od-btn', 'od-btn--primary', 'my-hook')
  expect(el.className).toBe('od-btn od-btn--primary my-hook')
})

test('passes through aria-* attributes', () => {
  render(
    <Button aria-label="Close panel" aria-pressed="true">
      ×
    </Button>,
  )
  const el = screen.getByRole('button', { name: 'Close panel' })
  expect(el).toHaveAttribute('aria-pressed', 'true')
})

test('forwards ref to the underlying button node', () => {
  const ref = createRef()
  render(<Button>Ref</Button>)
  render(<Button ref={ref}>Ref</Button>)
  expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  expect(ref.current).toHaveClass('od-btn')
})
