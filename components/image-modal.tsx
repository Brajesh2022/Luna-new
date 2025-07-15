"use client"

import { useState, useEffect } from "react"
import { X, Download, Loader2 } from "lucide-react" // Import Loader2
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"

interface ImageModalProps {
  isOpen: boolean
  onClose: () => void
  imageUrl: string
  prompt: string
}

export default function ImageModal({ isOpen, onClose, imageUrl, prompt }: ImageModalProps) {
  const [displayImageUrl, setDisplayImageUrl] = useState<string | null>(null)
  const [imageLoading, setImageLoading] = useState(true)

  // Function to generate watermarked image
  const generateWatermarkedImage = async (originalUrl: string, textPrompt: string) => {
    setImageLoading(true)
    setDisplayImageUrl(null) // Clear previous image

    try {
      const response = await fetch(originalUrl)
      const blob = await response.blob()

      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      const img = new Image()
      img.crossOrigin = "anonymous" // CRITICAL for CORS issues when drawing external images to canvas

      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        ctx!.drawImage(img, 0, 0)

        const watermarkText = "Made with LUNA AI"
        const fontSize = Math.max(24, img.width * 0.03)
        ctx!.font = `bold ${fontSize}px Arial`

        const padding = 30
        const textWidth = ctx!.measureText(watermarkText).width
        const x = canvas.width - textWidth - padding
        const y = canvas.height - padding

        const bgPadding = 12
        const bgWidth = textWidth + bgPadding * 2
        const bgHeight = fontSize + bgPadding * 1.5

        const gradient = ctx!.createLinearGradient(
          x - bgPadding,
          y - bgHeight + bgPadding,
          x + textWidth + bgPadding,
          y + bgPadding,
        )
        gradient.addColorStop(0, "rgba(147, 51, 234, 0.9)")
        gradient.addColorStop(1, "rgba(79, 70, 229, 0.9)")

        ctx!.fillStyle = gradient
        ctx!.fillRect(x - bgPadding, y - bgHeight + bgPadding, bgWidth, bgHeight)

        ctx!.fillStyle = "rgba(255, 255, 255, 0.95)"
        ctx!.strokeStyle = "rgba(0, 0, 0, 0.3)"
        ctx!.lineWidth = 1
        ctx!.strokeText(watermarkText, x, y)
        ctx!.fillText(watermarkText, x, y)

        canvas.toBlob(
          (watermarkedBlob) => {
            if (watermarkedBlob) {
              const url = window.URL.createObjectURL(watermarkedBlob)
              setDisplayImageUrl(url)
              setImageLoading(false)
            }
          },
          "image/jpeg",
          0.95,
        )
      }
      img.onerror = () => {
        console.error("Error loading image for watermark:", originalUrl)
        setDisplayImageUrl(originalUrl) // Fallback to original if watermark fails
        setImageLoading(false)
      }
      img.src = URL.createObjectURL(blob)
    } catch (error) {
      console.error("Error generating watermarked image:", error)
      setDisplayImageUrl(originalUrl) // Fallback to original on error
      setImageLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && imageUrl) {
      generateWatermarkedImage(imageUrl, prompt)
    } else {
      // Clean up object URL when modal closes or image changes
      if (displayImageUrl) {
        URL.revokeObjectURL(displayImageUrl)
        setDisplayImageUrl(null)
      }
    }
  }, [isOpen, imageUrl, prompt]) // Re-run when isOpen, imageUrl, or prompt changes

  const handleDownload = async () => {
    if (displayImageUrl) {
      try {
        const response = await fetch(displayImageUrl)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `luna-ai-${prompt.substring(0, 20)}.jpg`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } catch (error) {
        console.error("Download failed:", error)
      }
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center"
      >
        <div className="relative max-w-full max-h-full flex items-center justify-center">
          {imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            </div>
          )}
          {displayImageUrl && (
            <img
              src={displayImageUrl || "/placeholder.svg"}
              alt="Generated"
              className={`max-w-full max-h-full ${imageLoading ? "opacity-0" : "opacity-100"}`}
              onLoad={() => setImageLoading(false)} // This might not be needed if generateWatermarkedImage handles it
              onError={() => {
                console.error("Error displaying watermarked image in modal.")
                setImageLoading(false)
              }}
            />
          )}
          <Button variant="outline" className="absolute top-4 right-4 bg-transparent" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="absolute bottom-4 right-4 bg-transparent" onClick={handleDownload}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
