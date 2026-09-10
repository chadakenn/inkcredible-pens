import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import * as z from 'zod/v4'
import {
  CATALOG_DIR,
  newProductId,
  readProducts,
  validateProductShape,
  writeProducts,
} from './catalog.mjs'
import { saveProductImageBuffer } from './uploads.mjs'
import { readJsonFile, writeJsonAtomic } from './security.mjs'

const DRAFT_DIR = path.join(CATALOG_DIR, 'drafts')
const DEFAULT_EMAIL_CLAIM = 'https://inkcredible.kennedyshome.com/email'
const DEFAULT_VERIFIED_CLAIM = 'https://inkcredible.kennedyshome.com/email_verified'
const DEFAULT_ALLOWED = [
  'chadakennedy86@gmail.com',
  'kelliekennedy81@gmail.com',
]
const CATEGORIES = ['Pens', 'Stickers', 'Car Freshies', 'Custom']
const ART_TYPES = ['pen', 'sticker', 'freshie', 'resin', 'badge', 'pack', 'skin']

mkdirSync(DRAFT_DIR, { recursive: true })

function config() {
  const issuer = String(process.env.AUTH0_ISSUER_BASE_URL || '').replace(/\/+$/, '')
  const audience = String(process.env.AUTH0_AUDIENCE || '')
  const publicOrigin = String(
    process.env.PUBLIC_ORIGIN || process.env.ORIGIN || 'https://inkcredible.kennedyshome.com',
  ).replace(/\/+$/, '')
  const allowedEmails = new Set(
    String(process.env.LISTING_ALLOWED_EMAILS || DEFAULT_ALLOWED.join(','))
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
  return { issuer, audience, publicOrigin, allowedEmails }
}

let jwksCache
let jwksIssuer
function jwksFor(issuer) {
  if (!jwksCache || jwksIssuer !== issuer) {
    jwksIssuer = issuer
    jwksCache = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))
  }
  return jwksCache
}

function bearer(req) {
  const match = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || '').trim())
  return match?.[1] || null
}

async function authenticate(req, res, next) {
  const { issuer, audience, publicOrigin, allowedEmails } = config()
  const metadata = `${publicOrigin}/.well-known/oauth-protected-resource`
  const deny = (status, error, description) => {
    res.setHeader(
      'WWW-Authenticate',
      `Bearer error="${error}", error_description="${description}", resource_metadata="${metadata}"`,
    )
    return res.status(status).json({ error, error_description: description })
  }
  if (!issuer || !audience) {
    return deny(503, 'server_error', 'Auth0 is not configured')
  }
  const token = bearer(req)
  if (!token) return deny(401, 'invalid_token', 'Missing bearer token')
  try {
    const { payload } = await jwtVerify(token, jwksFor(issuer), {
      issuer: `${issuer}/`,
      audience,
      algorithms: ['RS256'],
    })
    const emailClaim = process.env.AUTH0_EMAIL_CLAIM || DEFAULT_EMAIL_CLAIM
    const verifiedClaim = process.env.AUTH0_EMAIL_VERIFIED_CLAIM || DEFAULT_VERIFIED_CLAIM
    const email = String(payload[emailClaim] || payload.email || '').trim().toLowerCase()
    const verified = payload[verifiedClaim] ?? payload.email_verified
    if (!email || verified !== true || !allowedEmails.has(email)) {
      return deny(403, 'insufficient_scope', 'This verified account is not allowed to manage listings')
    }
    req.listingUser = { email, sub: String(payload.sub || '') }
    return next()
  } catch (error) {
    console.warn('[listings-mcp] token rejected:', error?.code || error?.message)
    return deny(401, 'invalid_token', 'Token is invalid or expired')
  }
}

function draftPath(id) {
  if (!/^[a-f0-9-]{36}$/i.test(String(id))) throw new Error('invalid_draft_id')
  return path.join(DRAFT_DIR, `${id}.json`)
}

function readDraft(id) {
  const file = draftPath(id)
  if (!existsSync(file)) return null
  return readJsonFile(file)
}

function saveDraft(draft) {
  draft.updatedAt = new Date().toISOString()
  writeJsonAtomic(draftPath(draft.id), draft, { keepBackups: 2 })
  return draft
}

function listDrafts(owner) {
  return readdirSync(DRAFT_DIR)
    .filter((name) => /^[a-f0-9-]{36}\.json$/i.test(name))
    .map((name) => readJsonFile(path.join(DRAFT_DIR, name)))
    .filter((draft) => draft?.owner === owner)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
}

function ownedDraft(id, owner) {
  const draft = readDraft(id)
  if (!draft || draft.owner !== owner) throw new Error('draft_not_found')
  return draft
}

function result(value, message) {
  return {
    content: [{ type: 'text', text: message || JSON.stringify(value, null, 2) }],
    structuredContent: value,
  }
}

export function createListingsMcpServer(actor) {
  const server = new McpServer({ name: 'inkcredible-listings', version: '0.1.0' })

  server.registerTool('search_listings', {
    title: 'Search store listings',
    description: 'Find current storefront products by name, description, category, or ID.',
    inputSchema: {
      query: z.string().max(120).optional(),
      category: z.enum(CATEGORIES).optional(),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ query, category }) => {
    const needle = String(query || '').trim().toLowerCase()
    const products = readProducts().filter((product) => {
      if (category && product.category !== category) return false
      if (!needle) return true
      return [product.id, product.name, product.tagline, product.description]
        .some((value) => String(value || '').toLowerCase().includes(needle))
    })
    return result({ products, count: products.length })
  })

  server.registerTool('get_listing', {
    title: 'Get a store listing',
    description: 'Load one current storefront product by its exact ID.',
    inputSchema: { id: z.string().min(1).max(120) },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ id }) => {
    const product = readProducts().find((item) => item.id === id)
    if (!product) throw new Error('listing_not_found')
    return result({ product })
  })

  server.registerTool('list_listing_drafts', {
    title: 'List my listing drafts',
    description: 'List unpublished drafts belonging to the signed-in user.',
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async () => result({ drafts: listDrafts(actor.email) }))

  server.registerTool('create_listing_draft', {
    title: 'Create a listing draft',
    description: 'Save an unpublished listing draft. This never changes the live storefront.',
    inputSchema: {
      name: z.string().min(1).max(120),
      price: z.number().min(0).max(100000),
      category: z.enum(CATEGORIES),
      tagline: z.string().max(180).optional(),
      description: z.string().max(4000).optional(),
      badge: z.string().max(80).optional(),
      accent: z.string().max(32).optional(),
      art: z.enum(ART_TYPES).optional(),
      imageUrl: z.string().max(2048).optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async (input) => {
    const { errors, out } = validateProductShape(input, { partial: false })
    if (errors.length) throw new Error(errors.join(','))
    const now = new Date().toISOString()
    const draft = saveDraft({
      id: randomUUID(), owner: actor.email, createdBy: actor.sub, createdAt: now,
      ...out, status: 'draft',
    })
    return result({ draft }, `Draft ${draft.id} saved. It is not visible on the store.`)
  })

  server.registerTool('update_listing_draft', {
    title: 'Update a listing draft',
    description: 'Change selected fields on an unpublished draft.',
    inputSchema: {
      draftId: z.string().uuid(),
      name: z.string().min(1).max(120).optional(),
      price: z.number().min(0).max(100000).optional(),
      category: z.enum(CATEGORIES).optional(),
      tagline: z.string().max(180).optional(),
      description: z.string().max(4000).optional(),
      badge: z.string().max(80).nullable().optional(),
      accent: z.string().max(32).optional(),
      art: z.enum(ART_TYPES).optional(),
      imageUrl: z.string().max(2048).nullable().optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async ({ draftId, ...changes }) => {
    const draft = ownedDraft(draftId, actor.email)
    const { errors, out } = validateProductShape(changes, { partial: true })
    if (errors.length) throw new Error(errors.join(','))
    Object.assign(draft, out)
    return result({ draft: saveDraft(draft) })
  })

  server.registerTool('upload_listing_photo', {
    title: 'Upload a draft product photo',
    description: 'Attach a JPEG, PNG, WebP, or GIF photo to an unpublished draft. Supply only raw base64, without a data URL prefix. Maximum decoded size is 8 MB.',
    inputSchema: {
      draftId: z.string().uuid(),
      imageBase64: z.string().min(16),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async ({ draftId, imageBase64 }) => {
    const draft = ownedDraft(draftId, actor.email)
    const clean = imageBase64.replace(/\s/g, '')
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) throw new Error('invalid_base64')
    const buffer = Buffer.from(clean, 'base64')
    if (!buffer.length || buffer.length > 8 * 1024 * 1024) throw new Error('invalid_image_size')
    const saved = saveProductImageBuffer(buffer)
    draft.imageUrl = saved.url
    saveDraft(draft)
    return result({ draft, photo: { url: saved.url, mime: saved.mime, size: saved.size } })
  })

  server.registerTool('publish_listing', {
    title: 'Publish a listing draft',
    description: 'Publish a reviewed draft to the live storefront. Call only after the user explicitly confirms the final title, price, category, description, and photo.',
    inputSchema: {
      draftId: z.string().uuid(),
      confirmed: z.literal(true).describe('Must be true only after explicit user confirmation.'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async ({ draftId }) => {
    const draft = ownedDraft(draftId, actor.email)
    const { errors, out } = validateProductShape(draft, { partial: false })
    if (errors.length) throw new Error(errors.join(','))
    const products = readProducts()
    const product = { id: newProductId(out.name), ...out }
    products.unshift(product)
    writeProducts(products)
    unlinkSync(draftPath(draftId))
    return result({ product, publishedBy: actor.email }, `${product.name} is now live at product ID ${product.id}.`)
  })

  server.registerTool('update_listing', {
    title: 'Update a live listing',
    description: 'Update selected fields on an existing live storefront product.',
    inputSchema: {
      id: z.string().min(1).max(120),
      name: z.string().min(1).max(120).optional(),
      price: z.number().min(0).max(100000).optional(),
      category: z.enum(CATEGORIES).optional(),
      tagline: z.string().max(180).optional(),
      description: z.string().max(4000).optional(),
      badge: z.string().max(80).nullable().optional(),
      accent: z.string().max(32).optional(),
      art: z.enum(ART_TYPES).optional(),
      imageUrl: z.string().max(2048).nullable().optional(),
      confirmed: z.literal(true),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  }, async ({ id, confirmed: _confirmed, ...changes }) => {
    const { errors, out } = validateProductShape(changes, { partial: true })
    if (errors.length || !Object.keys(out).length) throw new Error(errors[0] || 'no_updates')
    const products = readProducts()
    const index = products.findIndex((item) => item.id === id)
    if (index < 0) throw new Error('listing_not_found')
    products[index] = { ...products[index], ...out }
    for (const [key, value] of Object.entries(products[index])) {
      if (value === undefined) delete products[index][key]
    }
    writeProducts(products)
    return result({ product: products[index], updatedBy: actor.email })
  })

  server.registerTool('delete_listing', {
    title: 'Delete a live listing',
    description: 'Permanently remove a live product. Call only after the user explicitly confirms deletion.',
    inputSchema: { id: z.string().min(1).max(120), confirmed: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  }, async ({ id }) => {
    const products = readProducts()
    const product = products.find((item) => item.id === id)
    if (!product) throw new Error('listing_not_found')
    writeProducts(products.filter((item) => item.id !== id))
    return result({ deleted: product, deletedBy: actor.email })
  })

  return server
}

/** Mount the private Streamable HTTP MCP endpoint and OAuth resource metadata. */
export function mountListingsMcp(app) {
  app.get('/.well-known/oauth-protected-resource', (_req, res) => {
    const { issuer, publicOrigin } = config()
    return res.json({
      resource: `${publicOrigin}/mcp`,
      authorization_servers: issuer ? [`${issuer}/`] : [],
      scopes_supported: ['openid', 'profile', 'email'],
      bearer_methods_supported: ['header'],
      resource_name: 'Inkcredible Pens Listings',
    })
  })

  app.all('/mcp', authenticate, async (req, res) => {
    if (!['POST', 'GET', 'DELETE'].includes(req.method)) return res.sendStatus(405)
    const server = createListingsMcpServer(req.listingUser)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })
    res.on('close', () => {
      transport.close().catch(() => {})
      server.close().catch(() => {})
    })
    await server.connect(transport)
    return transport.handleRequest(req, res, req.body)
  })
}
