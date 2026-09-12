import assert from 'node:assert/strict'
import { renderSeoDocument, sitemapXml } from '../server/seo.mjs'

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

const html = renderSeoDocument('/product/test%20%26%20pen', products)
assert.match(html, /Bright &lt;Bold&gt; Pen \| Inkcredible/)
assert.match(html, /https:\/\/inkcredible\.kennedyshome\.com\/uploads\/products\/test\.jpg/)
assert.match(html, /"price":"6\.00"/)
assert.match(html, /"availability":"https:\/\/schema\.org\/InStock"/)
assert.doesNotMatch(html, /Bright <Bold> Pen/)

const missing = renderSeoDocument('/product/missing', products)
assert.match(missing, /name="robots" content="noindex"/)

const sitemap = sitemapXml(products)
assert.match(sitemap, /\/product\/test%20%26%20pen/)
assert.doesNotMatch(sitemap, /hidden-product/)
assert.doesNotMatch(sitemap, /\/admin/)

console.log('SEO metadata and sitemap tests passed')
