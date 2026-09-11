import createDOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'
import sharp from 'sharp'

const FORBIDDEN_TAGS = [
  'script', 'foreignObject', 'iframe', 'object', 'embed', 'link', 'meta',
  'audio', 'video', 'canvas', 'style',
]
const MAX_SVG_CHARS = 4_000_000
const MAX_RENDER_PIXELS = 40_000_000
const PREVIEW_EDGE = 1200

function safeReference(value) {
  const trimmed = String(value || '').trim()
  return (
    trimmed === '' ||
    trimmed.startsWith('#') ||
    /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(trimmed)
  )
}

function safeInlineStyle(value) {
  const compact = String(value || '').replace(/\s+/g, ' ')
  if (/@import|expression\s*\(|javascript:|vbscript:|-moz-binding/i.test(compact)) return false
  const urls = compact.match(/url\s*\(([^)]+)\)/gi) || []
  return urls.every((entry) => /^url\s*\(\s*['"]?#[^)'"]+['"]?\s*\)$/i.test(entry))
}

export function sanitizeSvgBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw Object.assign(new Error('invalid_svg'), { code: 'invalid_svg' })
  }
  const source = buffer.toString('utf8').replace(/^\uFEFF/, '')
  if (
    source.length > MAX_SVG_CHARS ||
    /<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(source)
  ) {
    throw Object.assign(new Error('unsafe_svg'), { code: 'unsafe_svg' })
  }

  const window = new JSDOM('').window
  try {
    const purifier = createDOMPurify(window)
    const cleaned = purifier.sanitize(source, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: FORBIDDEN_TAGS,
      FORBID_ATTR: ['src', 'formaction', 'action', 'xml:base'],
    })
    const parsed = new JSDOM(cleaned, { contentType: 'image/svg+xml' })
    const root = parsed.window.document.documentElement
    if (root.localName !== 'svg') {
      throw Object.assign(new Error('invalid_svg'), { code: 'invalid_svg' })
    }

    for (const element of root.querySelectorAll('*')) {
      for (const attr of [...element.attributes]) {
        const name = attr.name.toLowerCase()
        if (name.startsWith('on')) element.removeAttribute(attr.name)
        if ((name === 'href' || name === 'xlink:href') && !safeReference(attr.value)) {
          element.removeAttribute(attr.name)
        }
        if (name === 'style' && !safeInlineStyle(attr.value)) {
          element.removeAttribute(attr.name)
        }
      }
    }

    return Buffer.from(parsed.window.document.documentElement.outerHTML, 'utf8')
  } finally {
    window.close()
  }
}

export async function svgPreviewPng(sanitizedSvg) {
  try {
    return await sharp(sanitizedSvg, {
      density: 300,
      failOn: 'error',
      limitInputPixels: MAX_RENDER_PIXELS,
    })
      .resize({
        width: PREVIEW_EDGE,
        height: PREVIEW_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png({ compressionLevel: 9 })
      .toBuffer()
  } catch (error) {
    throw Object.assign(new Error('invalid_svg'), { code: 'invalid_svg', cause: error })
  }
}
