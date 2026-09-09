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
  renameSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const CATALOG_DIR = path.resolve(__dirname, "../data/catalog")
export const CATALOG_FILE = path.join(CATALOG_DIR, "products.json")
export const CATALOG_SEED_FILE = path.join(__dirname, "catalog-seed.json")

const CATEGORIES = new Set(["Pens", "Stickers", "Car Freshies", "Custom"])
const ART_TYPES = new Set([
  "pen",
  "sticker",
  "freshie",
  "resin",
  "badge",
  "pack",
  "skin",
])

mkdirSync(CATALOG_DIR, { recursive: true })

function newProductId(name) {
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

function readProducts() {
  ensureCatalogFile()
  try {
    const raw = readFileSync(CATALOG_FILE, "utf8")
    const data = JSON.parse(raw)
    if (Array.isArray(data)) return data
    if (data && Array.isArray(data.products)) return data.products
    return []
  } catch (err) {
    console.error("[catalog] read failed", err)
    return []
  }
}

function writeAtomic(products) {
  const tmp = `${CATALOG_FILE}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmp, JSON.stringify(products, null, 2), "utf8")
  renameSync(tmp, CATALOG_FILE)
}

function validateProductShape(body, { partial = false } = {}) {
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
      out.imageUrl = String(body.imageUrl).trim()
    }
  }

  return { errors, out }
}

/**
 * @param {import("express").Express} app
 */
export function mountCatalog(app) {
  ensureCatalogFile()

  app.get("/api/catalog", (_req, res) => {
    const products = readProducts()
    return res.json({ products })
  })

  app.get("/api/catalog/products/:id", (req, res) => {
    const id = String(req.params.id || "")
    if (!id) return res.status(400).json({ error: "invalid_id" })
    const products = readProducts()
    const product = products.find((p) => p.id === id)
    if (!product) return res.status(404).json({ error: "not_found" })
    return res.json({ product })
  })

  app.get("/api/catalog/product-price/:id", (req, res) => {
    const id = String(req.params.id || "")
    if (!id) return res.status(400).json({ error: "invalid_id" })
    const products = readProducts()
    const product = products.find((p) => p.id === id)
    if (!product) return res.status(404).json({ error: "not_found" })
    return res.json({
      id: product.id,
      price: product.price,
      name: product.name,
    })
  })

  app.post("/api/catalog/products", (req, res) => {
    const body = req.body ?? {}
    const { errors, out } = validateProductShape(body, { partial: false })
    if (errors.length) {
      return res.status(400).json({ error: errors[0], errors })
    }

    const products = readProducts()
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

    products.unshift(product)
    writeAtomic(products)
    return res.status(201).json({ product })
  })

  app.patch("/api/catalog/products/:id", (req, res) => {
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

    const products = readProducts()
    const idx = products.findIndex((p) => p.id === id)
    if (idx < 0) return res.status(404).json({ error: "not_found" })

    const next = { ...products[idx] }
    for (const [key, value] of Object.entries(out)) {
      if (value === undefined) {
        delete next[key]
      } else {
        next[key] = value
      }
    }
    products[idx] = next
    writeAtomic(products)
    return res.json({ product: products[idx] })
  })

  app.delete("/api/catalog/products/:id", (req, res) => {
    const id = String(req.params.id || "")
    if (!id) return res.status(400).json({ error: "invalid_id" })
    const products = readProducts()
    const next = products.filter((p) => p.id !== id)
    if (next.length === products.length) {
      return res.status(404).json({ error: "not_found" })
    }
    writeAtomic(next)
    return res.json({ ok: true })
  })

  app.post("/api/catalog/reset", (_req, res) => {
    const seed = loadSeedProducts()
    writeAtomic(seed)
    return res.json({ products: seed, reset: true, count: seed.length })
  })
}
