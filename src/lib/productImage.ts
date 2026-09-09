const MAX_INPUT_BYTES = 20 * 1024 * 1024
const MAX_OUTPUT_BYTES = 1.5 * 1024 * 1024
const MAX_DIMENSION = 1200
const OUTPUT_QUALITY = 0.8

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

export class ProductImageError extends Error {}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new ProductImageError('That file is not a valid photo. Try a PNG, JPG, or WebP.'))
    }
    image.src = objectUrl
  })
}

function canvasBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, OUTPUT_QUALITY))
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new ProductImageError('We could not read that photo. Please try another one.'))
    reader.readAsDataURL(blob)
  })
}

export async function prepareProductImage(file: File): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new ProductImageError('Please choose a PNG, JPG, or WebP photo.')
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new ProductImageError('That original photo is too large. Choose one under 20 MB.')
  }

  const image = await loadImage(file)
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new ProductImageError('That file is not a valid photo. Try another one.')
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new ProductImageError('This browser could not prepare the photo. Please try again.')
  }

  context.drawImage(image, 0, 0, width, height)
  let output = await canvasBlob(canvas, 'image/webp')

  if (!output || output.type !== 'image/webp') {
    context.globalCompositeOperation = 'destination-over'
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    output = await canvasBlob(canvas, 'image/jpeg')
  }

  if (!output) {
    throw new ProductImageError('This photo could not be compressed. Please try another one.')
  }
  if (output.size > MAX_OUTPUT_BYTES) {
    throw new ProductImageError('Photo is still too large after resizing. Try a smaller one.')
  }

  return blobToDataUrl(output)
}
