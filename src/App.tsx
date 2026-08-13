import { useEffect, useMemo, useRef, useState } from 'react'
import { AuthGate } from './components/AuthGate'
import { BatchList } from './components/BatchList'
import { LabelForm } from './components/LabelForm'
import { LabelPreview } from './components/LabelPreview'
import type { LabelDraft, LabelDimensions, LabelItem } from './types'
import {
  clearSession,
  fetchLabels,
  fetchSettings,
  isUnlocked,
  saveBatch,
} from './utils/api'
import { downloadAllAsZip } from './utils/download'
import { printLabelsInWindow } from './utils/print'
import { validateBarcodeInput } from './utils/validation'

const DEFAULT_SIZE: LabelDimensions = { widthIn: 2.2, heightIn: 1 }

const LP2824_PRESETS: { label: string; size: LabelDimensions }[] = [
  { label: '2.2″ × 1″', size: { widthIn: 2.2, heightIn: 1 } },
  { label: '2″ × 1″', size: { widthIn: 2, heightIn: 1 } },
  { label: '2.2″ × 1.25″', size: { widthIn: 2.2, heightIn: 1.25 } },
  { label: '1.5″ × 1″', size: { widthIn: 1.5, heightIn: 1 } },
]

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function clampSize(next: LabelDimensions): LabelDimensions {
  return {
    widthIn: Math.min(2.2, Math.max(0.5, next.widthIn)),
    heightIn: Math.min(6, Math.max(0.38, next.heightIn)),
  }
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() => isUnlocked())
  const [draft, setDraft] = useState<LabelDraft>({
    productName: '',
    price: '',
    sku: '',
    format: 'CODE128',
  })
  const [nextSku, setNextSku] = useState(1001)
  const [items, setItems] = useState<LabelItem[]>([])
  const [size, setSize] = useState<LabelDimensions>(DEFAULT_SIZE)
  const [showSize, setShowSize] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const saveTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!unlocked) return
    let cancelled = false
    ;(async () => {
      try {
        setLoadError(null)
        const [settings, labels] = await Promise.all([fetchSettings(), fetchLabels()])
        if (cancelled) return
        setItems(labels)
        setNextSku(settings.nextSku)
        setSize(clampSize({ widthIn: settings.widthIn, heightIn: settings.heightIn }))
        setLoaded(true)
      } catch (err) {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'Failed to load data')
        setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [unlocked])

  useEffect(() => {
    if (!unlocked || !loaded) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(async () => {
      try {
        await saveBatch({
          items,
          nextSku,
          widthIn: size.widthIn,
          heightIn: size.heightIn,
        })
        setSaveStatus('saved')
        window.setTimeout(() => setSaveStatus('idle'), 1500)
      } catch {
        setSaveStatus('error')
      }
    }, 600)
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [items, nextSku, size, unlocked, loaded])

  const previewCode = draft.sku.trim() || String(nextSku)

  const liveError = useMemo(() => {
    if (!draft.sku.trim()) {
      if (draft.format === 'EAN13' || draft.format === 'UPC') {
        return `Auto SKU (${nextSku}) is not valid for ${draft.format === 'EAN13' ? 'EAN-13' : 'UPC-A'}. Enter the required digits.`
      }
      return null
    }
    return validateBarcodeInput(draft.format, draft.sku)
  }, [draft.format, draft.sku, nextSku])

  function updateDraft(patch: Partial<LabelDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }))
    setSubmitError(null)
  }

  function emptyDraft(format: LabelDraft['format'] = 'CODE128'): LabelDraft {
    return { productName: '', price: '', sku: '', format }
  }

  function handleCancelEdit() {
    setEditingId(null)
    setDraft(emptyDraft(draft.format))
    setSubmitError(null)
  }

  function handleEdit(item: LabelItem) {
    setEditingId(item.id)
    setDraft({
      productName: item.productName,
      price: item.price || '',
      sku: item.code,
      format: item.format,
    })
    setSize(clampSize({ widthIn: item.widthIn, heightIn: item.heightIn }))
    setSubmitError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleAdd() {
    const name = draft.productName.trim()
    if (!name) {
      setSubmitError('Product name is required.')
      return
    }

    const editingItem = editingId
      ? items.find((item) => item.id === editingId)
      : null
    const usingAuto = !draft.sku.trim()
    const code = usingAuto
      ? editingItem
        ? editingItem.code
        : String(nextSku)
      : draft.sku.trim()
    const error = validateBarcodeInput(draft.format, code)

    if (usingAuto && !editingItem && (draft.format === 'EAN13' || draft.format === 'UPC')) {
      setSubmitError(
        `Enter a valid ${draft.format === 'EAN13' ? '12-digit EAN-13' : '11-digit UPC-A'} code (auto SKU only works with Code128).`,
      )
      return
    }

    if (error) {
      setSubmitError(error)
      return
    }

    if (editingId) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === editingId
            ? {
                ...item,
                productName: name,
                price: draft.price.trim(),
                code,
                format: draft.format,
                widthIn: size.widthIn,
                heightIn: size.heightIn,
              }
            : item,
        ),
      )
      setEditingId(null)
      setDraft(emptyDraft(draft.format))
      setSubmitError(null)
      return
    }

    const item: LabelItem = {
      id: createId(),
      productName: name,
      price: draft.price.trim(),
      code,
      format: draft.format,
      widthIn: size.widthIn,
      heightIn: size.heightIn,
    }

    setItems((prev) => [...prev, item])
    if (usingAuto) setNextSku((n) => n + 1)
    setDraft((prev) => ({ ...prev, productName: '', price: '', sku: '' }))
    setSubmitError(null)
  }

  function handleRemove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
    if (editingId === id) handleCancelEdit()
  }

  async function handleSave() {
    try {
      await saveBatch({
        items,
        nextSku,
        widthIn: size.widthIn,
        heightIn: size.heightIn,
      })
      setSaveStatus('saved')
      window.setTimeout(() => setSaveStatus('idle'), 1500)
    } catch {
      setSaveStatus('error')
    }
  }

  async function handleDownloadAll(list: LabelItem[]) {
    setDownloading(true)
    try {
      await downloadAllAsZip(list)
    } finally {
      setDownloading(false)
    }
  }

  async function handlePrint(list: LabelItem[]) {
    try {
      await printLabelsInWindow(list, size.widthIn, size.heightIn)
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Could not open print window.',
      )
    }
  }

  function handleLock() {
    clearSession()
    setUnlocked(false)
    setLoaded(false)
    setItems([])
  }

  if (!unlocked) {
    return <AuthGate onUnlocked={() => setUnlocked(true)} />
  }

  return (
    <div className="min-h-screen text-stone-900">
      <div className="app-shell mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4 no-print">
          <div>
            <p className="font-display text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
              LabelPress
            </p>
            <p className="mt-1 max-w-xl text-stone-600">
              Generate barcode labels, save to your barcode server, then print or
              download — runs separately from POS.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLock}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            Lock
          </button>
        </header>

        {loadError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 no-print">
            {loadError}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-2 no-print">
          <div className="flex flex-col gap-6 rounded-xl border border-stone-200 bg-white/80 p-5 shadow-sm backdrop-blur sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide text-stone-700 uppercase">
                {editingId ? 'Edit label' : 'New label'}
              </h2>
              <button
                type="button"
                onClick={() => setShowSize((v) => !v)}
                className="text-xs font-medium text-teal-800 hover:underline"
              >
                {showSize ? 'Hide size' : 'Label size'}
              </button>
            </div>

            {showSize && (
              <div className="flex flex-col gap-3 rounded-md border border-stone-200 bg-stone-50 p-3">
                <p className="text-xs text-stone-500">
                  Zebra LP2824 — max width 2.2″ @ 203 DPI. Match this size in
                  Windows printer preferences. When printing: Margins = None,
                  no headers/footers.
                </p>
                <div className="flex flex-wrap gap-2">
                  {LP2824_PRESETS.map((preset) => {
                    const active =
                      size.widthIn === preset.size.widthIn &&
                      size.heightIn === preset.size.heightIn
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setSize(preset.size)}
                        className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                          active
                            ? 'border-teal-700 bg-teal-700 text-white'
                            : 'border-stone-300 bg-white text-stone-700 hover:border-teal-600'
                        }`}
                      >
                        {preset.label}
                      </button>
                    )
                  })}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="widthIn" className="text-xs font-medium text-stone-600">
                      Width (in)
                    </label>
                    <input
                      id="widthIn"
                      type="number"
                      min={0.5}
                      max={2.2}
                      step={0.05}
                      value={size.widthIn}
                      onChange={(e) =>
                        setSize((s) =>
                          clampSize({
                            ...s,
                            widthIn: Number(e.target.value) || s.widthIn,
                          }),
                        )
                      }
                      className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-teal-600"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="heightIn" className="text-xs font-medium text-stone-600">
                      Height (in)
                    </label>
                    <input
                      id="heightIn"
                      type="number"
                      min={0.38}
                      max={6}
                      step={0.05}
                      value={size.heightIn}
                      onChange={(e) =>
                        setSize((s) =>
                          clampSize({
                            ...s,
                            heightIn: Number(e.target.value) || s.heightIn,
                          }),
                        )
                      }
                      className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-teal-600"
                    />
                  </div>
                </div>
              </div>
            )}

            <LabelForm
              draft={draft}
              error={submitError ?? liveError}
              nextSku={nextSku}
              editing={Boolean(editingId)}
              onChange={updateDraft}
              onAdd={handleAdd}
              onCancel={handleCancelEdit}
            />

            <LabelPreview
              productName={draft.productName}
              price={draft.price}
              code={previewCode}
              format={draft.format}
              widthIn={size.widthIn}
              heightIn={size.heightIn}
            />
          </div>

          <div className="rounded-xl border border-stone-200 bg-white/80 p-5 shadow-sm backdrop-blur sm:p-6">
            <BatchList
              items={items}
              search={search}
              editingId={editingId}
              onSearchChange={setSearch}
              onEdit={handleEdit}
              onRemove={handleRemove}
              onDownloadAll={handleDownloadAll}
              onPrint={handlePrint}
              onSave={handleSave}
              downloading={downloading}
              saveStatus={saveStatus}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
