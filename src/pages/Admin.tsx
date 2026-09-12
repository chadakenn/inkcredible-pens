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
  LayoutDashboard,
  FileText,
  FolderOpen,
  Store,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import type { Category, ProductOptionGroup } from '../data/products'
import {
  addAdminUser,
  changeAdminPassword,
  fetchAdminSession,
  fetchAdminSetupStatus,
  fetchAdminUsers,
  loginAdmin,
  readAdminUnlocked,
  setupAdminAccount,
  writeAdminUnlocked,
  type AdminUser,
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
import ManagerDashboard from '../components/admin/ManagerDashboard'
import QuotesPanel from '../components/admin/QuotesPanel'
import FilesPanel from '../components/admin/FilesPanel'
import ProductPhotoField from '../components/admin/ProductPhotoField'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const CATEGORIES: Category[] = ['Pens', 'Stickers', 'Car Freshies', 'Canvas', 'Custom']

const ART_OPTIONS: { value: ArtPick; label: string }[] = [
  { value: 'pen', label: 'Pen' },
  { value: 'sticker', label: 'Sticker' },
  { value: 'freshie', label: 'Freshie' },
  { value: 'pack', label: 'Pack' },
]

const CANVAS_SIZES = ['12×16 in', '16×20 in', '20×32 in'] as const
type CanvasSize = (typeof CANVAS_SIZES)[number]
type CanvasPrices = Record<CanvasSize, number>

const RECOMMENDED_CANVAS_PRICES: CanvasPrices = {
  '12×16 in': 35,
  '16×20 in': 50,
  '20×32 in': 85,
}

const DEFAULT_CANVAS_OPTIONS: ProductOptionGroup[] = [{
  name: 'Size',
  required: true,
  values: [
    { label: '12×16 in', priceAdjustment: 0 },
    { label: '16×20 in', priceAdjustment: 15 },
    { label: '20×32 in', priceAdjustment: 50 },
  ],
}]

function readCanvasPrices(price: number, optionGroups?: ProductOptionGroup[]): CanvasPrices {
  const sizeGroup = optionGroups?.find((group) => group.name.toLowerCase() === 'size')
  return Object.fromEntries(
    CANVAS_SIZES.map((size) => {
      const option = sizeGroup?.values.find((value) => value.label === size)
      return [size, option ? price + option.priceAdjustment : RECOMMENDED_CANVAS_PRICES[size]]
    }),
  ) as CanvasPrices
}

function writeCanvasPrices(prices: CanvasPrices): { price: number; optionGroups: ProductOptionGroup[] } {
  const price = prices['12×16 in']
  return {
    price,
    optionGroups: [{
      name: 'Size',
      required: true,
      values: CANVAS_SIZES.map((size) => ({
        label: size,
        priceAdjustment: Number((prices[size] - price).toFixed(2)),
      })),
    }],
  }
}

function CanvasPriceEditor({
  price,
  optionGroups,
  onChange,
}: {
  price: number
  optionGroups?: ProductOptionGroup[]
  onChange: (fields: { price: number; optionGroups: ProductOptionGroup[] }) => void
}) {
  const prices = readCanvasPrices(price, optionGroups)

  return (
    <fieldset className="rounded-2xl border border-cyan/40 bg-ink p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <legend className="font-display text-xl text-cream">Canvas sizes &amp; prices</legend>
          <p className="mt-1 text-sm text-mute">Enter the price customers pay for each size.</p>
        </div>
        <button
          type="button"
          onClick={() => onChange(writeCanvasPrices(RECOMMENDED_CANVAS_PRICES))}
          className="min-h-11 rounded-xl border border-line bg-ink-2 px-3 text-sm font-extrabold text-cyan hover:border-cyan/50"
        >
          Use recommended prices
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {CANVAS_SIZES.map((size) => (
          <label key={size} className="block">
            <span className="mb-2 block text-sm font-extrabold text-cream">{size}</span>
            <span className="flex min-h-14 items-center rounded-2xl border border-line bg-ink-2 px-4 focus-within:border-cyan">
              <span className="mr-2 text-lg font-extrabold text-lime">$</span>
              <input
                required
                type="number"
                min={0.01}
                step={0.01}
                aria-label={`${size} price in dollars`}
                value={prices[size]}
                onChange={(event) => onChange(writeCanvasPrices({
                  ...prices,
                  [size]: Number(event.target.value),
                }))}
                className="min-w-0 flex-1 bg-transparent text-lg font-bold text-cream outline-none"
              />
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

type AdminTab = 'dashboard' | 'products' | 'scents' | 'orders' | 'quotes' | 'files'

interface ProductEditForm {
  id: string
  name: string
  price: number
  category: Category
  imageUrl: string
  inventoryQuantity: number | null
  optionGroups?: ProductOptionGroup[]
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
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'quotes', label: 'Quotes', icon: FileText },
  { id: 'files', label: 'Files', icon: FolderOpen },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'scents', label: 'Scents', icon: Droplets },
  { id: 'orders', label: 'Orders', icon: ClipboardList },
]

function parseTab(raw: string | null): AdminTab {
  if (raw === 'dashboard' || raw === 'quotes' || raw === 'files' || raw === 'scents' || raw === 'orders' || raw === 'products') return raw
  return 'dashboard'
}

type ProductTypeFilter = 'All' | Category

function parseProductType(raw: string | null): ProductTypeFilter {
  if (raw && (CATEGORIES as readonly string[]).includes(raw)) return raw as Category
  return 'All'
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
  const productType = parseProductType(searchParams.get('type'))

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
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [setupPin, setSetupPin] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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
  const [showAccounts, setShowAccounts] = useState(false)
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [newAccountUsername, setNewAccountUsername] = useState('')
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountPassword, setNewAccountPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [nextPasswordConfirm, setNextPasswordConfirm] = useState('')
  const [accountError, setAccountError] = useState<string | null>(null)
  const showToast = useCart((s) => s.showToast)

  const searchMatchedProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => {
      const hay = `${p.name} ${p.category} ${p.tagline ?? ''} ${p.description ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [products, productQuery])

  const typeCounts = useMemo(() => {
    const counts: Record<ProductTypeFilter, number> = {
      All: searchMatchedProducts.length,
      Pens: 0,
      Stickers: 0,
      'Car Freshies': 0,
      Canvas: 0,
      Custom: 0,
    }
    for (const p of searchMatchedProducts) {
      counts[p.category] += 1
    }
    return counts
  }, [searchMatchedProducts])

  const filteredProducts = useMemo(() => {
    const list =
      productType === 'All'
        ? searchMatchedProducts
        : searchMatchedProducts.filter((p) => p.category === productType)
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [searchMatchedProducts, productType])

  const productSections = useMemo(() => {
    if (productType !== 'All') {
      return [{ category: productType, items: filteredProducts }]
    }
    return CATEGORIES.map((category) => ({
      category,
      items: filteredProducts.filter((p) => p.category === category),
    })).filter((section) => section.items.length > 0)
  }, [filteredProducts, productType])


  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const setup = await fetchAdminSetupStatus().catch(() => false)
      if (!cancelled) setNeedsSetup(setup)
      if (!readAdminUnlocked()) {
        if (!cancelled) setUnlocked(false)
        return
      }
      const session = await fetchAdminSession()
      if (cancelled) return
      if (session.ok) {
        setUnlocked(true)
        setAdminUser(session.user)
      } else {
        setUnlocked(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const setTab = (next: AdminTab) => {
    setShowAccounts(false)
    const nextParams = new URLSearchParams()
    nextParams.set('tab', next)
    if (next === 'products' && productType !== 'All') {
      nextParams.set('type', productType)
    }
    setSearchParams(nextParams, { replace: true })
  }

  const openOrder = (id: string) => {
    const nextParams = new URLSearchParams()
    nextParams.set('tab', 'orders')
    nextParams.set('order', id)
    setSearchParams(nextParams, { replace: true })
  }

  const setProductType = (next: ProductTypeFilter) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', 'products')
    if (next === 'All') {
      nextParams.delete('type')
    } else {
      nextParams.set('type', next)
    }
    setSearchParams(nextParams, { replace: true })
  }

  const unlock = (event?: FormEvent) => {
    event?.preventDefault()
    void (async () => {
      try {
        const user = await loginAdmin(username.trim(), password)
        setUnlocked(true)
        setAdminUser(user)
        setAuthError(null)
        setPassword('')
      } catch {
        setAuthError('Username or password is incorrect.')
      }
    })()
  }

  const finishSetup = (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 10 || password !== confirmPassword) {
      setAuthError(password !== confirmPassword ? 'Passwords do not match.' : 'Use at least 10 characters for the password.')
      return
    }
    void (async () => {
      try {
        const user = await setupAdminAccount({ pin: setupPin, username, displayName, password })
        setAdminUser(user)
        setUnlocked(true)
        setNeedsSetup(false)
        setAuthError(null)
      } catch {
        setAuthError('Setup failed. Check the old access code, username, and password.')
      }
    })()
  }

  const refreshAdminUsers = () => void fetchAdminUsers().then(setAdminUsers).catch(() => setAccountError('Could not load accounts.'))

  const createAccount = (e: FormEvent) => {
    e.preventDefault()
    setAccountError(null)
    void addAdminUser({ username: newAccountUsername, displayName: newAccountName, password: newAccountPassword })
      .then(() => {
        setNewAccountUsername('')
        setNewAccountName('')
        setNewAccountPassword('')
        refreshAdminUsers()
        showToast('Account added')
      })
      .catch(() => setAccountError('Could not add account. Use a unique username and a password of at least 10 characters.'))
  }

  const updatePassword = (e: FormEvent) => {
    e.preventDefault()
    if (nextPassword !== nextPasswordConfirm) {
      setAccountError('New passwords do not match.')
      return
    }
    void changeAdminPassword(currentPassword, nextPassword)
      .then((user) => {
        setAdminUser(user)
        setCurrentPassword('')
        setNextPassword('')
        setNextPasswordConfirm('')
        setAccountError(null)
        showToast('Password changed')
      })
      .catch(() => setAccountError('Could not change password. Check the current password and use at least 10 characters.'))
  }

  const lock = () => {
    writeAdminUnlocked(false)
    setUnlocked(false)
    setAdminUser(null)
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
    setShowAccounts(false)
    setAccountError(null)
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
      setProductType(created.category)
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
      optionGroups: product.optionGroups,
    })
    setProductType(product.category)
    setEditSaveError(null)
    setConfirmDeleteId(null)
  }

  const saveEditedProduct = async (e: FormEvent) => {
    e.preventDefault()
    if (!editForm) return
    const name = editForm.name.trim()
    const canvasPrices = readCanvasPrices(editForm.price, editForm.optionGroups)
    const canvasPricesValid = CANVAS_SIZES.every((size) => canvasPrices[size] > 0)
    if (!name || !(editForm.price > 0) || (editForm.category === 'Canvas' && !canvasPricesValid)) {
      setEditSaveError('Add a name and make sure every price is greater than zero.')
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
        optionGroups: editForm.optionGroups,
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
    const settingUp = needsSetup === true
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
            {settingUp ? 'Create the first private owner account.' : 'Sign in to manage products, orders, and customers.'}
          </p>
          <form onSubmit={settingUp ? finishSetup : unlock} className="mt-6 space-y-4">
          {settingUp && <label className="block">
            <span className="mb-2 block text-sm font-extrabold uppercase tracking-wide text-mute">
              Current access code
            </span>
            <input
              type="password"
              autoComplete="off"
              value={setupPin}
              onChange={(e) => { setSetupPin(e.target.value); setAuthError(null) }}
              className="min-h-14 w-full rounded-2xl border border-line bg-ink px-4 text-lg font-bold text-cream outline-none focus:border-cyan"
            />
          </label>}
          {settingUp && <label className="block">
            <span className="mb-2 block text-sm font-extrabold uppercase tracking-wide text-mute">Your name</span>
            <input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Chad" className="min-h-14 w-full rounded-2xl border border-line bg-ink px-4 text-lg font-bold text-cream outline-none placeholder:text-mute focus:border-cyan" />
          </label>}
          <label className="block">
            <span className="mb-2 block text-sm font-extrabold uppercase tracking-wide text-mute">Username</span>
            <input required autoCapitalize="none" autoComplete="username" value={username} onChange={(e) => { setUsername(e.target.value); setAuthError(null) }} placeholder="chad" className="min-h-14 w-full rounded-2xl border border-line bg-ink px-4 text-lg font-bold text-cream outline-none placeholder:text-mute focus:border-cyan" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-extrabold uppercase tracking-wide text-mute">Password</span>
            <input required type="password" autoComplete={settingUp ? 'new-password' : 'current-password'} value={password} onChange={(e) => { setPassword(e.target.value); setAuthError(null) }} className="min-h-14 w-full rounded-2xl border border-line bg-ink px-4 text-lg font-bold text-cream outline-none focus:border-cyan" />
          </label>
          {settingUp && <label className="block">
            <span className="mb-2 block text-sm font-extrabold uppercase tracking-wide text-mute">Confirm password</span>
            <input required type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="min-h-14 w-full rounded-2xl border border-line bg-ink px-4 text-lg font-bold text-cream outline-none focus:border-cyan" />
          </label>}
          {authError && <p role="alert" className="text-sm font-bold text-pink">{authError}</p>}
          <button
            type="submit"
            disabled={needsSetup == null}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-lime px-6 text-lg font-extrabold text-ink transition hover:bg-lime-hot active:scale-[0.99] disabled:opacity-50"
          >
            <Unlock className="h-5 w-5" />
            {needsSetup == null ? 'Checking…' : settingUp ? 'Create owner account' : 'Sign in'}
          </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1480px] px-3 py-4 sm:px-6 sm:py-6">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-ink-2 px-4 py-4 shadow-2xl shadow-black/20 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-lime text-ink"><Store className="h-6 w-6" /></span>
          <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-cyan">Inkcredible</p><h1 className="font-display text-2xl text-cream sm:text-3xl">Store Manager</h1></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden text-right sm:block"><p className="text-sm font-bold text-cream">{adminUser?.displayName || adminUser?.username}</p><p className="text-xs text-mute">Manager account</p></div>
          <Link to="/" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-ink px-3 text-sm font-bold text-mute hover:border-cyan hover:text-cream"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">View shop</span></Link>
          <button type="button" onClick={lock} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-ink px-3 text-sm font-bold text-mute hover:border-pink hover:text-cream"><Lock className="h-4 w-4" /> Lock</button>
        </div>
      </header>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="sticky top-3 z-20 rounded-2xl border border-line bg-ink-2 p-2 shadow-xl shadow-black/20">
          <p className="hidden px-3 pb-2 pt-3 text-xs font-extrabold uppercase tracking-[0.18em] text-mute lg:block">Workspace</p>
          <nav aria-label="Store manager sections" className="grid grid-cols-3 gap-1 sm:grid-cols-6 lg:grid-cols-1">
            {TABS.map(({ id, label, icon: Icon }) => {
              const on = tab === id && !showAccounts
              return <button key={id} type="button" onClick={() => setTab(id)} aria-current={on ? 'page' : undefined} className={`flex min-h-14 items-center justify-center gap-2 rounded-xl px-2 text-sm font-extrabold transition lg:justify-start lg:px-4 ${on ? 'bg-cyan text-ink shadow-[0_0_18px_rgba(34,211,238,0.25)]' : 'text-mute hover:bg-ink hover:text-cream'}`}><Icon className="h-5 w-5 shrink-0" /><span>{label}</span></button>
            })}
          </nav>
          <div className="mt-2 border-t border-line pt-2">
            <button type="button" onClick={() => { setShowAccounts((open) => { if (!open) refreshAdminUsers(); return !open }); setAccountError(null) }} className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-extrabold lg:justify-start ${showAccounts ? 'bg-lavender text-ink' : 'text-mute hover:bg-ink hover:text-cream'}`}><KeyRound className="h-5 w-5" /> Accounts</button>
          </div>
        </aside>

        <main className="min-w-0 rounded-2xl border border-line/80 bg-black/10 p-3 sm:p-5 lg:p-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
            <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-lime">Manager workspace</p><h2 className="mt-1 font-display text-3xl text-cream">{showAccounts ? 'Accounts & security' : TABS.find((item) => item.id === tab)?.label}</h2><p className="mt-1 text-sm text-mute">{showAccounts ? 'Manage who can access the store.' : tab === 'dashboard' ? 'A quick look at what needs your attention.' : `Manage store ${TABS.find((item) => item.id === tab)?.label.toLowerCase()}.`}</p></div>
          </div>

        <div>
        {showAccounts && (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 rounded-xl border border-lime/30 bg-lime/5 p-5 sm:flex-row sm:items-center">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-lime/15 text-lime"><ShieldCheck className="h-7 w-7" /></span>
              <div className="flex-1"><h2 className="font-display text-2xl text-cream">Store Manager is protected</h2><p className="mt-1 text-sm text-mute">Signed in securely as <strong className="text-cream">{adminUser?.displayName || adminUser?.username}</strong>. Each manager should use their own account.</p></div>
              <span className="w-fit rounded-full bg-lime/15 px-3 py-1.5 text-xs font-extrabold uppercase text-lime">Secure session active</span>
            </div>

            <section className="rounded-xl border border-line bg-ink-2 p-5">
              <div className="flex items-center gap-3"><Users className="h-6 w-6 text-cyan" /><div><h3 className="font-display text-xl text-cream">People with access</h3><p className="text-sm text-mute">{adminUsers.length} manager {adminUsers.length === 1 ? 'account' : 'accounts'}</p></div></div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {adminUsers.map((user) => <div key={user.id} className="flex items-center gap-3 rounded-xl border border-line bg-ink p-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan/10 font-display text-lg uppercase text-cyan">{user.displayName.charAt(0) || user.username.charAt(0)}</span><div className="min-w-0"><p className="truncate font-bold text-cream">{user.displayName}</p><p className="truncate text-xs text-mute">@{user.username}{user.id === adminUser?.id ? ' · You' : ''}</p></div></div>)}
              </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-2">
            <form onSubmit={createAccount} className="space-y-3 rounded-xl border border-line bg-ink-2 p-5">
              <div className="flex items-center gap-3"><UserPlus className="h-6 w-6 text-cyan" /><div><h3 className="font-display text-xl text-cream">Add a manager</h3><p className="text-sm text-mute">Create a separate login for Kellie or another helper.</p></div></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input required value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} placeholder="Name" aria-label="New manager name" className="min-h-12 rounded-xl border border-line bg-ink-2 px-3 text-base text-cream outline-none placeholder:text-mute focus:border-cyan" />
                <input required autoCapitalize="none" value={newAccountUsername} onChange={(e) => setNewAccountUsername(e.target.value)} placeholder="Username" aria-label="New manager username" className="min-h-12 rounded-xl border border-line bg-ink-2 px-3 text-base text-cream outline-none placeholder:text-mute focus:border-cyan" />
              </div>
              <input required type="password" minLength={10} autoComplete="new-password" value={newAccountPassword} onChange={(e) => setNewAccountPassword(e.target.value)} placeholder="Temporary password (10+ characters)" aria-label="New manager password" className="min-h-12 w-full rounded-xl border border-line bg-ink-2 px-3 text-base text-cream outline-none placeholder:text-mute focus:border-cyan" />
              <button type="submit" className="min-h-12 w-full rounded-xl bg-cyan px-4 text-base font-extrabold text-ink">Create manager account</button>
            </form>

            <form onSubmit={updatePassword} className="space-y-3 rounded-xl border border-line bg-ink-2 p-5">
              <div className="flex items-center gap-3"><KeyRound className="h-6 w-6 text-lime" /><div><h3 className="font-display text-xl text-cream">Change my password</h3><p className="text-sm text-mute">Use at least 10 characters. Longer is safer.</p></div></div>
              <input required type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" className="min-h-12 w-full rounded-xl border border-line bg-ink-2 px-3 text-base text-cream outline-none placeholder:text-mute focus:border-cyan" />
              <div className="grid gap-3 sm:grid-cols-2">
                <input required type="password" minLength={10} autoComplete="new-password" value={nextPassword} onChange={(e) => setNextPassword(e.target.value)} placeholder="New password" className="min-h-12 rounded-xl border border-line bg-ink-2 px-3 text-base text-cream outline-none placeholder:text-mute focus:border-cyan" />
                <input required type="password" minLength={10} autoComplete="new-password" value={nextPasswordConfirm} onChange={(e) => setNextPasswordConfirm(e.target.value)} placeholder="Confirm new password" className="min-h-12 rounded-xl border border-line bg-ink-2 px-3 text-base text-cream outline-none placeholder:text-mute focus:border-cyan" />
              </div>
              <button type="submit" className="min-h-12 w-full rounded-xl bg-lime px-4 text-base font-extrabold text-ink">Change password</button>
            </form>
            </div>
            {accountError && <p role="alert" className="rounded-xl border border-pink/40 bg-pink/10 px-4 py-3 text-sm font-bold text-pink">{accountError}</p>}
          </div>
        )}
      </div>

      {!showAccounts && tab === 'dashboard' && <ManagerDashboard onOpenOrders={() => setTab('orders')} onOpenOrder={openOrder} onNavigate={setTab} />}
      {!showAccounts && tab === 'quotes' && <QuotesPanel />}
      {!showAccounts && tab === 'files' && <FilesPanel />}

      {!showAccounts && tab === 'products' && (
        <div>
          {justAdded && (
            <p className="mb-4 rounded-2xl border border-lime/40 bg-lime/10 px-4 py-3 text-sm font-bold text-lime">
              “{justAdded}” is in the shop now. Nice!
            </p>
          )}

          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-line bg-ink-2 p-4"><Package className="h-5 w-5 text-cyan" /><p className="mt-2 text-xs font-bold uppercase text-mute">Shop products</p><p className="font-display text-2xl text-cream">{products.length}</p></div>
            <div className="rounded-xl border border-line bg-ink-2 p-4"><Store className="h-5 w-5 text-lime" /><p className="mt-2 text-xs font-bold uppercase text-mute">Categories</p><p className="font-display text-2xl text-cream">{CATEGORIES.filter((category) => products.some((product) => product.category === category)).length}</p></div>
            <div className="rounded-xl border border-line bg-ink-2 p-4"><RotateCcw className="h-5 w-5 text-amber-300" /><p className="mt-2 text-xs font-bold uppercase text-mute">Made to order</p><p className="font-display text-2xl text-cream">{products.filter((product) => product.inventoryQuantity == null).length}</p></div>
            <div className="rounded-xl border border-line bg-ink-2 p-4"><Trash2 className="h-5 w-5 text-pink" /><p className="mt-2 text-xs font-bold uppercase text-mute">Sold out</p><p className="font-display text-2xl text-cream">{products.filter((product) => product.inventoryQuantity === 0).length}</p></div>
          </div>

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
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-lime px-5 text-base font-extrabold text-ink transition hover:bg-lime-hot active:scale-[0.99]"
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
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-pink/30 bg-ink-2 px-5 text-sm font-bold text-mute transition hover:border-pink/60 hover:text-cream"
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

              {form.category !== 'Canvas' && <label className="block">
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
              </label>}

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
                            ...(c === 'Canvas'
                              ? { price: 35, optionGroups: DEFAULT_CANVAS_OPTIONS }
                              : { optionGroups: undefined }),
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

              {form.category === 'Canvas' && (
                <CanvasPriceEditor
                  price={form.price}
                  optionGroups={form.optionGroups}
                  onChange={(fields) => setForm((current) => ({ ...current, ...fields }))}
                />
              )}

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

              {editForm.category !== 'Canvas' && <label className="block">
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
              </label>}

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
                        onClick={() => setEditForm((current) => {
                          if (!current) return current
                          if (c === 'Canvas') {
                            return {
                              ...current,
                              category: c,
                              ...writeCanvasPrices(RECOMMENDED_CANVAS_PRICES),
                            }
                          }
                          return { ...current, category: c, optionGroups: undefined }
                        })}
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

              {editForm.category === 'Canvas' && (
                <CanvasPriceEditor
                  price={editForm.price}
                  optionGroups={editForm.optionGroups}
                  onChange={(fields) => setEditForm((current) => (
                    current ? { ...current, ...fields } : current
                  ))}
                />
              )}

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
                {productQuery.trim() || productType !== 'All' ? ` of ${products.length}` : ''})
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

            <div
              role="group"
              aria-label="Filter by product type"
              className="mt-4 flex flex-wrap gap-2"
            >
              {(['All', ...CATEGORIES] as ProductTypeFilter[]).map((type) => {
                const on = productType === type
                const count = typeCounts[type]
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setProductType(type)}
                    aria-pressed={on}
                    className={`inline-flex min-h-12 items-center gap-2 rounded-2xl px-4 text-sm font-extrabold transition active:scale-[0.98] sm:text-base ${
                      on
                        ? 'bg-cream text-ink'
                        : 'border border-line bg-ink text-mute hover:text-cream'
                    }`}
                  >
                    <span>{type}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${
                        on ? 'bg-ink/15 text-ink' : 'bg-ink-2 text-mute'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {filteredProducts.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-line bg-ink px-4 py-8 text-center text-sm text-mute">
                {productQuery.trim()
                  ? `No products match “${productQuery.trim()}”${productType !== 'All' ? ` in ${productType}` : ''}.`
                  : productType !== 'All'
                    ? `No ${productType} in the shop yet.`
                    : 'No products in the shop yet.'}
              </p>
            ) : null}

            <div className="mt-4 space-y-6">
              {productSections.map(({ category, items }) => (
                <section key={category} aria-label={category}>
                  {productType === 'All' ? (
                    <h3 className="sticky top-16 z-10 -mx-1 mb-3 rounded-xl border border-line/80 bg-ink/95 px-3 py-2.5 backdrop-blur-xl sm:top-[4.5rem]">
                      <span className="font-display text-lg text-cream sm:text-xl">
                        {category}
                      </span>
                      <span className="ml-2 text-sm font-extrabold text-mute">
                        ({items.length})
                      </span>
                    </h3>
                  ) : null}
                  <ul className="grid gap-3 xl:grid-cols-2">
                    {items.map((p) => (
                      <li
                        key={p.id}
                        className={`rounded-xl border p-4 ${
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
                                className="h-20 w-20 shrink-0 rounded-xl border border-line bg-white object-contain"
                              />
                            ) : null}
                            <div className="min-w-0">
                              <p className="text-xs font-extrabold uppercase tracking-wider text-mute">
                                {p.category}
                              </p>
                              <p className="font-display text-xl leading-snug text-cream">{p.name}</p>
                              {p.tagline && <p className="mt-1 line-clamp-1 text-sm text-mute">{p.tagline}</p>}
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
                </section>
              ))}
            </div>
          </div>
        </div>
      )}

      {!showAccounts && tab === 'scents' && (
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

      {!showAccounts && tab === 'orders' && (
        <div>
          <OrdersPanel />
        </div>
      )}
        </main>
      </div>
    </div>
  )
}
