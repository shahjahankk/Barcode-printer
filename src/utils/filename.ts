export function sanitizeFilename(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'label'
}

export function buildLabelFilename(
  productName: string,
  code: string,
  extension = 'png',
): string {
  const namePart = sanitizeFilename(productName)
  const codePart = sanitizeFilename(code) || 'code'
  return `SKU-${codePart}-${namePart}.${extension}`
}
