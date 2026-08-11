import type { LabelItem } from '../types'
import { renderLabelToCanvas } from './renderLabel'

const DPI = 203

function inchesToDots(inches: number): number {
  return Math.round(inches * DPI)
}

function escapeZpl(text: string): string {
  return text.replace(/\^/g, ' ').replace(/~/g, ' ')
}

/** Build ZPL II for a Zebra LP2824-class printer (203 DPI). */
export function labelToZpl(
  item: LabelItem,
  widthIn: number,
  heightIn: number,
): string {
  const pw = inchesToDots(widthIn)
  const ll = inchesToDots(heightIn)
  const padX = Math.round(pw * 0.04)
  const padY = Math.round(ll * 0.04)
  const name = escapeZpl(item.productName.trim() || 'Untitled')
  const price = escapeZpl(item.price.trim())
  const code = escapeZpl(item.code)

  const nameH = Math.round(ll * 0.16)
  const priceH = price ? Math.round(ll * 0.13) : 0
  const codeH = Math.round(ll * 0.12)
  const gap = Math.round(ll * 0.02)
  let y = padY

  const nameFont = Math.max(18, Math.min(32, Math.round(nameH * 0.9)))
  const lines: string[] = [
    '^XA',
    `^PW${pw}`,
    `^LL${ll}`,
    '^LH0,0',
    '^LS0',
    '^LT0',
    `^FO${padX},${y}^A0N,${nameFont},${nameFont}^FD${name}^FS`,
  ]
  y += nameH + gap

  if (price) {
    const priceFont = Math.max(16, Math.min(28, Math.round(priceH * 0.9)))
    lines.push(
      `^FO${padX},${y}^A0N,${priceFont},${priceFont}^FD${price}^FS`,
    )
    y += priceH + gap
  }

  const barH = Math.max(30, ll - y - codeH - gap - padY)
  const byModule = Math.max(2, Math.min(3, Math.round(pw / 180)))
  if (item.format === 'EAN13') {
    lines.push(
      `^FO${padX},${y}^BY${byModule},2,${barH}^BEN,${barH},Y,N^FD${code}^FS`,
    )
  } else if (item.format === 'UPC') {
    lines.push(
      `^FO${padX},${y}^BY${byModule},2,${barH}^BUN,${barH},Y,N,N^FD${code}^FS`,
    )
  } else {
    lines.push(
      `^FO${padX},${y}^BY${byModule},2,${barH}^BCN,${barH},Y,N,N^FD${code}^FS`,
    )
  }

  lines.push('^XZ')
  return lines.join('\n')
}

export function itemsToZpl(
  items: LabelItem[],
  widthIn: number,
  heightIn: number,
): string {
  return items.map((item) => labelToZpl(item, widthIn, heightIn)).join('\n')
}

/** Open a clean print-only window (avoids app CSS shifting the label down). */
export async function printLabelsInWindow(
  items: LabelItem[],
  widthIn: number,
  heightIn: number,
): Promise<void> {
  if (items.length === 0) return

  const images: string[] = []
  for (const item of items) {
    const canvas = renderLabelToCanvas({
      productName: item.productName,
      price: item.price,
      code: item.code,
      format: item.format,
      widthIn,
      heightIn,
    })
    images.push(canvas.toDataURL('image/png'))
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Print labels</title>
  <style>
    @page { size: ${widthIn}in ${heightIn}in; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${widthIn}in;
      margin: 0;
      padding: 0;
      background: #fff;
    }
    .label {
      width: ${widthIn}in;
      height: ${heightIn}in;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
    }
    .label:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .label img {
      display: block;
      width: ${widthIn}in;
      height: ${heightIn}in;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  </style>
</head>
<body>
  ${images
    .map(
      (src, i) =>
        `<div class="label"><img src="${src}" alt="Label ${i + 1}" /></div>`,
    )
    .join('')}
  <script>
    window.onload = function () {
      setTimeout(function () {
        window.focus();
        window.print();
      }, 200);
    };
  </script>
</body>
</html>`

  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('Pop-up blocked — allow pop-ups to print labels.')
  }
  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}
