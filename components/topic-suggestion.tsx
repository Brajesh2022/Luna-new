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
      className="bg-black/30 backdrop-blur-md rounded-xl p-4 border border-purple-500/30 hover:border-purple-400/50 transition-all duration-300 max-w-2xl mx-auto"
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-purple-400" />
        <h3 className="text-lg font-semibold text-white">Try asking</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {examples.map((example, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(example)}
            className="text-left w-full p-3 rounded-lg text-purple-200 hover:text-white hover:bg-purple-500/20 transition-all duration-200 text-sm"
          >
            {example}
          </button>
        ))}
      </div>
    </motion.div>
  )
}
