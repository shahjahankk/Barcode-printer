export type BarcodeFormat = 'CODE128' | 'EAN13' | 'UPC'

export interface LabelDimensions {
  widthIn: number
  heightIn: number
}

export interface LabelDraft {
  productName: string
  price: string
  sku: string
  format: BarcodeFormat
}

export interface LabelItem {
  id: string
  productName: string
  price: string
  code: string
  format: BarcodeFormat
  widthIn: number
  heightIn: number
}
