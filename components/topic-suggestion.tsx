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
      className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-purple-500/30 transition-all duration-300 shadow-2xl"
    >
      <div className="flex items-center gap-3 mb-6">
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Sparkles size={20} className="text-purple-400" />
        </motion.div>
        <h3 className="text-xl font-bold text-white bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Try asking
        </h3>
      </div>
      <div className="grid gap-3">
        {examples.map((example, idx) => (
          <motion.div key={idx} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <button
              onClick={() => onSelect(example)}
              className="text-left w-full p-4 rounded-xl text-white/80 hover:text-white bg-white/5 hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-pink-500/20 border border-white/10 hover:border-purple-500/30 transition-all duration-300 text-sm backdrop-blur-sm shadow-lg"
            >
              {example}
            </button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
