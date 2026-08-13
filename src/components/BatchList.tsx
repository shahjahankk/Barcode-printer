import { useEffect, useMemo, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import type { LabelItem } from '../types'
import { downloadLabelPng } from '../utils/download'

interface BatchListProps {
  items: LabelItem[]
  search: string
  editingId: string | null
  onSearchChange: (value: string) => void
  onEdit: (item: LabelItem) => void
  onRemove: (id: string) => void
  onDownloadAll: (items: LabelItem[]) => void
  onPrint: (items: LabelItem[]) => void | Promise<void>
  onSave: () => void
  downloading: boolean
  saveStatus: 'idle' | 'saved' | 'error'
}

function Thumbnail({ item }: { item: LabelItem }) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return
    try {
      JsBarcode(svgRef.current, item.code, {
        format: item.format,
        width: 1,
        height: 28,
        displayValue: false,
        margin: 0,
        background: '#ffffff',
        lineColor: '#000000',
      })
    } catch {
      // ignore
    }
  }, [item.code, item.format])

  return <svg ref={svgRef} className="h-7 w-20" />
}

export function BatchList({
  items,
  search,
  editingId,
  onSearchChange,
  onEdit,
  onRemove,
  onDownloadAll,
  onPrint,
  onSave,
  downloading,
  saveStatus,
}: BatchListProps) {
  const [busyId, setBusyId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      const haystack = [item.productName, item.price, item.code, item.format]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [items, search])

  async function handleDownloadOne(item: LabelItem) {
    setBusyId(item.id)
    try {
      await downloadLabelPng(item)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-stone-700 uppercase">
          Batch list{' '}
          <span className="font-normal normal-case text-stone-400">
            ({filtered.length}
            {search.trim() ? ` / ${items.length}` : ''})
          </span>
        </h2>
        <div className="flex flex-wrap gap-2 no-print">
          <button
            type="button"
            onClick={onSave}
            disabled={items.length === 0}
            className="rounded-md border border-teal-700 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-900 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saveStatus === 'saved' ? 'Saved' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => onPrint(filtered)}
            disabled={filtered.length === 0}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Print
          </button>
          <button
            type="button"
            onClick={() => onDownloadAll(filtered)}
            disabled={filtered.length === 0 || downloading}
            className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {downloading ? 'Preparing ZIP…' : 'Download ZIP'}
          </button>
        </div>
      </div>

      <div className="no-print">
        <label htmlFor="batch-search" className="sr-only">
          Search labels
        </label>
        <input
          id="batch-search"
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name, SKU, or price…"
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
        />
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-stone-300 bg-stone-50/80 px-4 py-8 text-center text-sm text-stone-500">
          No labels yet. Fill in the form and click Add to list.
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-stone-300 bg-stone-50/80 px-4 py-8 text-center text-sm text-stone-500">
          No labels match “{search.trim()}”.
        </p>
      ) : (
        <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto">
          {filtered.map((item) => (
            <li
              key={item.id}
              className={`flex items-center gap-3 rounded-md border px-3 py-2 ${
                editingId === item.id
                  ? 'border-teal-500 bg-teal-50/70 ring-1 ring-teal-500/30'
                  : 'border-stone-200 bg-white'
              }`}
            >
              <div className="shrink-0 rounded border border-stone-100 bg-white p-1">
                <Thumbnail item={item} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-900">
                  {item.productName}
                </p>
                <p className="truncate font-mono text-xs text-stone-500">
                  {item.code}
                  {item.price ? ` · ${item.price}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1 no-print">
                <button
                  type="button"
                  onClick={() => onEdit(item)}
                  title="Edit label"
                  aria-label={`Edit ${item.productName}`}
                  className="inline-flex items-center gap-1 rounded border border-teal-700 bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-900 hover:bg-teal-100"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-.793.793-2.828-2.828.793-.793ZM11.379 5.793 3 14.172V17h2.828l8.38-8.379-2.83-2.828Z" />
                  </svg>
                  {editingId === item.id ? 'Editing' : 'Edit'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadOne(item)}
                  disabled={busyId === item.id}
                  className="rounded px-2 py-1 text-xs font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-50"
                >
                  {busyId === item.id ? '…' : 'Download PNG'}
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  aria-label={`Remove ${item.productName}`}
                  className="rounded px-2 py-1 text-lg leading-none text-stone-400 hover:bg-red-50 hover:text-red-600"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {saveStatus === 'error' && (
        <p className="text-sm text-red-600">Could not save. Check browser storage.</p>
      )}
    </section>
  )
}
