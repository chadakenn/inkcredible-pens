import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readProducts } from './catalog.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const INDEX_FILE = path.resolve(__dirname, '../dist/index.html')
const ORIGIN = 'https://inkcredible.kennedyshome.com'
const DEFAULT_IMAGE = `${ORIGIN}/inkcredible-main-logo.jpg`
const META_PATTERN = /<!-- SEO_META_START -->[\s\S]*?<!-- SEO_META_END -->/

const PAGE_META = new Map([
  ['/', ['Inkcredible Pens', 'Handmade pens, stickers, car freshies, canvas prints, and custom graphics from Inkcredible.']],
  ['/shop', ['Shop Inkcredible', 'Shop handmade pens, stickers, car freshies, canvas prints, and custom creations.']],
  ['/pens', ['Handmade Pens | Inkcredible', 'Shop colorful handmade pens created by Inkcredible.']],
  ['/stickers', ['Custom Stickers | Inkcredible', 'Shop stickers and order custom logo stickers from Inkcredible.']],
  ['/freshies', ['Car Freshies | Inkcredible', 'Shop handmade scented car freshies from Inkcredible.']],
  ['/canvas', ['Canvas Prints | Inkcredible', 'Turn your favorite image into a custom canvas print.']],
  ['/custom', ['Custom Creations | Inkcredible', 'Order custom graphics, signs, cards, stickers, banners, and more.']],
  ['/contact', ['Contact Inkcredible', 'Contact Inkcredible about an order or custom project.']],
  ['/shipping-returns', ['Shipping & Returns | Inkcredible', 'Inkcredible shipping rates, return eligibility, custom-product policy, and help for damaged orders.']],
])

const CUSTOM_META = new Map([
  ['logo-stickers', ['Custom Logo Stickers | Inkcredible', 'Upload your logo and order custom stickers made for your business.']],
  ['banners', ['Custom Banners | Inkcredible', 'Create a custom banner for your business, event, or celebration.']],
  ['canvas', ['Custom Canvas Prints | Inkcredible', 'Upload a photo and create a custom canvas print.']],
  ['business-cards', ['Custom Business Cards | Inkcredible', 'Order custom business cards designed and printed by Inkcredible.']],
  ['thank-you-cards', ['Custom Thank-You Cards | Inkcredible', 'Order branded thank-you cards for your small business.']],
  ['photo-freshie', ['Custom Photo Freshie | Inkcredible', 'Turn a favorite photo into a custom scented car freshie.']],
])

function htmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function xmlEscape(value) {
  return htmlEscape(value)
}

function jsonLd(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c')
}

function absoluteUrl(value, fallback = DEFAULT_IMAGE) {
  const input = String(value || '').trim()
  if (!input) return fallback
  try {
    return new URL(input, ORIGIN).href
  } catch {
    return fallback
  }
}

function metaBlock({ title, description, pathname, image = DEFAULT_IMAGE, type = 'website', structuredData, noindex = false }) {
  const canonical = `${ORIGIN}${pathname === '/' ? '/' : pathname}`
  const safeTitle = htmlEscape(title)
  const safeDescription = htmlEscape(description)
  const safeCanonical = htmlEscape(canonical)
  const safeImage = htmlEscape(absoluteUrl(image))
  const data = structuredData || {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    name: 'Inkcredible',
    url: ORIGIN,
    image: DEFAULT_IMAGE,
    email: 'inkcredible.pens@gmail.com',
    sameAs: [
      'https://www.facebook.com/profile.php?id=61560788565817',
      'https://www.facebook.com/profile.php?id=61584172868010',
    ],
  }

  return `<!-- SEO_META_START -->
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    ${noindex ? '<meta name="robots" content="noindex" />' : ''}
    <link rel="canonical" href="${safeCanonical}" />
    <meta property="og:type" content="${htmlEscape(type)}" />
    <meta property="og:site_name" content="Inkcredible" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:url" content="${safeCanonical}" />
    <meta property="og:image" content="${safeImage}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${safeImage}" />
    <script type="application/ld+json">${jsonLd(data)}</script>
    <!-- SEO_META_END -->`
}

function cleanPathname(value) {
  const pathname = String(value || '/').split('?')[0].replace(/\/+$/, '') || '/'
  return pathname.startsWith('/') ? pathname : `/${pathname}`
}

function publicProducts(products) {
  return products.filter((product) => product && !product.hidden && product.id)
}

function merchantProducts(products) {
  return publicProducts(products).filter((product) => product.imageUrl && Number.isFinite(Number(product.price)))
}

function merchantText(value, maxLength) {
  return Array.from(String(value ?? ''))
    .filter((character) => {
      const code = character.codePointAt(0)
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)
    })
    .join('')
    .trim()
    .slice(0, maxLength)
}

export function renderSeoDocument(pathname, products = readProducts()) {
  const index = readFileSync(INDEX_FILE, 'utf8')
  const route = cleanPathname(pathname)
  const productId = route.startsWith('/product/') ? decodeURIComponent(route.slice('/product/'.length)) : null
  const product = productId ? publicProducts(products).find((item) => String(item.id) === productId) : null

  if (product) {
    const title = `${product.name} | Inkcredible`
    const description = product.description || product.tagline || `Shop ${product.name} from Inkcredible.`
    const canonicalPath = `/product/${encodeURIComponent(product.id)}`
    const image = absoluteUrl(product.imageUrl)
    const availability = product.inventoryQuantity === 0 ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock'
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description,
      image: [image],
      sku: String(product.id),
      brand: { '@type': 'Brand', name: 'Inkcredible' },
      offers: {
        '@type': 'Offer',
        url: `${ORIGIN}${canonicalPath}`,
        priceCurrency: 'USD',
        price: Number(product.price || 0).toFixed(2),
        availability,
      },
    }
    return index.replace(META_PATTERN, metaBlock({ title, description, pathname: canonicalPath, image, type: 'product', structuredData }))
  }

  if (productId) {
    return index.replace(META_PATTERN, metaBlock({
      title: 'Product not found | Inkcredible',
      description: 'This Inkcredible product is no longer available.',
      pathname: route,
      noindex: true,
    }))
  }

  const customSlug = route.startsWith('/custom/') ? route.slice('/custom/'.length) : null
  const details = (customSlug && CUSTOM_META.get(customSlug)) || PAGE_META.get(route) || PAGE_META.get('/')
  return index.replace(META_PATTERN, metaBlock({ title: details[0], description: details[1], pathname: route }))
}

export function sitemapXml(products = readProducts()) {
  const staticPaths = [...PAGE_META.keys(), ...[...CUSTOM_META.keys()].map((slug) => `/custom/${slug}`)]
  const productPaths = publicProducts(products).map((product) => `/product/${encodeURIComponent(product.id)}`)
  const urls = [...new Set([...staticPaths, ...productPaths])]
  const body = urls.map((route) => `  <url><loc>${xmlEscape(`${ORIGIN}${route === '/' ? '/' : route}`)}</loc></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

export function merchantFeedXml(products = readProducts()) {
  const items = merchantProducts(products).map((product) => {
    const id = merchantText(product.id, 50)
    const title = merchantText(product.name, 150)
    const description = merchantText(product.description || product.tagline || `Shop ${product.name} from Inkcredible.`, 5000)
    const link = `${ORIGIN}/product/${encodeURIComponent(product.id)}`
    const image = absoluteUrl(product.imageUrl)
    const availability = product.inventoryQuantity === 0 ? 'out of stock' : 'in stock'
    const category = merchantText(product.category || 'Handmade products', 750)
    return `    <item>
      <g:id>${xmlEscape(id)}</g:id>
      <g:title>${xmlEscape(title)}</g:title>
      <g:description>${xmlEscape(description)}</g:description>
      <g:link>${xmlEscape(link)}</g:link>
      <g:image_link>${xmlEscape(image)}</g:image_link>
      <g:availability>${availability}</g:availability>
      <g:price>${Number(product.price).toFixed(2)} USD</g:price>
      <g:condition>new</g:condition>
      <g:brand>Inkcredible</g:brand>
      <g:identifier_exists>no</g:identifier_exists>
      <g:product_type>${xmlEscape(category)}</g:product_type>
    </item>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>Inkcredible Products</title>
    <link>${ORIGIN}</link>
    <description>Live product catalog for Inkcredible handmade and custom products.</description>
${items}
  </channel>
</rss>
`
}

export function mountSeo(app) {
  app.get('/sitemap.xml', (_req, res) => {
    res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(sitemapXml())
  })
  app.get('/google-products.xml', (_req, res) => {
    res.type('application/xml').set('Cache-Control', 'public, max-age=900').send(merchantFeedXml())
  })
  app.get(['/', '/shop', '/pens', '/stickers', '/freshies', '/canvas', '/custom', '/contact', '/custom/*page', '/product/:id'], (req, res, next) => {
    try {
      res.type('html').set('Cache-Control', 'public, max-age=300').send(renderSeoDocument(req.path))
    } catch (error) {
      next(error)
    }
  })
}
