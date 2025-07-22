"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Zap, Brain, Palette } from "lucide-react"

interface TopicSuggestionProps {
  examples: string[]
  onSelect: (topic: string) => void
}

export function TopicSuggestion({ examples, onSelect }: TopicSuggestionProps) {
  const categories = [
    {
      name: "Creative",
      icon: Palette,
      color: "from-pink-500 to-purple-500",
      items: examples.slice(0, 3)
    },
    {
      name: "Productivity", 
      icon: Zap,
      color: "from-orange-500 to-red-500",
      items: examples.slice(3, 6)
    },
    {
      name: "Learning",
      icon: Brain,
      color: "from-blue-500 to-cyan-500",
      items: examples.slice(6, 9)
    }
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full max-w-6xl mx-auto"
    >
      <motion.div 
        className="text-center mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className="w-6 h-6 text-purple-400" />
          </motion.div>
          <h3 className="text-2xl font-bold text-white">What would you like to explore?</h3>
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className="w-6 h-6 text-blue-400" />
          </motion.div>
        </div>
        <p className="text-white/60 text-lg">Choose a topic to get started, or ask me anything</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {categories.map((category, categoryIndex) => {
          const IconComponent = category.icon
          return (
            <motion.div
              key={category.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + categoryIndex * 0.1 }}
              className="relative group"
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-br opacity-20 rounded-2xl blur-xl group-hover:opacity-30 transition-opacity duration-300"
                style={{
                  background: `linear-gradient(135deg, ${category.color.split(' ')[1]}, ${category.color.split(' ')[3]})`
                }}
              />
              <div className="relative bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300 h-full">
                <div className="flex items-center gap-3 mb-4">
                  <motion.div
                    className={`p-3 rounded-xl bg-gradient-to-r ${category.color} shadow-lg`}
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    <IconComponent className="w-5 h-5 text-white" />
                  </motion.div>
                  <h4 className="text-xl font-semibold text-white">{category.name}</h4>
                </div>
                
                <div className="space-y-2">
                  {category.items.map((item, itemIndex) => (
                    <motion.button
                      key={itemIndex}
                      onClick={() => onSelect(item)}
                      className="w-full text-left p-3 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200 text-sm group relative overflow-hidden"
                      whileHover={{ 
                        scale: 1.02,
                        x: 5
                      }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 400 }}
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-10 transition-opacity duration-300"
                        style={{
                          background: `linear-gradient(90deg, ${category.color.split(' ')[1]}, ${category.color.split(' ')[3]})`
                        }}
                      />
                      <span className="relative z-10">{item}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      <motion.div
        className="text-center mt-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <p className="text-white/40 text-sm">
          💡 You can also upload images, ask questions, or request creative content
        </p>
      </motion.div>
    </motion.div>
  )
}
