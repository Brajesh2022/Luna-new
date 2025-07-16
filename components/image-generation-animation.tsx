import React, { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Palette, Sparkles, Wand2, Stars, Zap, Brush } from "lucide-react"

interface ImageGenerationAnimationProps {
  isVisible: boolean
}

const ImageGenerationAnimation: React.FC<ImageGenerationAnimationProps> = ({ isVisible }) => {
  const [currentPhase, setCurrentPhase] = useState(0)
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([])

  const phases = [
    { icon: Sparkles, text: "Igniting creativity...", color: "from-purple-400 to-pink-400" },
    { icon: Palette, text: "Mixing colors...", color: "from-blue-400 to-purple-400" },
    { icon: Brush, text: "Painting masterpiece...", color: "from-green-400 to-blue-400" },
    { icon: Wand2, text: "Adding magic...", color: "from-yellow-400 to-orange-400" },
    { icon: Stars, text: "Finalizing creation...", color: "from-pink-400 to-purple-400" },
  ]

  useEffect(() => {
    if (!isVisible) return

    // Generate particles (5 per grid item)
    const newParticles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 2,
    }))
    setParticles(newParticles)

    // Cycle through phases
    const interval = setInterval(() => {
      setCurrentPhase((prev) => (prev + 1) % phases.length)
    }, 1500)

    return () => clearInterval(interval)
  }, [isVisible, phases.length])

  if (!isVisible) return null

  const currentPhaseData = phases[currentPhase]
  const Icon = currentPhaseData.icon

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className="relative space-y-3 w-full image-generation-container"
      >
        {/* Header to match image collage */}
        <div className="text-white/70 text-sm mb-3">Creating 4 image variations for you:</div>

        {/* Main animation container matching image collage grid */}
        <div className="grid grid-cols-2 gap-3 w-full">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="relative aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-purple-900/20 to-purple-700/20 border border-purple-500/20"
            >
              {/* Animated Background Gradient */}
              <motion.div
                className="absolute inset-0 opacity-30"
                animate={{
                  background: [
                    "radial-gradient(circle at 20% 50%, #8b5cf6 0%, transparent 50%)",
                    "radial-gradient(circle at 80% 50%, #06b6d4 0%, transparent 50%)",
                    "radial-gradient(circle at 50% 20%, #f59e0b 0%, transparent 50%)",
                    "radial-gradient(circle at 50% 80%, #ec4899 0%, transparent 50%)",
                    "radial-gradient(circle at 20% 50%, #8b5cf6 0%, transparent 50%)",
                  ],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "linear",
                  delay: index * 0.5,
                }}
              />

              {/* Floating Particles */}
              {particles.slice(index * 5, (index + 1) * 5).map((particle, particleIndex) => (
                <motion.div
                  key={`${index}-${particleIndex}`}
                  className="absolute w-1 h-1 bg-white/40 rounded-full"
                  initial={{ 
                    left: `${particle.x}%`, 
                    top: `${particle.y}%`,
                    opacity: 0,
                    scale: 0 
                  }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0],
                    y: [0, -20, -40],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: particle.delay + index * 0.2,
                    ease: "easeOut",
                  }}
                />
              ))}

              {/* Central Animation for each card */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {/* Rotating Icon Container */}
                <motion.div
                  className="relative mb-2"
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear",
                    delay: index * 0.3,
                  }}
                >
                  {/* Outer Ring */}
                  <motion.div
                    className="absolute -inset-2 rounded-full border border-white/20"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 0.8, 0.5],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: index * 0.2,
                    }}
                  />

                  {/* Icon */}
                  <motion.div
                    className={`w-8 h-8 rounded-full bg-gradient-to-r ${currentPhaseData.color} flex items-center justify-center shadow-lg`}
                    animate={{
                      scale: [1, 1.1, 1],
                      boxShadow: [
                        "0 0 0 rgba(139, 92, 246, 0)",
                        "0 0 15px rgba(139, 92, 246, 0.5)",
                        "0 0 0 rgba(139, 92, 246, 0)",
                      ],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: index * 0.1,
                    }}
                  >
                    <Icon className="w-4 h-4 text-white" />
                  </motion.div>
                </motion.div>

                {/* Generating text */}
                <p className="text-white/60 text-xs text-center">Generating...</p>
              </div>

              {/* Shimmer Effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform skew-x-12"
                animate={{
                  x: ['-100%', '100%'],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "linear",
                  delay: index * 0.5,
                }}
              />
            </div>
          ))}
        </div>

        {/* Phase Text */}
        <motion.div
          key={currentPhase}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <p className="text-white/90 font-medium text-sm">{currentPhaseData.text}</p>
        </motion.div>

        {/* Progress Dots */}
        <div className="flex justify-center space-x-1">
          {phases.map((_, index) => (
            <motion.div
              key={index}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                index === currentPhase ? 'bg-white' : 'bg-white/30'
              }`}
              animate={{
                scale: index === currentPhase ? [1, 1.2, 1] : 1,
              }}
              transition={{
                duration: 0.5,
                repeat: index === currentPhase ? Infinity : 0,
              }}
            />
          ))}
        </div>

        {/* Footer to match image collage */}
        <div className="text-white/50 text-xs mt-2">
          AI is crafting your images with creativity and precision...
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

export default ImageGenerationAnimation