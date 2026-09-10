/**
 * Shared product catalog (JSON on disk) — mounted on Express (4242).
 * File: data/catalog/products.json
 * Seed: server/catalog-seed.json (committed) — used when products.json missing or on reset.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { requireAdmin } from "./adminAuth.mjs"
import {
  CorruptJsonError,
  readJsonFile,
  writeJsonAtomic,
} from "./security.mjs"
import { deleteProductUploadIfUnreferenced } from "./uploads.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const CATALOG_DIR = path.resolve(__dirname, "../data/catalog")
export const CATALOG_FILE = path.join(CATALOG_DIR, "products.json")
export const CATALOG_SEED_FILE = path.join(__dirname, "catalog-seed.json")

const CATEGORIES = new Set(["Pens", "Stickers", "Car Freshies", "Canvas", "Custom"])
const ART_TYPES = new Set([
  "pen",
  "sticker",
  "freshie",
  "resin",
  "badge",
  "pack",
  "skin",
])

function normalizeOptionGroups(value, errors) {
  if (value == null) return undefined
  if (!Array.isArray(value) || value.length > 5) {
    errors.push("invalid_optionGroups")
    return undefined
  }
  const groups = []
  const groupNames = new Set()
  for (const rawGroup of value) {
    const name = String(rawGroup?.name || "").trim().slice(0, 60)
    const key = name.toLowerCase()
    if (!name || groupNames.has(key) || !Array.isArray(rawGroup?.values) || rawGroup.values.length < 1 || rawGroup.values.length > 30) {
      errors.push("invalid_optionGroups")
      return undefined
    }
    groupNames.add(key)
    const labels = new Set()
    const values = []
    for (const rawValue of rawGroup.values) {
      const label = String(rawValue?.label || "").trim().slice(0, 80)
      const labelKey = label.toLowerCase()
      const priceAdjustment = Number(rawValue?.priceAdjustment ?? 0)
      if (!label || labels.has(labelKey) || !Number.isFinite(priceAdjustment) || Math.abs(priceAdjustment) > 100000) {
        errors.push("invalid_optionGroups")
        return undefined
      }
      labels.add(labelKey)
      values.push({ label, priceAdjustment: Math.round(priceAdjustment * 100) / 100 })
    }
    groups.push({ name, required: rawGroup?.required !== false, values })
  }
  return groups.length ? groups : undefined
}

mkdirSync(CATALOG_DIR, { recursive: true })

export function newProductId(name) {
  const base = String(name || "product")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
  return `${base || "product"}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function loadSeedProducts() {
  if (!existsSync(CATALOG_SEED_FILE)) {
    console.warn("[catalog] seed file missing:", CATALOG_SEED_FILE)
    return []
  }
  try {
    const raw = readFileSync(CATALOG_SEED_FILE, "utf8")
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch (err) {
    console.error("[catalog] seed read failed", err)
    return []
  }
}

function ensureCatalogFile() {
  if (existsSync(CATALOG_FILE)) return
  const seed = loadSeedProducts()
  if (seed.length === 0) {
    writeAtomic([])
    return
  }
  try {
    copyFileSync(CATALOG_SEED_FILE, CATALOG_FILE)
    console.log(`[catalog] seeded ${seed.length} products → ${CATALOG_FILE}`)
  } catch (err) {
    console.error("[catalog] seed copy failed, writing empty", err)
    writeAtomic(seed)
  }
}

export function readProducts() {
  ensureCatalogFile()
  const data = readJsonFile(CATALOG_FILE)
  if (data == null) return []
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.products)) return data.products
  console.error("[catalog] unexpected JSON shape — refusing empty fallback")
  throw new CorruptJsonError(CATALOG_FILE, new Error("unexpected_shape"))
}

export function writeProducts(products) {
  writeJsonAtomic(CATALOG_FILE, products, { keepBackups: 5 })
}

// Backwards-compatible internal name used by the HTTP routes below.
const writeAtomic = writeProducts

function handleCorrupt(res, err) {
  if (err instanceof CorruptJsonError || err?.code === "corrupt_json") {
    console.error("[catalog] CORRUPT products.json — returning 500")
    return res.status(500).json({ error: "corrupt_catalog", path: CATALOG_FILE })
  }
  throw err
}

export function validateProductShape(body, { partial = false } = {}) {
  const errors = []
  const out = {}

  if (!partial || Object.prototype.hasOwnProperty.call(body, "name")) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      errors.push("invalid_name")
    } else {
      out.name = body.name.trim()
    }
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, "price")) {
    const price = Number(body.price)
    if (!Number.isFinite(price) || price < 0) {
      errors.push("invalid_price")
    } else {
      out.price = price
    }
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, "category")) {
    if (typeof body.category !== "string" || !CATEGORIES.has(body.category)) {
      errors.push("invalid_category")
    } else {
      out.category = body.category
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "tagline")) {
    out.tagline =
      typeof body.tagline === "string" ? body.tagline.trim() : String(body.tagline ?? "")
  }
  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    out.description =
      typeof body.description === "string"
        ? body.description.trim()
        : String(body.description ?? "")
  }
  if (Object.prototype.hasOwnProperty.call(body, "accent")) {
    out.accent =
      typeof body.accent === "string" && body.accent.trim()
        ? body.accent.trim()
        : "#c8f542"
  }
  if (Object.prototype.hasOwnProperty.call(body, "badge")) {
    if (body.badge == null || body.badge === "") {
      out.badge = undefined
    } else {
      out.badge = String(body.badge)
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "art")) {
    if (typeof body.art === "string" && ART_TYPES.has(body.art)) {
      out.art = body.art
    } else if (!partial) {
      out.art = "pack"
    } else {
      errors.push("invalid_art")
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "imageUrl")) {
    if (body.imageUrl == null || body.imageUrl === "") {
      out.imageUrl = undefined
    } else {
      const url = String(body.imageUrl).trim()
      // Reject base64 data URLs — use POST /api/uploads/products instead
      if (/^data:/i.test(url) || url.length > 2048) {
        errors.push("invalid_imageUrl")
      } else {
        out.imageUrl = url
      }
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "inventoryQuantity")) {
    if (body.inventoryQuantity == null || body.inventoryQuantity === "") {
      out.inventoryQuantity = undefined
    } else {
      const quantity = Number(body.inventoryQuantity)
      if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1000000) {
        errors.push("invalid_inventoryQuantity")
      } else {
        out.inventoryQuantity = quantity
      }
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "optionGroups")) {
    out.optionGroups = normalizeOptionGroups(body.optionGroups, errors)
  }

  return { errors, out }
}

/**
 * @param {import("express").Express} app
 */
export function mountCatalog(app) {
  ensureCatalogFile()

  app.get("/api/catalog", (_req, res) => {
    try {
      const products = readProducts()
      return res.json({ products })
    } catch (err) {
      return handleCorrupt(res, err)
    }
  })

  app.get("/api/catalog/products/:id", (req, res) => {
    const id = String(req.params.id || "")
    if (!id) return res.status(400).json({ error: "invalid_id" })
    try {
      const products = readProducts()
      const product = products.find((p) => p.id === id)
      if (!product) return res.status(404).json({ error: "not_found" })
      return res.json({ product })
    } catch (err) {
      return handleCorrupt(res, err)
    }
  })

  app.get("/api/catalog/product-price/:id", (req, res) => {
    const id = String(req.params.id || "")
    if (!id) return res.status(400).json({ error: "invalid_id" })
    try {
      const products = readProducts()
      const product = products.find((p) => p.id === id)
      if (!product) return res.status(404).json({ error: "not_found" })
      return res.json({
        id: product.id,
        price: product.price,
        name: product.name,
      })
    } catch (err) {
      return handleCorrupt(res, err)
    }
  })

  app.post("/api/catalog/products", requireAdmin, (req, res) => {
    const body = req.body ?? {}
    const { errors, out } = validateProductShape(body, { partial: false })
    if (errors.length) {
      return res.status(400).json({ error: errors[0], errors })
    }

    let products
    try {
      products = readProducts()
    } catch (err) {
      return handleCorrupt(res, err)
    }
    let id =
      typeof body.id === "string" && body.id.trim() ? body.id.trim() : newProductId(out.name)
    if (products.some((p) => p.id === id)) {
      id = newProductId(out.name)
    }

    const product = {
      id,
      name: out.name,
      price: out.price,
      category: out.category,
      tagline: out.tagline ?? "Handmade Inkcredible goodies.",
      description:
        out.description ??
        "Fresh from the Inkcredible bench — made with humor and hustle.",
      accent: out.accent ?? "#c8f542",
      art: out.art ?? "pack",
    }
    if (out.badge !== undefined) product.badge = out.badge
    if (out.imageUrl !== undefined) product.imageUrl = out.imageUrl
    if (out.inventoryQuantity !== undefined) product.inventoryQuantity = out.inventoryQuantity
    if (out.optionGroups !== undefined) product.optionGroups = out.optionGroups

    products.unshift(product)
    writeAtomic(products)
    return res.status(201).json({ product })
  })

  app.patch("/api/catalog/products/:id", requireAdmin, (req, res) => {
    const id = String(req.params.id || "")
    if (!id) return res.status(400).json({ error: "invalid_id" })
    const body = req.body ?? {}
    const { errors, out } = validateProductShape(body, { partial: true })
    if (errors.length) {
      return res.status(400).json({ error: errors[0], errors })
    }
    if (Object.keys(out).length === 0) {
      return res.status(400).json({ error: "no_updates" })
    }

    let products
    try {
      products = readProducts()
    } catch (err) {
      return handleCorrupt(res, err)
    }
    const idx = products.findIndex((p) => p.id === id)
    if (idx < 0) return res.status(404).json({ error: "not_found" })

    const prev = products[idx]
    const next = { ...prev }
    for (const [key, value] of Object.entries(out)) {
      if (value === undefined) {
        delete next[key]
      } else {
        next[key] = value
      }
    }
    products[idx] = next
    writeAtomic(products)
    // If imageUrl changed/cleared, drop the old uploads/products file when unreferenced.
    if (
      Object.prototype.hasOwnProperty.call(out, "imageUrl") &&
      prev.imageUrl &&
      prev.imageUrl !== next.imageUrl
    ) {
      deleteProductUploadIfUnreferenced(prev.imageUrl, products)
    }
    return res.json({ product: products[idx] })
  })

  app.delete("/api/catalog/products/:id", requireAdmin, (req, res) => {
    const id = String(req.params.id || "")
    if (!id) return res.status(400).json({ error: "invalid_id" })
    let products
    try {
      products = readProducts()
    } catch (err) {
      return handleCorrupt(res, err)
    }
    const removed = products.find((p) => p.id === id)
    const next = products.filter((p) => p.id !== id)
    if (next.length === products.length) {
      return res.status(404).json({ error: "not_found" })
    }
    writeAtomic(next)
    if (removed?.imageUrl) {
      deleteProductUploadIfUnreferenced(removed.imageUrl, next)
    }
    return res.json({ ok: true })
  })

  app.post("/api/catalog/reset", requireAdmin, (_req, res) => {
    const seed = loadSeedProducts()
    writeAtomic(seed)
    return res.json({ products: seed, reset: true, count: seed.length })
  })
}
