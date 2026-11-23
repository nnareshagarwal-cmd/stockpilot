/**
 * Client-side image compression utility using HTML5 Canvas.
 * Automatically downscales oversized photos (e.g., 12MP/48MP smartphone photos)
 * to web-optimized dimensions (max 1600px) and quality (0.82), reducing 5-10MB images
 * to ~150KB - 350KB before uploading to the server.
 */

export interface CompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  skipIfUnderBytes?: number
}

export async function compressImageFile(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.82,
    skipIfUnderBytes = 350 * 1024, // Skip files already <= 350KB
  } = options

  // Only process standard raster images (skip SVG, PDF, etc.)
  if (!file.type.startsWith('image/') || file.type.includes('svg')) {
    return file
  }

  // If already small enough, no compression needed
  if (file.size <= skipIfUnderBytes) {
    return file
  }

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img

        // Calculate proportional scale down if exceeding max bounds
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          } else {
            width = Math.round((width * maxHeight) / height)
            height = maxHeight
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          resolve(file)
          return
        }

        // Keep WebP for PNGs to preserve transparent alpha channel, otherwise JPEG
        const isPng = file.type === 'image/png'
        const outputType = isPng ? 'image/webp' : 'image/jpeg'

        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              // If compressed blob is somehow not smaller, keep original
              resolve(file)
              return
            }

            const ext = outputType === 'image/webp' ? '.webp' : '.jpg'
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
            const newFileName = `${baseName}${ext}`

            const compressedFile = new File([blob], newFileName, {
              type: outputType,
              lastModified: Date.now(),
            })

            console.info(
              `[ImageCompressor] "${file.name}" compressed from ${(file.size / 1024 / 1024).toFixed(2)} MB to ${(compressedFile.size / 1024).toFixed(1)} KB`
            )

            resolve(compressedFile)
          },
          outputType,
          quality
        )
      }

      img.onerror = () => resolve(file)
      img.src = e.target?.result as string
    }

    reader.onerror = () => resolve(file)
    reader.readAsDataURL(file)
  })
}
