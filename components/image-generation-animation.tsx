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

    // Generate particles
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
        className="relative p-6 rounded-2xl bg-gradient-to-br from-purple-900/50 via-blue-900/50 to-indigo-900/50 backdrop-blur-xl border border-white/20 overflow-hidden"
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
          }}
        />

        {/* Floating Particles */}
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
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
              y: [0, -30, -60],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: particle.delay,
              ease: "easeOut",
            }}
          />
        ))}

        {/* Central Animation */}
        <div className="relative z-10 flex flex-col items-center space-y-4">
          {/* Rotating Icon Container */}
          <motion.div
            className="relative"
            animate={{ rotate: 360 }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            {/* Outer Ring */}
            <motion.div
              className="absolute -inset-4 rounded-full border-2 border-white/20"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            {/* Inner Ring */}
            <motion.div
              className="absolute -inset-2 rounded-full border border-white/30"
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5,
              }}
            />

            {/* Icon */}
            <motion.div
              className={`w-12 h-12 rounded-full bg-gradient-to-r ${currentPhaseData.color} flex items-center justify-center shadow-lg`}
              animate={{
                scale: [1, 1.1, 1],
                boxShadow: [
                  "0 0 0 rgba(139, 92, 246, 0)",
                  "0 0 20px rgba(139, 92, 246, 0.5)",
                  "0 0 0 rgba(139, 92, 246, 0)",
                ],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Icon className="w-6 h-6 text-white" />
            </motion.div>
          </motion.div>

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
          <div className="flex space-x-1">
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

          {/* Sparkle Effect */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Zap className="absolute top-2 right-2 w-3 h-3 text-yellow-400" />
            <Sparkles className="absolute bottom-2 left-2 w-3 h-3 text-pink-400" />
            <Stars className="absolute top-1/2 left-1 w-2 h-2 text-blue-400" />
          </motion.div>
        </div>

        {/* Shimmer Effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform skew-x-12"
          animate={{
            x: ['-100%', '100%'],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </motion.div>
    </AnimatePresence>
  )
}

export default ImageGenerationAnimation