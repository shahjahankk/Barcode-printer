import JSZip from 'jszip'
import type { LabelItem } from '../types'
import { buildLabelFilename } from './filename'
import {
  canvasToBlob,
  downloadBlob,
  renderLabelToCanvas,
} from './renderLabel'

export async function downloadLabelPng(item: LabelItem): Promise<void> {
  const canvas = renderLabelToCanvas(item)
  const blob = await canvasToBlob(canvas)
  downloadBlob(blob, buildLabelFilename(item.productName, item.code))
}

export async function downloadAllAsZip(items: LabelItem[]): Promise<void> {
  if (items.length === 0) return

  const zip = new JSZip()
  const usedNames = new Map<string, number>()

  for (const item of items) {
    const canvas = renderLabelToCanvas(item)
    const blob = await canvasToBlob(canvas)
    let filename = buildLabelFilename(item.productName, item.code)

    const count = usedNames.get(filename) ?? 0
    if (count > 0) {
      filename = filename.replace(/\.png$/, `-${count + 1}.png`)
    }
    usedNames.set(buildLabelFilename(item.productName, item.code), count + 1)

    zip.file(filename, blob)
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(zipBlob, 'barcode-labels.zip')
}
