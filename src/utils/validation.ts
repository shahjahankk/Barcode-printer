import type { BarcodeFormat } from '../types'

export function validateBarcodeInput(
  format: BarcodeFormat,
  value: string,
): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (format === 'EAN13') {
    if (!/^\d{12}$/.test(trimmed)) {
      return 'EAN-13 requires exactly 12 digits (check digit is calculated).'
    }
  }

  if (format === 'UPC') {
    if (!/^\d{11}$/.test(trimmed)) {
      return 'UPC-A requires exactly 11 digits (check digit is calculated).'
    }
  }

  return null
}

export function canGenerateBarcode(
  format: BarcodeFormat,
  code: string,
): boolean {
  const trimmed = code.trim()
  if (!trimmed) return false
  return validateBarcodeInput(format, trimmed) === null
}
