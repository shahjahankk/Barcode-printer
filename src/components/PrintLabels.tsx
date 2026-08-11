import { useEffect, useState, type CSSProperties } from 'react'
import type { LabelItem } from '../types'
import { renderLabelToCanvas } from '../utils/renderLabel'

interface PrintLabelsProps {
  items: LabelItem[]
  widthIn: number
  heightIn: number
}

function PrintLabel({
  item,
  widthIn,
  heightIn,
}: {
  item: LabelItem
  widthIn: number
  heightIn: number
}) {
  const [src, setSrc] = useState<string | null>(null)
  // Prefer current print size so changing Label size updates print layout
  const w = widthIn
  const h = heightIn

  useEffect(() => {
    let cancelled = false

    try {
      const canvas = renderLabelToCanvas({
        productName: item.productName,
        price: item.price,
        code: item.code,
        format: item.format,
        widthIn: w,
        heightIn: h,
      })
      const dataUrl = canvas.toDataURL('image/png')
      if (!cancelled) setSrc(dataUrl)
    } catch {
      if (!cancelled) setSrc(null)
    }

    return () => {
      cancelled = true
    }
  }, [item.productName, item.price, item.code, item.format, w, h])

  return (
    <div
      className="print-label"
      style={
        {
          width: `${w}in`,
          height: `${h}in`,
          ['--label-w' as string]: `${w}in`,
          ['--label-h' as string]: `${h}in`,
        } as CSSProperties
      }
    >
      {src ? (
        <img
          src={src}
          alt={item.productName}
          className="print-label-image"
        />
      ) : null}
    </div>
  )
}

export function PrintLabels({ items, widthIn, heightIn }: PrintLabelsProps) {
  useEffect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-print-page-size', 'true')
    style.textContent = `@media print { @page { size: ${widthIn}in ${heightIn}in; margin: 0; } }`
    document.head.appendChild(style)
    return () => {
      style.remove()
    }
  }, [widthIn, heightIn])

  return (
    <div
      id="print-root"
      className="print-only"
      style={
        {
          ['--label-w' as string]: `${widthIn}in`,
          ['--label-h' as string]: `${heightIn}in`,
        } as CSSProperties
      }
    >
      {items.map((item) => (
        <PrintLabel
          key={item.id}
          item={item}
          widthIn={widthIn}
          heightIn={heightIn}
        />
      ))}
    </div>
  )
}
