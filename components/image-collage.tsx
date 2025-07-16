"use client"

import { useState, useEffect } from "react"
import { Download, Loader2, Expand } from "lucide-react"
import ImageModal from "./image-modal"

interface ImageCollageProps {
  prompts: string[]
  messageId?: number
}

interface ImageStatus {
  url: string
  loaded: boolean
  error: boolean
  prompt: string
}

export default function ImageCollage({ prompts, messageId }: ImageCollageProps) {
  const [images, setImages] = useState<ImageStatus[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<ImageStatus | null>(null)

  useEffect(() => {
    // Only update if messageId changes or if this is the first time
    const imageStatuses = prompts.map((prompt) => ({
      url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`,
      loaded: false,
      error: false,
      prompt: prompt,
    }))
    setImages(imageStatuses)
  }, [messageId]) // Only depend on messageId, not prompts

  const handleImageLoad = (index: number) => {
    setImages((prev) => prev.map((img, i) => (i === index ? { ...img, loaded: true } : img)))
  }

  const handleImageError = (index: number) => {
    setImages((prev) => prev.map((img, i) => (i === index ? { ...img, error: true, loaded: true } : img)))
  }

  const downloadImage = async (url: string, index: number) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = `luna-ai-image-${index + 1}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error("Download failed:", error)
    }
  }

  const handleImageClick = (image: ImageStatus) => {
    setSelectedImage(image)
    setModalOpen(true)
  }

  return (
    <div className="relative space-y-3">
      <div className="text-white/70 text-sm mb-3">Generated 4 image variations for you:</div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
        {images.map((image, index) => (
          <div
            key={`${messageId}-${index}`}
            className="relative aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-purple-900/20 to-purple-700/20 border border-purple-500/20 group cursor-pointer"
            onClick={() => handleImageClick(image)}
          >
            {!image.loaded && !image.error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <Loader2 className="h-6 w-6 text-purple-400 animate-spin mx-auto" />
                  <p className="text-white/60 text-xs">Generating...</p>
                </div>
              </div>
            )}

            {image.error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="text-red-400 text-xs">Failed to load</div>
                </div>
              </div>
            )}

            <img
              src={image.url || "/placeholder.svg"}
              alt={`Generated image ${index + 1}`}
              onLoad={() => handleImageLoad(index)}
              onError={() => handleImageError(index)}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                image.loaded && !image.error ? "opacity-100" : "opacity-0"
              }`}
            />

            {image.loaded && !image.error && (
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleImageClick(image)
                  }}
                  className="p-1.5 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                  title="View larger"
                >
                  <Expand className="h-3 w-3 text-white" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    downloadImage(image.url, index)
                  }}
                  className="p-1.5 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                  title="Download image"
                >
                  <Download className="h-3 w-3 text-white" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-white/50 text-xs mt-2">
        Click any image to view it larger. Use the download button to save images.
      </div>

      {/* Full-Screen Image Modal */}
      {selectedImage && (
        <ImageModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          imageUrl={selectedImage.url}
          prompt={selectedImage.prompt}
        />
      )}
    </div>
  )
}
