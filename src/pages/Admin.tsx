import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Lock,
  Unlock,
  Plus,
  Trash2,
  RotateCcw,
  ArrowLeft,
  Package,
  Droplets,
  ClipboardList,
  Pencil,
  Save,
  Search,
  X,
  KeyRound,
} from 'lucide-react'
import type { Category } from '../data/products'
import {
  DEMO_PIN,
  changeAdminPin,
  fetchAdminSession,
  loginAdmin,
  readAdminUnlocked,
  writeAdminUnlocked,
} from '../lib/adminAuth'
import { useCart } from '../store/cart'
import {
  useCatalog,
  type ArtPick,
  type NewProductInput,
} from '../store/catalog'
import { useScents } from '../store/scents'
import LogoMark from '../components/LogoMark'
import OrdersPanel from '../components/admin/OrdersPanel'
import ProductPhotoField from '../components/admin/ProductPhotoField'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const CATEGORIES: Category[] = ['Pens', 'Stickers', 'Car Freshies', 'Canvas', 'Custom']

const ART_OPTIONS: { value: ArtPick; label: string }[] = [
  { value: 'pen', label: 'Pen' },
  { value: 'sticker', label: 'Sticker' },
  { value: 'freshie', label: 'Freshie' },
  { value: 'pack', label: 'Pack' },
]

type AdminTab = 'products' | 'scents' | 'orders'

interface ProductEditForm {
  id: string
  name: string
  price: number
  category: Category
  imageUrl: string
  inventoryQuantity: number | null
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014)
  )
}

const TABS: { id: AdminTab; label: string; icon: typeof Package }[] = [
  { id: 'products', label: 'Products', icon: Package },
  { id: 'scents', label: 'Scents', icon: Droplets },
  { id: 'orders', label: 'Orders', icon: ClipboardList },
]

function parseTab(raw: string | null): AdminTab {
  if (raw === 'scents' || raw === 'orders' || raw === 'products') return raw
  return 'products'
}

const emptyForm = (): NewProductInput => ({
  name: '',
  price: 6,
  category: 'Pens',
  tagline: '',
  description: '',
  imageUrl: '',
  art: 'pen',
})

export default function Admin() {
  useDocumentTitle('Admin')
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = parseTab(searchParams.get('tab'))

  const products = useCatalog((s) => s.products)
  const addProduct = useCatalog((s) => s.addProduct)
  const updateProduct = useCatalog((s) => s.updateProduct)
  const removeProduct = useCatalog((s) => s.removeProduct)
  const resetToDefaults = useCatalog((s) => s.resetToDefaults)

  const scents = useScents((s) => s.scents)
  const scentsSyncState = useScents((s) => s.syncState)
  const scentsSyncError = useScents((s) => s.syncError)
  const hydrateScents = useScents((s) => s.hydrateFromApi)
  const addScent = useScents((s) => s.addScent)
  const removeScent = useScents((s) => s.removeScent)
  const clearScents = useScents((s) => s.clearScents)
  const renameScent = useScents((s) => s.renameScent)
  const resetScents = useScents((s) => s.resetToDefaults)

  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewProductInput>(emptyForm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const [justEdited, setJustEdited] = useState<string | null>(null)
  const [photoSaveError, setPhotoSaveError] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ProductEditForm | null>(null)
  const [editSaveError, setEditSaveError] = useState<string | null>(null)
  const [newScent, setNewScent] = useState('')
  const [scentError, setScentError] = useState<string | null>(null)
  const [confirmDeleteScent, setConfirmDeleteScent] = useState<string | null>(null)
  const [confirmResetScents, setConfirmResetScents] = useState(false)
  const [confirmClearScents, setConfirmClearScents] = useState(false)
  const [editingScent, setEditingScent] = useState<string | null>(null)
  const [editScentValue, setEditScentValue] = useState('')
  const [justScent, setJustScent] = useState<string | null>(null)
  const [productQuery, setProductQuery] = useState('')
  const [showChangePin, setShowChangePin] = useState(false)
  const [currentPinInput, setCurrentPinInput] = useState('')
  const [newPinInput, setNewPinInput] = useState('')
  const [confirmPinInput, setConfirmPinInput] = useState('')
  const [pinChangeError, setPinChangeError] = useState<string | null>(null)
  const [usingDefaultPin, setUsingDefaultPin] = useState(true)
  const showToast = useCart((s) => s.showToast)

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => {
      const hay = `${p.name} ${p.category} ${p.tagline ?? ''} ${p.description ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [products, productQuery])


  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!readAdminUnlocked()) {
        if (!cancelled) {
          setUnlocked(false)
          setUsingDefaultPin(true)
        }
        return
      }
      const session = await fetchAdminSession()
      if (cancelled) return
      if (session.ok) {
        setUnlocked(true)
        setUsingDefaultPin(session.isDefaultPin)
      } else {
        setUnlocked(false)
        setUsingDefaultPin(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const setTab = (next: AdminTab) => {
    setSearchParams({ tab: next }, { replace: true })
  }

  const unlock = () => {
    void (async () => {
      try {
        const result = await loginAdmin(pin)
        setUnlocked(true)
        setUsingDefaultPin(result.isDefaultPin)
        setPinError(false)
        setPin('')
      } catch {
        setPinError(true)
      }
    })()
  }

  const resetPinForm = () => {
    setCurrentPinInput('')
    setNewPinInput('')
    setConfirmPinInput('')
    setPinChangeError(null)
  }

  const onChangePin = (e: FormEvent) => {
    e.preventDefault()
    setPinChangeError(null)
    const current = currentPinInput.trim()
    const next = newPinInput.trim()
    const confirm = confirmPinInput.trim()
    if (next.length < 4) {
      setPinChangeError('New code must be at least 4 characters.')
      return
    }
    if (next !== confirm) {
      setPinChangeError('New code and confirmation do not match.')
      return
    }
    void (async () => {
      try {
        const result = await changeAdminPin(current, next)
        setUsingDefaultPin(result.isDefaultPin)
        resetPinForm()
        setShowChangePin(false)
        showToast('Access code updated')
      } catch (err) {
        const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : ''
        if (code === 'invalid_pin' || code === 'unauthorized') {
          setPinChangeError('Current code is incorrect.')
        } else if (code === 'pin_too_short') {
          setPinChangeError('New code must be at least 4 characters.')
        } else {
          setPinChangeError('Could not save the new code. Try again.')
        }
      }
    })()
  }

  const lock = () => {
    writeAdminUnlocked(false)
    setUnlocked(false)
    setShowForm(false)
    setConfirmDeleteId(null)
    setConfirmReset(false)
    setEditForm(null)
    setPhotoSaveError(null)
    setEditSaveError(null)
    setConfirmDeleteScent(null)
    setConfirmResetScents(false)
    setConfirmClearScents(false)
    setEditingScent(null)
    setScentError(null)
    setShowChangePin(false)
    resetPinForm()
  }

  const onAddScent = () => {
    const trimmed = newScent.trim()
    if (!trimmed) {
      setScentError('Type a scent name first.')
      return
    }
    void (async () => {
      try {
        const ok = await addScent(trimmed)
        if (!ok) {
          setScentError('That scent is already on the list (or the name is empty).')
          return
        }
        setJustScent(trimmed)
        setNewScent('')
        setScentError(null)
        window.setTimeout(() => setJustScent(null), 2500)
      } catch (err) {
        setScentError(err instanceof Error ? err.message : 'Could not add scent.')
      }
    })()
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const name = form.name.trim()
    if (!name || !(form.price > 0)) return
    setPhotoSaveError(null)
    try {
      const created = await addProduct({
        ...form,
        name,
        price: Number(form.price),
      })
      setJustAdded(created.name)
      setForm(emptyForm())
      setShowForm(false)
      window.setTimeout(() => setJustAdded(null), 2500)
    } catch (error) {
      setPhotoSaveError(
        isQuotaError(error)
          ? 'Photo too large; try a smaller one.'
          : error instanceof Error && error.message
            ? error.message
            : 'This product could not be saved. Please try again.',
      )
    }
  }

  const startEditingProduct = (product: (typeof products)[number]) => {
    setEditForm({
      id: product.id,
      name: product.name,
      price: product.price,
      category: product.category,
      imageUrl: product.imageUrl ?? '',
      inventoryQuantity: product.inventoryQuantity ?? null,
    })
    setEditSaveError(null)
    setConfirmDeleteId(null)
  }

  const saveEditedProduct = async (e: FormEvent) => {
    e.preventDefault()
    if (!editForm) return
    const name = editForm.name.trim()
    if (!name || !(editForm.price > 0)) {
      setEditSaveError('Add a name and a price greater than zero.')
      return
    }
    setEditSaveError(null)
    try {
      await updateProduct(editForm.id, {
        name,
        price: Number(editForm.price),
        category: editForm.category,
        imageUrl: editForm.imageUrl.trim() || undefined,
        inventoryQuantity: editForm.inventoryQuantity,
      })
      setJustEdited(name)
      setEditForm(null)
      window.setTimeout(() => setJustEdited(null), 2500)
    } catch (error) {
      setEditSaveError(
        isQuotaError(error)
          ? 'Photo too large; try a smaller one.'
          : error instanceof Error && error.message
            ? error.message
            : 'Changes could not be saved. Please try again.',
      )
    }
  }

  if (!unlocked) {
    return (
      <div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col justify-center px-4 py-10 sm:px-6">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-mute hover:text-cyan"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to shop
        </Link>
        <div className="rounded-3xl border border-line bg-ink-2 p-6 sm:p-8">
          <LogoMark size="md" className="mb-4" />
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-3 text-cyan">
            <Lock className="h-8 w-8" />
          </div>
          <h1 className="font-display text-3xl text-cream sm:text-4xl">Store Manager</h1>
          <p className="mt-2 text-base text-mute">
            Manage products, scents, and orders. Enter the code to get in.
          </p>
          <p className="mt-3 rounded-2xl border border-line bg-ink px-4 py-3 text-sm text-cream">
            Ask Chad for the code. Default demo code is{' '}
            <span className="font-extrabold text-lime">{DEMO_PIN}</span> until you change it.
          </p>
          <label className="mt-6 block">
            <span className="mb-2 block text-sm font-extrabold uppercase tracking-wide text-mute">
              Code
            </span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value)
                setPinError(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') unlock()
              }}
              placeholder="Type the code here"
              className="min-h-14 w-full rounded-2xl border border-line bg-ink px-4 text-xl font-bold text-cream outline-none placeholder:text-mute focus:border-cyan"
            />
          </label>
          {pinError && (
            <p className="mt-2 text-sm font-bold text-pink">Nope — try again.</p>
          )}
          <button
            type="button"
            onClick={unlock}
            className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-lime px-6 text-lg font-extrabold text-ink transition hover:bg-lime-hot active:scale-[0.99]"
          >
            <Unlock className="h-5 w-5" />
            Unlock
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-mute hover:text-cyan"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to shop
        </Link>
        <button
          type="button"
          onClick={lock}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-ink-2 px-4 text-sm font-bold text-mute hover:text-cream"
        >
          <Lock className="h-4 w-4" />
          Lock
        </button>
      </div>

      <h1 className="font-display text-3xl text-cream sm:text-4xl">Store Manager</h1>
      <p className="mt-2 max-w-xl text-base text-mute">
        Products, freshie scents, and orders — all in one place. Catalog, scents, and orders sync from the server.
      </p>

      {usingDefaultPin && (
        <p className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm font-extrabold text-amber-200">
          Still using the demo code — change it before going live.
        </p>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={() => {
            setShowChangePin((v) => !v)
            setPinChangeError(null)
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-ink-2 px-4 text-sm font-bold text-mute hover:text-cream"
        >
          <KeyRound className="h-4 w-4 text-cyan" />
          {showChangePin ? 'Hide access code' : 'Change access code'}
        </button>

        {showChangePin && (
          <form
            onSubmit={onChangePin}
            className="mt-4 space-y-4 rounded-3xl border border-line bg-ink-2 p-5 sm:p-6"
          >
            <h2 className="font-display text-2xl text-cream">Change access code</h2>
            <p className="text-sm text-mute">
              Enter your current code, then choose a new one (at least 4 characters).
            </p>
            <label className="block">
              <span className="mb-2 block text-sm font-extrabold uppercase tracking-wide text-mute">
                Current code
              </span>
              <input
                type="password"
                autoComplete="off"
                value={currentPinInput}
                onChange={(e) => {
                  setCurrentPinInput(e.target.value)
                  setPinChangeError(null)
                }}
                className="min-h-14 w-full rounded-2xl border border-line bg-ink px-4 text-lg font-bold text-cream outline-none focus:border-cyan"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-extrabold uppercase tracking-wide text-mute">
                New code
              </span>
              <input
                type="password"
                autoComplete="off"
                value={newPinInput}
                onChange={(e) => {
                  setNewPinInput(e.target.value)
                  setPinChangeError(null)
                }}
                className="min-h-14 w-full rounded-2xl border border-line bg-ink px-4 text-lg font-bold text-cream outline-none focus:border-cyan"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-extrabold uppercase tracking-wide text-mute">
                Confirm new code
              </span>
              <input
                type="password"
                autoComplete="off"
                value={confirmPinInput}
                onChange={(e) => {
                  setConfirmPinInput(e.target.value)
                  setPinChangeError(null)
                }}
                className="min-h-14 w-full rounded-2xl border border-line bg-ink px-4 text-lg font-bold text-cream outline-none focus:border-cyan"
              />
            </label>
            {pinChangeError && (
              <p role="alert" className="text-sm font-bold text-pink">
                {pinChangeError}
              </p>
            )}
            <button
              type="submit"
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-lime px-6 text-lg font-extrabold text-ink transition hover:bg-lime-hot active:scale-[0.99]"
            >
              <Save className="h-5 w-5" />
              Save new code
            </button>
          </form>
        )}
      </div>

      <nav
        aria-label="Store manager sections"
        className="mt-6 grid grid-cols-3 gap-2 rounded-2xl border border-line bg-ink-2 p-1.5"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const on = tab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={on ? 'page' : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-sm font-extrabold transition active:scale-[0.98] sm:flex-row sm:gap-2 sm:text-base ${
                on
                  ? 'bg-cyan text-ink shadow-[0_0_20px_rgba(34,211,238,0.45)]'
                  : 'text-mute hover:bg-ink hover:text-cream'
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          )
        })}
      </nav>

      {tab === 'products' && (
        <div className="mt-8">
          {justAdded && (
            <p className="mb-4 rounded-2xl border border-lime/40 bg-lime/10 px-4 py-3 text-sm font-bold text-lime">
              “{justAdded}” is in the shop now. Nice!
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setShowForm((v) => !v)
                setPhotoSaveError(null)
                setConfirmReset(false)
                setEditForm(null)
                setEditSaveError(null)
              }}
              className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-lime px-5 text-lg font-extrabold text-ink transition hover:bg-lime-hot active:scale-[0.99]"
            >
              <Plus className="h-5 w-5" />
              {showForm ? 'Hide form' : 'Add a product'}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmReset(true)
                setShowForm(false)
              }}
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-ink-2 px-5 text-base font-extrabold text-cream transition hover:border-cyan/50"
            >
              <RotateCcw className="h-5 w-5 text-cyan" />
              Restore original products
            </button>
          </div>

          {confirmReset && (
            <div className="mt-4 rounded-2xl border border-pink/40 bg-ink-2 p-4">
              <p className="text-base font-bold text-cream">
                Are you sure? This puts the original product list back and removes anything you added.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    void resetToDefaults()
                      .then(() => {
                        setConfirmReset(false)
                        setEditForm(null)
                        setEditSaveError(null)
                      })
                      .catch((error) => {
                        setConfirmReset(false)
                        setEditSaveError(
                          error instanceof Error && error.message
                            ? error.message
                            : 'Could not restore catalog on server.',
                        )
                      })
                  }}
                  className="min-h-12 flex-1 rounded-xl bg-pink px-4 text-base font-extrabold text-white"
                >
                  Yes, restore
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="min-h-12 flex-1 rounded-xl border border-line bg-ink px-4 text-base font-extrabold text-cream"
                >
                  No, keep my list
                </button>
              </div>
            </div>
          )}

          {showForm && (
            <form
              onSubmit={onSubmit}
              className="mt-6 space-y-5 rounded-3xl border border-line bg-ink-2 p-5 sm:p-6"
            >
              <h2 className="font-display text-2xl text-cream">New product</h2>

              <label className="block">
                <span className="mb-2 block text-sm font-extrabold uppercase tracking-wide text-mute">
                  Name
                </span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="What is it called?"
                  className="min-h-14 w-full rounded-2xl border border-line bg-ink px-4 text-lg font-bold text-cream outline-none placeholder:text-mute focus:border-cyan"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-extrabold uppercase tracking-wide text-mute">
                  Quantity available <span className="font-normal">(leave blank for made to order)</span>
                </span>
                <input type="number" min={0} step={1} value={form.inventoryQuantity ?? ''} onChange={(e) => setForm((f) => ({ ...f, inventoryQuantity: e.target.value === '' ? undefined : Math.max(0, Math.floor(Number(e.target.value))) }))} placeholder="Made to order" className="min-h-14 w-full rounded-2xl border border-line bg-ink px-4 text-lg font-bold text-cream outline-none placeholder:text-mute focus:border-cyan" />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-extrabold uppercase tracking-wide text-mute">
                  Price (dollars)
                </span>
                <input
                  required
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={form.price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, price: Number(e.target.value) }))
                  }
                  className="min-h-14 w-full rounded-2xl border border-line bg-ink px-4 text-lg font-bold text-cream outline-none focus:border-cyan"
                />
              </label>

              <fieldset>
                <legend className="mb-2 text-sm font-extrabold uppercase tracking-wide text-mute">
                  Category
                </legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {CATEGORIES.map((c) => {
                    const on = form.category === c
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          const artMap: Record<Category, ArtPick> = {
                            Pens: 'pen',
                            Stickers: 'sticker',
                            'Car Freshies': 'freshie',
                            Canvas: 'pack',
                            Custom: 'sticker',
                          }
                          setForm((f) => ({
                            ...f,
                            category: c,
                            art: artMap[c],
                          }))
                        }}
                        className={`min-h-14 rounded-2xl px-3 text-sm font-extrabold transition active:scale-[0.98] ${
                          on
                            ? 'bg-cream text-ink'
                            : 'border border-line bg-ink text-mute hover:text-cream'
                        }`}
                      >
                        {c}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <label className="block">
                <span className="mb-2 block text-sm font-extrabold uppercase tracking-wide text-mute">
                  Short tagline <span className="font-normal">(optional)</span>
                </span>
                <input
                  value={form.tagline ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
                  placeholder="One funny line"
                  className="min-h-14 w-full rounded-2xl border border-line bg-ink px-4 text-lg text-cream outline-none placeholder:text-mute focus:border-cyan"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-extrabold uppercase tracking-wide text-mute">
                  Description <span className="font-normal">(optional)</span>
                </span>
                <textarea
                  value={form.description ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="A little more about it"
                  rows={3}
                  className="w-full rounded-2xl border border-line bg-ink px-4 py-3 text-base text-cream outline-none placeholder:text-mute focus:border-cyan"
                />
              </label>

              <fieldset>
                <legend className="mb-2 text-sm font-extrabold uppercase tracking-wide text-mute">
                  Picture style
                </legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {ART_OPTIONS.map((opt) => {
                    const on = form.art === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, art: opt.value }))}
                        className={`min-h-14 rounded-2xl px-3 text-base font-extrabold transition active:scale-[0.98] ${
                          on
                            ? 'bg-cyan text-ink'
                            : 'border border-line bg-ink text-mute hover:text-cream'
                        }`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <ProductPhotoField
                value={form.imageUrl ?? ''}
                onChange={(imageUrl) => {
                  setForm((f) => ({ ...f, imageUrl }))
                  setPhotoSaveError(null)
                }}
                saveError={photoSaveError}
              />

              <button
                type="submit"
                className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-lime px-6 text-xl font-extrabold text-ink transition hover:bg-lime-hot active:scale-[0.99]"
              >
                <Plus className="h-6 w-6" />
                Add to store
              </button>
            </form>
          )}

          {justEdited && (
            <p className="mt-4 rounded-2xl border border-lime/40 bg-lime/10 px-4 py-3 text-sm font-bold text-lime">
              “{justEdited}” was updated. Looking good!
            </p>
          )}

          {editSaveError && !editForm && (
            <p role="alert" className="mt-4 rounded-2xl border border-pink/40 bg-pink/10 px-4 py-3 text-sm font-bold text-pink">
              {editSaveError}
            </p>
          )}

          {editForm && (
            <form
              onSubmit={saveEditedProduct}
              className="mt-6 space-y-5 rounded-3xl border border-cyan/40 bg-ink-2 p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="font-display text-2xl text-cream">Edit product</h2>
                <button
                  type="button"
                  onClick={() => {
                    setEditForm(null)
                    setEditSaveError(null)
                  }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-ink px-4 text-sm font-bold text-mute hover:text-cream"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              </div>

              {editSaveError && (
                <p role="alert" className="rounded-2xl border border-pink/40 bg-pink/10 px-4 py-3 text-sm font-bold text-pink">
                  {editSaveError}
                </p>
              )}

              <label className="block">
                <span className="mb-2 block text-sm font-extrabold uppercase tracking-wide text-mute">
                  Name
                </span>
                <input
                  required
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => (f ? { ...f, name: e.target.value } : f))
                  }
                  className="min-h-14 w-full rounded-2xl border border-line bg-ink px-4 text-lg font-bold text-cream outline-none placeholder:text-mute focus:border-cyan"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-extrabold uppercase tracking-wide text-mute">
                  Price (dollars)
                </span>
                <input
                  required
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={editForm.price}
                  onChange={(e) =>
                    setEditForm((f) =>
                      f ? { ...f, price: Number(e.target.value) } : f,
                    )
                  }
                  className="min-h-14 w-full rounded-2xl border border-line bg-ink px-4 text-lg font-bold text-cream outline-none focus:border-cyan"
                />
              </label>

              <fieldset>
                <legend className="mb-2 text-sm font-extrabold uppercase tracking-wide text-mute">
                  Category
                </legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CATEGORIES.map((c) => {
                    const on = editForm.category === c
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() =>
                          setEditForm((f) => (f ? { ...f, category: c } : f))
                        }
                        className={`min-h-14 rounded-2xl px-3 text-sm font-extrabold transition active:scale-[0.98] ${
                          on
                            ? 'bg-cream text-ink'
                            : 'border border-line bg-ink text-mute hover:text-cream'
                        }`}
                      >
                        {c}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <label className="block">
                <span className="mb-2 block text-sm font-extrabold uppercase tracking-wide text-mute">
                  Quantity available <span className="font-normal">(blank = made to order)</span>
                </span>
                <input type="number" min={0} step={1} value={editForm.inventoryQuantity ?? ''} onChange={(e) => setEditForm((f) => f ? { ...f, inventoryQuantity: e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value))) } : f)} placeholder="Made to order" className="min-h-14 w-full rounded-2xl border border-line bg-ink px-4 text-lg font-bold text-cream outline-none placeholder:text-mute focus:border-cyan" />
              </label>

              <ProductPhotoField
                value={editForm.imageUrl ?? ''}
                onChange={(imageUrl) => {
                  setEditForm((f) => (f ? { ...f, imageUrl } : f))
                  setEditSaveError(null)
                }}
                saveError={null}
              />

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="submit"
                  className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-lime px-6 text-lg font-extrabold text-ink transition hover:bg-lime-hot active:scale-[0.99]"
                >
                  <Save className="h-5 w-5" />
                  Save changes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditForm(null)
                    setEditSaveError(null)
                  }}
                  className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-line bg-ink px-6 text-lg font-extrabold text-cream"
                >
                  <X className="h-5 w-5" />
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="mt-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="font-display text-2xl text-cream">
                Products in the shop ({filteredProducts.length}
                {productQuery.trim() ? ` of ${products.length}` : ''})
              </h2>
              <label className="relative block w-full sm:max-w-xs">
                <span className="sr-only">Search products</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
                <input
                  type="search"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder="Search name, category…"
                  className="min-h-12 w-full rounded-xl border border-line bg-ink py-2.5 pl-10 pr-4 text-sm text-cream outline-none placeholder:text-mute focus:border-cyan"
                />
              </label>
            </div>
            {productQuery.trim() && filteredProducts.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-line bg-ink px-4 py-8 text-center text-sm text-mute">
                No products match “{productQuery.trim()}”.
              </p>
            ) : null}
            <ul className="mt-4 space-y-3">
              {filteredProducts.map((p) => (
                <li
                  key={p.id}
                  className={`rounded-2xl border p-4 sm:p-5 ${
                    editForm?.id === p.id
                      ? 'border-cyan/50 bg-ink-2'
                      : 'border-line bg-ink-2'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-xl border border-line bg-white object-cover"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold uppercase tracking-wider text-mute">
                          {p.category}
                        </p>
                        <p className="font-display text-xl leading-snug text-cream">{p.name}</p>
                        <p className="mt-1 text-lg font-extrabold text-lime">
                          ${p.price.toFixed(2)}
                        </p>
                        <p className={`mt-1 text-xs font-extrabold ${p.inventoryQuantity === 0 ? 'text-pink' : 'text-cyan'}`}>
                          {p.inventoryQuantity == null ? 'Made to order' : p.inventoryQuantity === 0 ? 'Sold out' : `${p.inventoryQuantity} available`}
                        </p>
                      </div>
                    </div>
                    {confirmDeleteId === p.id ? (
                      <div className="w-full rounded-xl border border-pink/40 bg-ink p-3 sm:w-auto sm:min-w-[14rem]">
                        <p className="mb-2 text-sm font-bold text-cream">Are you sure?</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              void removeProduct(p.id)
                                .then(() => {
                                  setConfirmDeleteId(null)
                                  if (editForm?.id === p.id) {
                                    setEditForm(null)
                                    setEditSaveError(null)
                                  }
                                })
                                .catch((error) => {
                                  setConfirmDeleteId(null)
                                  setEditSaveError(
                                    error instanceof Error && error.message
                                      ? error.message
                                      : 'Could not delete product on server.',
                                  )
                                })
                            }}
                            className="min-h-12 flex-1 rounded-xl bg-pink px-3 text-sm font-extrabold text-white"
                          >
                            Yes, delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-12 flex-1 rounded-xl border border-line bg-ink-2 px-3 text-sm font-extrabold text-cream"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            startEditingProduct(p)
                            setShowForm(false)
                            setPhotoSaveError(null)
                          }}
                          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-ink px-4 text-base font-extrabold text-cream transition hover:border-cyan/50 active:scale-[0.98]"
                        >
                          <Pencil className="h-4 w-4 text-cyan" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(p.id)}
                          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-pink/90 px-4 text-base font-extrabold text-white transition hover:bg-pink active:scale-[0.98]"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === 'scents' && (
        <div className="mt-8 rounded-3xl border border-cyan/30 bg-ink-2 p-5 sm:p-6">
          <h2 className="font-display text-2xl text-cream">Freshie scents</h2>
          <p className="mt-2 text-base text-mute">
            These show up as big scent buttons when someone buys a Car Freshie. The list is stored on the server so phone and laptop stay in sync.
          </p>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-xs font-extrabold uppercase tracking-wide">
            <span
              className={`rounded-full px-2.5 py-0.5 ${
                scentsSyncState === 'synced'
                  ? 'bg-lime/15 text-lime'
                  : scentsSyncState === 'error'
                    ? 'bg-pink/15 text-pink'
                    : scentsSyncState === 'loading'
                      ? 'bg-cyan/15 text-cyan'
                      : 'bg-ink text-mute'
              }`}
            >
              {scentsSyncState === 'synced' && 'Synced'}
              {scentsSyncState === 'loading' && 'Syncing…'}
              {scentsSyncState === 'error' && 'Offline / API error'}
              {scentsSyncState === 'idle' && 'Local cache'}
            </span>
            <button
              type="button"
              onClick={() => void hydrateScents()}
              className="rounded-xl border border-line bg-ink px-2.5 py-1 text-mute hover:text-cream"
            >
              Refresh
            </button>
          </p>
          {scentsSyncError && (
            <p className="mt-2 text-sm text-pink">{scentsSyncError}</p>
          )}
          <p className="mt-3 rounded-2xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm font-extrabold text-amber-200">
            Starter seed on first boot — replace with what’s in stock.
          </p>

          {justScent && (
            <p className="mt-4 rounded-2xl border border-lime/40 bg-lime/10 px-4 py-3 text-sm font-bold text-lime">
              “{justScent}” is available for freshies now.
            </p>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              value={newScent}
              onChange={(e) => {
                setNewScent(e.target.value)
                setScentError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onAddScent()
                }
              }}
              placeholder="New scent name"
              className="min-h-14 flex-1 rounded-2xl border border-line bg-ink px-4 text-lg font-bold text-cream outline-none placeholder:text-mute focus:border-cyan"
            />
            <button
              type="button"
              onClick={onAddScent}
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-lime px-5 text-lg font-extrabold text-ink transition hover:bg-lime-hot active:scale-[0.99]"
            >
              <Plus className="h-5 w-5" />
              Add scent
            </button>
          </div>
          {scentError && (
            <p className="mt-2 text-sm font-bold text-pink">{scentError}</p>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setConfirmResetScents(true)
                setConfirmClearScents(false)
              }}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-ink px-4 text-sm font-extrabold text-cream hover:border-cyan/50"
            >
              <RotateCcw className="h-4 w-4 text-cyan" />
              Restore starter scents
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmClearScents(true)
                setConfirmResetScents(false)
              }}
              disabled={scents.length === 0}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-pink/50 bg-ink px-4 text-sm font-extrabold text-pink hover:bg-pink/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
              Clear all scents
            </button>
          </div>

          {confirmResetScents && (
            <div className="mt-4 rounded-2xl border border-pink/40 bg-ink p-4">
              <p className="text-base font-bold text-cream">
                Put the starter scent list back? These are placeholders — replace them with what’s in stock. This replaces anything you added or renamed.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      try {
                        await resetScents()
                        setConfirmResetScents(false)
                        setEditingScent(null)
                        setConfirmDeleteScent(null)
                        setScentError(null)
                      } catch (err) {
                        setScentError(err instanceof Error ? err.message : 'Reset failed')
                      }
                    })()
                  }}
                  className="min-h-12 flex-1 rounded-xl bg-pink px-4 text-base font-extrabold text-white"
                >
                  Yes, restore starter scents
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetScents(false)}
                  className="min-h-12 flex-1 rounded-xl border border-line bg-ink-2 px-4 text-base font-extrabold text-cream"
                >
                  No, keep my list
                </button>
              </div>
            </div>
          )}

          {confirmClearScents && (
            <div className="mt-4 rounded-2xl border border-pink/40 bg-ink p-4">
              <p className="text-base font-bold text-cream">
                Clear every scent? Customers won’t have any scent choices until you add what’s in stock.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      try {
                        await clearScents()
                        setConfirmClearScents(false)
                        setEditingScent(null)
                        setConfirmDeleteScent(null)
                        setScentError(null)
                      } catch (err) {
                        setScentError(err instanceof Error ? err.message : 'Clear failed')
                      }
                    })()
                  }}
                  className="min-h-12 flex-1 rounded-xl bg-pink px-4 text-base font-extrabold text-white"
                >
                  Yes, clear all scents
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearScents(false)}
                  className="min-h-12 flex-1 rounded-xl border border-line bg-ink-2 px-4 text-base font-extrabold text-cream"
                >
                  No, keep my list
                </button>
              </div>
            </div>
          )}

          <ul className="mt-5 space-y-3">
            {scents.length === 0 && (
              <li className="rounded-2xl border border-line bg-ink px-4 py-5 text-sm text-mute">
                No scents yet — add one above so customers can pick.
              </li>
            )}
            {scents.map((s) => (
              <li
                key={s}
                className="rounded-2xl border border-line bg-ink p-4 sm:p-5"
              >
                {editingScent === s ? (
                  <div className="flex flex-col gap-3">
                    <input
                      value={editScentValue}
                      onChange={(e) => setEditScentValue(e.target.value)}
                      className="min-h-14 w-full rounded-2xl border border-line bg-ink-2 px-4 text-lg font-bold text-cream outline-none focus:border-cyan"
                      autoFocus
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => {
                          void (async () => {
                            try {
                              const ok = await renameScent(s, editScentValue)
                              if (!ok) {
                                setScentError('Could not rename — empty or already exists.')
                                return
                              }
                              setEditingScent(null)
                              setScentError(null)
                            } catch (err) {
                              setScentError(
                                err instanceof Error ? err.message : 'Rename failed',
                              )
                            }
                          })()
                        }}
                        className="min-h-12 flex-1 rounded-xl bg-lime px-4 text-base font-extrabold text-ink"
                      >
                        Save name
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingScent(null)}
                        className="min-h-12 flex-1 rounded-xl border border-line bg-ink-2 px-4 text-base font-extrabold text-cream"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : confirmDeleteScent === s ? (
                  <div>
                    <p className="mb-2 text-base font-bold text-cream">
                      Delete “{s}”? Customers won’t see it anymore.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void (async () => {
                            try {
                              await removeScent(s)
                              setConfirmDeleteScent(null)
                              setScentError(null)
                            } catch (err) {
                              setScentError(
                                err instanceof Error ? err.message : 'Delete failed',
                              )
                            }
                          })()
                        }}
                        className="min-h-12 flex-1 rounded-xl bg-pink px-3 text-sm font-extrabold text-white"
                      >
                        Yes, delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteScent(null)}
                        className="min-h-12 flex-1 rounded-xl border border-line bg-ink-2 px-3 text-sm font-extrabold text-cream"
                      >
                        No
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-display text-xl leading-snug text-cream">{s}</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingScent(s)
                          setEditScentValue(s)
                          setConfirmDeleteScent(null)
                        }}
                        className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line bg-ink-2 px-4 text-base font-extrabold text-cream hover:border-cyan/50"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDeleteScent(s)
                          setEditingScent(null)
                        }}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-pink/90 px-4 text-base font-extrabold text-white transition hover:bg-pink active:scale-[0.98]"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'orders' && (
        <div className="mt-8">
          <OrdersPanel />
        </div>
      )}
    </div>
  )
}
