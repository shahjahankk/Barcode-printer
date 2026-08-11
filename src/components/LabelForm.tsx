import type { BarcodeFormat, LabelDraft } from '../types'

interface LabelFormProps {
  draft: LabelDraft
  error: string | null
  nextSku: number
  onChange: (patch: Partial<LabelDraft>) => void
  onAdd: () => void
}

const FORMATS: { value: BarcodeFormat; label: string }[] = [
  { value: 'CODE128', label: 'Code128' },
  { value: 'EAN13', label: 'EAN-13' },
  { value: 'UPC', label: 'UPC-A' },
]

export function LabelForm({
  draft,
  error,
  nextSku,
  onChange,
  onAdd,
}: LabelFormProps) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        onAdd()
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="productName" className="text-sm font-medium text-stone-700">
          Product name
        </label>
        <input
          id="productName"
          type="text"
          value={draft.productName}
          onChange={(e) => onChange({ productName: e.target.value })}
          placeholder="e.g. T-Shirt Blue"
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="price" className="text-sm font-medium text-stone-700">
          Price <span className="font-normal text-stone-400">(optional)</span>
        </label>
        <input
          id="price"
          type="text"
          value={draft.price}
          onChange={(e) => onChange({ price: e.target.value })}
          placeholder="e.g. $19.99"
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="sku" className="text-sm font-medium text-stone-700">
          SKU <span className="font-normal text-stone-400">(optional)</span>
        </label>
        <input
          id="sku"
          type="text"
          value={draft.sku}
          onChange={(e) => onChange({ sku: e.target.value })}
          placeholder={`Leave blank to use ${nextSku}`}
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
          inputMode={draft.format === 'CODE128' ? 'text' : 'numeric'}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!error && draft.format === 'EAN13' && (
          <p className="text-xs text-stone-400">EAN-13: enter 12 digits</p>
        )}
        {!error && draft.format === 'UPC' && (
          <p className="text-xs text-stone-400">UPC-A: enter 11 digits</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="format" className="text-sm font-medium text-stone-700">
          Barcode type
        </label>
        <select
          id="format"
          value={draft.format}
          onChange={(e) => onChange({ format: e.target.value as BarcodeFormat })}
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
        >
          {FORMATS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="mt-1 rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600/40"
      >
        Add to list
      </button>
    </form>
  )
}
