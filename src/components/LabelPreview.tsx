import { useEffect, useRef } from 'react'
import type { BarcodeFormat } from '../types'
import { canGenerateBarcode } from '../utils/validation'
import { renderLabelToCanvas } from '../utils/renderLabel'

interface LabelPreviewProps {
  productName: string
  price: string
  code: string
  format: BarcodeFormat
  widthIn: number
  heightIn: number
}

export function LabelPreview({
  productName,
  price,
  code,
  format,
  widthIn,
  heightIn,
}: LabelPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const valid = canGenerateBarcode(format, code)

  useEffect(() => {
    const el = canvasRef.current
    if (!el || !valid) return

    try {
      const source = renderLabelToCanvas({
        productName,
        price,
        code: code.trim(),
        format,
        widthIn,
        heightIn,
      })
      el.width = source.width
      el.height = source.height
      const ctx = el.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, el.width, el.height)
      ctx.drawImage(source, 0, 0)
    } catch {
      // Invalid barcode data for the selected format
    }
  }, [productName, price, code, format, widthIn, heightIn, valid])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-stone-700 uppercase">
          Live preview
        </h2>
        <span className="text-xs text-stone-400">
          {widthIn}&quot; × {heightIn}&quot;
        </span>
      </div>

      <div className="mx-auto w-full max-w-full overflow-hidden rounded-sm border border-stone-300 bg-white shadow-sm">
        {valid ? (
          <canvas
            ref={canvasRef}
            className="mx-auto block h-auto max-w-full"
            style={{ width: `${widthIn}in`, maxWidth: '100%' }}
          />
        ) : (
          <div
            className="flex items-center justify-center"
            style={{ width: `${widthIn}in`, height: `${heightIn}in`, maxWidth: '100%' }}
          >
            <p className="px-2 text-center text-xs text-stone-400">
              Enter valid barcode data to preview
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
