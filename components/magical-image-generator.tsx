"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Stars, Wand2, Image as ImageIcon, Palette, Zap } from "lucide-react"

interface MagicalImageGeneratorProps {
  isVisible: boolean
}

export default function MagicalImageGenerator({ isVisible }: MagicalImageGeneratorProps) {
  const [currentPhase, setCurrentPhase] = useState(0)
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([])

  // Animation phases
  const phases = [
    { text: "Conjuring magic...", icon: Wand2, color: "from-purple-500 to-pink-500" },
    { text: "Mixing colors...", icon: Palette, color: "from-blue-500 to-purple-500" },
    { text: "Shaping dreams...", icon: Stars, color: "from-pink-500 to-yellow-500" },
    { text: "Creating images...", icon: ImageIcon, color: "from-green-500 to-blue-500" },
    { text: "Adding magic...", icon: Sparkles, color: "from-purple-500 to-pink-500" },
    { text: "Almost ready...", icon: Zap, color: "from-orange-500 to-red-500" },
  ]

  // Generate random particles
  useEffect(() => {
    if (isVisible) {
      const newParticles = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 2,
      }))
      setParticles(newParticles)
    }
  }, [isVisible])

  // Cycle through phases
  useEffect(() => {
    if (isVisible) {
      const interval = setInterval(() => {
        setCurrentPhase(prev => (prev + 1) % phases.length)
      }, 800)
      return () => clearInterval(interval)
    }
  }, [isVisible, phases.length])

  if (!isVisible) return null

  const currentPhaseData = phases[currentPhase]
  const IconComponent = currentPhaseData.icon

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Animated gradient background */}
      <motion.div
        className={`absolute inset-0 bg-gradient-to-br ${currentPhaseData.color} opacity-20`}
        animate={{
          backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "linear",
        }}
      />
      
      {/* Animated mesh background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-blue-500/10">
        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] bg-[length:20px_20px] animate-pulse" />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        <AnimatePresence>
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute w-2 h-2 bg-white rounded-full"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: [0, 1, 0], 
                opacity: [0, 1, 0],
                y: [0, -20, -40],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: particle.delay,
                ease: "easeInOut",
              }}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Main content */}
      <div className="relative z-10 p-6 flex flex-col items-center justify-center min-h-[120px]">
        {/* Rotating icon with glow effect */}
        <motion.div
          className="relative mb-4"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <div className={`absolute inset-0 bg-gradient-to-r ${currentPhaseData.color} rounded-full blur-xl opacity-60`} />
          <motion.div
            className="relative bg-white/20 backdrop-blur-sm rounded-full p-4 border border-white/30"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
          >
            <IconComponent className="w-8 h-8 text-white" />
          </motion.div>
        </motion.div>

        {/* Phase text with typewriter effect */}
        <motion.div
          key={currentPhase}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="text-center"
        >
          <motion.h3
            className="text-lg font-semibold text-white mb-2"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
          >
            {currentPhaseData.text}
          </motion.h3>
          
          {/* Animated dots */}
          <div className="flex justify-center space-x-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-white rounded-full"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        </motion.div>

        {/* Progress bar */}
        <div className="w-full max-w-xs mt-6">
          <div className="bg-white/20 rounded-full h-2 overflow-hidden">
            <motion.div
              className={`h-full bg-gradient-to-r ${currentPhaseData.color} rounded-full`}
              initial={{ width: "0%" }}
              animate={{ width: `${((currentPhase + 1) / phases.length) * 100}%` }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            />
          </div>
        </div>

        {/* Sparkle effects */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{
                left: `${20 + (i * 10)}%`,
                top: `${20 + (i * 8)}%`,
              }}
              animate={{
                scale: [0, 1, 0],
                rotate: [0, 180, 360],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut",
              }}
            >
              <Sparkles className="w-4 h-4 text-yellow-300" />
            </motion.div>
          ))}
        </div>

        {/* Magical ring effect */}
        <motion.div
          className="absolute inset-0 rounded-2xl border-2 border-white/30"
          animate={{
            scale: [1, 1.02, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Outer glow ring */}
        <motion.div
          className="absolute inset-0 rounded-2xl"
          style={{
            background: `linear-gradient(45deg, ${currentPhaseData.color.replace('from-', '').replace('to-', ', ')})`,
            filter: 'blur(20px)',
            opacity: 0.3,
          }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>
    </div>
  )
}