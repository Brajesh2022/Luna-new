"use client"

import { motion } from "framer-motion"
import { Sparkles } from "lucide-react"

interface TopicSuggestionProps {
  examples: string[]
  onSelect: (topic: string) => void
}

export function TopicSuggestion({ examples, onSelect }: TopicSuggestionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="flex items-center gap-2 mb-4 justify-center">
        <Sparkles size={18} className="text-purple-400" />
        <h3 className="text-xl font-semibold text-white">Try asking</h3>
      </div>
      <div className="suggestions-grid">
        {examples.map((example, idx) => (
          <motion.button
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.1 }}
            onClick={() => onSelect(example)}
            className="suggestion-card text-left"
          >
            <span className="text-white/90 text-sm font-medium">{example}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}
