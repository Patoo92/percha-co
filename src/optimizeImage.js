const MAX_IMAGE_DIMENSION = 1600
const WEBP_QUALITY = 0.82

export async function optimizeImage(file) {
  if (file.type === 'image/gif' || typeof createImageBitmap !== 'function') return file

  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error('No se pudo optimizar la imagen.')),
        'image/webp',
        WEBP_QUALITY,
      )
    })
    if (blob.size >= file.size && scale === 1) return file

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'producto'
    return new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: file.lastModified })
  } finally {
    bitmap.close()
  }
}
