import assert from 'node:assert/strict'
import sharp from 'sharp'
import { merchantFeedXml, renderProductShareImage, renderSeoDocument, sitemapXml } from '../server/seo.mjs'

const products = [
  {
    id: 'test & pen',
    name: 'Bright <Bold> Pen',
    description: 'A fun & bright handmade pen.',
    imageUrl: '/uploads/products/test.jpg',
    price: 6,
    inventoryQuantity: 2,
  },
  { id: 'hidden-product', name: 'Hidden', price: 1, hidden: true },
]

const uploadedProduct = [{ ...products[0], imageUrl: '/uploads/products/59169e99-4ae7-4877-9a0c-bc4377a6cf98.jpg' }]
const previewHtml = renderSeoDocument('/product/test%20%26%20pen', uploadedProduct)
assert.match(previewHtml, /og:image" content="https:\/\/inkcredible\.kennedyshome\.com\/uploads\/products\/share\/59169e99-4ae7-4877-9a0c-bc4377a6cf98\.jpg\?v=3"/)
assert.match(previewHtml, /"image":\["https:\/\/inkcredible\.kennedyshome\.com\/uploads\/products\/59169e99-4ae7-4877-9a0c-bc4377a6cf98\.jpg"\]/)

const clownProduct = [{ ...products[0], imageUrl: '/uploads/products/74998dd5-0c42-4333-891d-7a29b0d96d3d.jpg' }]
const clownHtml = renderSeoDocument('/product/test%20%26%20pen', clownProduct)
assert.match(clownHtml, /og:image" content="https:\/\/inkcredible\.kennedyshome\.com\/uploads\/products\/share\/74998dd5-0c42-4333-891d-7a29b0d96d3d\.jpg\?v=3"/)
assert.match(clownHtml, /"image":\["https:\/\/inkcredible\.kennedyshome\.com\/uploads\/products\/74998dd5-0c42-4333-891d-7a29b0d96d3d\.jpg"\]/)

const portrait = await sharp({ create: { width: 400, height: 600, channels: 3, background: '#ff0000' } }).png().toBuffer()
const share = await renderProductShareImage(portrait)
const metadata = await sharp(share).metadata()
assert.equal(metadata.width, 1200)
assert.equal(metadata.height, 630)
const edge = await sharp(share).extract({ left: 10, top: 315, width: 1, height: 1 }).raw().toBuffer()
const center = await sharp(share).extract({ left: 600, top: 315, width: 1, height: 1 }).raw().toBuffer()
assert.ok(edge[0] < center[0] / 2, 'portrait side fill should be dark, with the artwork unchanged at center')

const html = renderSeoDocument('/product/test%20%26%20pen', products)
assert.match(html, /Bright &lt;Bold&gt; Pen \| Inkcredible/)
assert.match(html, /https:\/\/inkcredible\.kennedyshome\.com\/uploads\/products\/test\.jpg/)
assert.match(html, /"price":"6\.00"/)
assert.match(html, /"availability":"https:\/\/schema\.org\/InStock"/)
assert.doesNotMatch(html, /Bright <Bold> Pen/)

const missing = renderSeoDocument('/product/missing', products)
assert.match(missing, /name="robots" content="noindex"/)

const shippingReturns = renderSeoDocument('/shipping-returns', products)
assert.match(shippingReturns, /Shipping &amp; Returns \| Inkcredible/)

const sitemap = sitemapXml(products)
assert.match(sitemap, /\/product\/test%20%26%20pen/)
assert.doesNotMatch(sitemap, /hidden-product/)
assert.doesNotMatch(sitemap, /\/admin/)
assert.match(sitemap, /\/shipping-returns/)

console.log('SEO metadata and sitemap tests passed')

const merchantFeed = merchantFeedXml(products)
assert.match(merchantFeed, /xmlns:g="http:\/\/base\.google\.com\/ns\/1\.0"/)
assert.match(merchantFeed, /<g:id>test &amp; pen<\/g:id>/)
assert.match(merchantFeed, /<g:title>Bright &lt;Bold&gt; Pen<\/g:title>/)
assert.match(merchantFeed, /<g:price>6\.00 USD<\/g:price>/)
assert.match(merchantFeed, /<g:identifier_exists>no<\/g:identifier_exists>/)
assert.match(merchantFeed, /<g:availability>in stock<\/g:availability>/)
assert.doesNotMatch(merchantFeed, /hidden-product/)

console.log('Google Merchant product feed tests passed')
