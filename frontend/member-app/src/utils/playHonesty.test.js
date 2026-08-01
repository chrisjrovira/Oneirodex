import {
  FIRMWARE_ADMIN_HREF,
  FIRMWARE_HELP_HREF,
  firmwareBlockHint,
  firmwareBlockMessage,
  honestyApiErrorMessage,
  isFirmwarePlayBlocked,
} from './playHonesty'

test('isFirmwarePlayBlocked only when firmware_missing', () => {
  expect(isFirmwarePlayBlocked({ firmware_missing: true, bios_required: true })).toBe(true)
  expect(isFirmwarePlayBlocked({ firmware_missing: false, bios_required: true })).toBe(false)
  expect(isFirmwarePlayBlocked({ bios_required: true })).toBe(false)
  expect(isFirmwarePlayBlocked(null)).toBe(false)
})

test('firmwareBlockMessage prefers bios.message then hint', () => {
  expect(
    firmwareBlockMessage({
      firmware_missing: true,
      bios: { message: 'yabause needs BIOS', hint: 'Upload via Admin' },
    }),
  ).toBe('yabause needs BIOS')
  expect(
    firmwareBlockMessage({
      firmware_missing: true,
      bios: { hint: 'Upload via Admin → emulator BIOS' },
    }),
  ).toBe('Upload via Admin → emulator BIOS')
  expect(firmwareBlockMessage({ firmware_missing: true })).toMatch(/does not download BIOS/i)
})

test('firmwareBlockHint omits duplicate of message', () => {
  expect(
    firmwareBlockHint({
      bios: { message: 'Same', hint: 'Same' },
    }),
  ).toBeNull()
  expect(
    firmwareBlockHint({
      bios: { message: 'Short', hint: 'Longer operator path' },
    }),
  ).toBe('Longer operator path')
})

test('honestyApiErrorMessage prefers Backend hint', () => {
  expect(
    honestyApiErrorMessage({
      message: 'Version file is missing on disk',
      code: 'path_missing',
      hint: 'Use Remove missing versions',
      data: { error: 'Version file is missing on disk', code: 'path_missing' },
    }),
  ).toBe('Use Remove missing versions')
  expect(
    honestyApiErrorMessage({
      code: 'missing_extractor',
      data: { code: 'missing_extractor', error: 'Failed to extract rar' },
    }),
  ).toBe('Failed to extract rar')
  expect(honestyApiErrorMessage({ code: 'missing_extractor' })).toMatch(/prefer \.zip/i)
  expect(FIRMWARE_HELP_HREF).toBe('/help#browser-play')
  expect(FIRMWARE_ADMIN_HREF).toBe('/admin/emulator_profiles')
})
