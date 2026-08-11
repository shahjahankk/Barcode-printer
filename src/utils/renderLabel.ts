import JsBarcode from 'jsbarcode'
import type { BarcodeFormat } from '../types'

const DPI = 203

export function inchesToPx(inches: number): number {
  return Math.round(inches * DPI)
}

export function renderBarcodeToCanvas(
  canvas: HTMLCanvasElement,
  code: string,
  format: BarcodeFormat,
  options?: {
    width?: number
    height?: number
    displayValue?: boolean
    fontSize?: number
    margin?: number
  },
): void {
  JsBarcode(canvas, code, {
    format,
    width: options?.width ?? 2,
    height: options?.height ?? 60,
    displayValue: options?.displayValue ?? true,
    fontSize: options?.fontSize ?? 14,
    margin: options?.margin ?? 8,
    background: '#ffffff',
    lineColor: '#000000',
  })
}

function buildSizedBarcode(
  code: string,
  format: BarcodeFormat,
  barHeight: number,
  targetWidth: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  let moduleWidth = 1.5

  for (let w = 1.5; w <= 4.5; w += 0.25) {
    renderBarcodeToCanvas(canvas, code, format, {
      width: w,
      height: barHeight,
      displayValue: false,
      margin: 1,
    })
    moduleWidth = w
    if (canvas.width >= targetWidth * 0.9) break
  }

  renderBarcodeToCanvas(canvas, code, format, {
    width: moduleWidth,
    height: barHeight,
    displayValue: false,
    margin: 1,
  })
  return canvas
}

/**
 * Top-aligned label. Barcode encodes SKU/code only (keeps bars compact).
 */
export function renderLabelToCanvas(opts: {
  productName: string
  price: string
  code: string
  format: BarcodeFormat
  widthIn: number
  heightIn: number
}): HTMLCanvasElement {
  const width = inchesToPx(opts.widthIn)
  const height = inchesToPx(opts.heightIn)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get canvas context')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#000000'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const padX = Math.max(6, Math.round(width * 0.04))
  const padTop = Math.max(3, Math.round(height * 0.03))
  const padBottom = Math.max(8, Math.round(height * 0.08))
  const innerW = width - padX * 2
  const contentH = height - padTop - padBottom
  const hasPrice = Boolean(opts.price.trim())
  const barcodeValue = opts.code.trim()

  const nameBand = Math.round(contentH * (hasPrice ? 0.2 : 0.22))
  const priceBand = hasPrice ? Math.round(contentH * 0.16) : 0
  const codeBand = Math.round(contentH * 0.14)
  const gap = Math.max(2, Math.round(contentH * 0.025))
  const barcodeBand = Math.max(
    28,
    contentH - nameBand - priceBand - codeBand - gap * (hasPrice ? 3 : 2),
  )

  let y = padTop

  const name = opts.productName.trim() || 'Untitled'
  let nameSize = Math.max(12, Math.min(22, Math.round(nameBand * 0.78)))
  ctx.font = `600 ${nameSize}px "IBM Plex Sans", system-ui, sans-serif`
  while (nameSize > 9 && ctx.measureText(name).width > innerW) {
    nameSize -= 1
    ctx.font = `600 ${nameSize}px "IBM Plex Sans", system-ui, sans-serif`
  }
  ctx.fillText(name, width / 2, y + nameBand / 2, innerW)
  y += nameBand + gap

  if (hasPrice) {
    const priceSize = Math.max(11, Math.min(18, Math.round(priceBand * 0.75)))
    ctx.font = `700 ${priceSize}px "IBM Plex Sans", system-ui, sans-serif`
    ctx.fillText(opts.price.trim(), width / 2, y + priceBand / 2, innerW)
    y += priceBand + gap
  }

  const barHeight = Math.round(barcodeBand * 0.88)
  const barcodeCanvas = buildSizedBarcode(
    barcodeValue,
    opts.format,
    barHeight,
    innerW,
  )
  const scale = Math.min(
    innerW / barcodeCanvas.width,
    barcodeBand / barcodeCanvas.height,
  )
  const drawW = Math.round(barcodeCanvas.width * scale)
  const drawH = Math.round(barcodeCanvas.height * scale)
  ctx.drawImage(
    barcodeCanvas,
    Math.round((width - drawW) / 2),
    y + Math.round((barcodeBand - drawH) / 2),
    drawW,
    drawH,
  )
  y += barcodeBand + gap

  const codeSize = Math.max(9, Math.min(14, Math.round(codeBand * 0.75)))
  ctx.font = `500 ${codeSize}px "IBM Plex Sans", ui-monospace, monospace`
  ctx.fillText(barcodeValue, width / 2, y + codeBand / 2, innerW)

  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to create PNG blob'))
    }, 'image/png')
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
