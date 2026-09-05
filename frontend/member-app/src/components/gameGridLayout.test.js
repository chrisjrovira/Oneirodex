import { estimateGridRowHeight } from './gameGridLayout'

test('row height includes the title strip so estimate matches the rendered row', () => {
  const bare = estimateGridRowHeight(1000, 5, 10)
  const titled = estimateGridRowHeight(1000, 5, 10, 30)
  expect(titled - bare).toBe(30)
})

test('row height ignores a negative or missing strip', () => {
  const bare = estimateGridRowHeight(1000, 5, 10)
  expect(estimateGridRowHeight(1000, 5, 10, -20)).toBe(bare)
  expect(estimateGridRowHeight(1000, 5, 10, 0)).toBe(bare)
})
