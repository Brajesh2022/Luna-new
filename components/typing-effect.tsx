"use client"

import { useState, useEffect } from "react"
import ReactMarkdown from "react-markdown"

interface TypingEffectProps {
  text: string
  speed?: number
  onComplete?: () => void
  renderers?: any
}

export default function TypingEffect({ text, speed = 15, onComplete, renderers }: TypingEffectProps) {
  const [displayedText, setDisplayedText] = useState("")
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex])
        setCurrentIndex((prev) => prev + 1)
      }, speed)

      return () => clearTimeout(timer)
    } else if (onComplete) {
      onComplete()
    }
  }, [currentIndex, text, speed, onComplete])

  // Reset when text changes
  useEffect(() => {
    setDisplayedText("")
    setCurrentIndex(0)
  }, [text])

  return (
    <div className="inline">
      <ReactMarkdown components={renderers}>{displayedText}</ReactMarkdown>
      {currentIndex < text.length && <span className="inline-block w-0.5 h-4 bg-purple-400 ml-0.5 animate-pulse" />}
    </div>
  )
}
