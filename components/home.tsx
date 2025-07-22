"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Send, ImageIcon, PlusCircle, Copy, X, Check, ArrowDown, Bot, User, Sparkles, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion"
import { TopicSuggestion } from "@/components/topic-suggestion"
import ReactMarkdown from "react-markdown"
import { CodeBlock } from "@/components/code-block"
import { apiRequest } from "@/lib/queryClient"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Message, Conversation } from "@/lib/schema"
import ImageCollage from "@/components/image-collage"
import TypingEffect from "@/components/typing-effect"
import ApiStatus from "@/components/api-status"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"
import { getScrollPosition } from "@/lib/smooth-scroll"
import ImageGenerationAnimation from "@/components/image-generation-animation"

// Enhanced topic suggestions with categories
const TOPIC_SUGGESTIONS = [
  {
    category: "Creative",
    icon: "✨",
    suggestions: [
      "Write a short story about a time traveler",
      "Generate images of a beautiful sunset",
      "Create a poem about artificial intelligence"
    ]
  },
  {
    category: "Productivity", 
    icon: "⚡",
    suggestions: [
      "Help me draft a professional email",
      "Create a study plan for learning JavaScript",
      "How can I improve my presentation skills?"
    ]
  },
  {
    category: "Learning",
    icon: "🧠", 
    suggestions: [
      "Explain quantum computing in simple terms",
      "What are the latest AI developments?",
      "Teach me about blockchain technology"
    ]
  }
]

// Floating particles component
const FloatingParticles = () => {
  const particles = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    scale: Math.random() * 0.5 + 0.5,
    duration: Math.random() * 20 + 10,
    delay: Math.random() * 5
  }))

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute w-1 h-1 bg-purple-400/20 rounded-full"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
          }}
          animate={{
            y: [0, -100, 0],
            opacity: [0, 1, 0],
            scale: [0, particle.scale, 0],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  )
}

export default function Home() {
  // State for messages and UI
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [activeConversation, setActiveConversation] = useState<number | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null)
  const [typingMessageId, setTypingMessageId] = useState<number | null>(null)
  const [localMessages, setLocalMessages] = useState<Message[]>([])
  const [streamingMessage, setStreamingMessage] = useState<string>("")
  const [streamingMessageId, setStreamingMessageId] = useState<number | null>(null)
  const [isCreatingImages, setIsCreatingImages] = useState(false)
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false)

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Motion values for smooth interactions
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const springX = useSpring(mouseX, { stiffness: 300, damping: 30 })
  const springY = useSpring(mouseY, { stiffness: 300, damping: 30 })

  const queryClient = useQueryClient()

  // Query for conversations
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  })

  // Query for messages with more aggressive refetching
  const { data: messages = [], refetch: refetchMessages } = useQuery<Message[]>({
    queryKey: ["/api/conversations", activeConversation, "messages"],
    enabled: !!activeConversation,
    staleTime: 0, // Always consider stale
    gcTime: 0, // Don't cache
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  // Combine server messages with local messages
  const allMessages = [...messages, ...localMessages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  // Mouse tracking for interactive effects
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mouseX.set(e.clientX - rect.left)
    mouseY.set(e.clientY - rect.top)
  }, [mouseX, mouseY])

  // Simplified scroll handling
  const updateScrollPosition = useCallback(() => {
    if (!chatContainerRef.current) return
    
    const container = chatContainerRef.current
    const position = getScrollPosition(container)
    
    setIsUserScrolledUp(!position.isAtBottom)
  }, [])

  // Simple scroll handler without throttling
  const handleScroll = useCallback(() => {
    updateScrollPosition()
  }, [updateScrollPosition])

  // Simple scroll to bottom function
  const scrollToBottom = useCallback((force: boolean = false) => {
    if (!messagesEndRef.current) return
    
    const shouldScroll = force || !isUserScrolledUp
    
    if (shouldScroll) {
      // Use native smooth scrolling instead of custom animation
      messagesEndRef.current.scrollIntoView({ 
        behavior: "smooth", 
        block: "end",
        inline: "nearest"
      })
      
      // Update position after a short delay
      setTimeout(() => {
        updateScrollPosition()
      }, 100)
    }
  }, [isUserScrolledUp, updateScrollPosition])

  // Auto-scroll to bottom when messages change (only if user is at bottom)
  useEffect(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      // Only auto-scroll if user is at bottom to prevent interrupting reading
      if (!isUserScrolledUp) {
        scrollToBottom()
      }
    }, 200)
    
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [allMessages, scrollToBottom, isUserScrolledUp])

  // Auto-scroll to bottom for loading states (less aggressive)
  useEffect(() => {
    if ((isLoading || streamingMessage) && !isUserScrolledUp) {
      scrollToBottom()
    }
  }, [isLoading, streamingMessage, scrollToBottom, isUserScrolledUp])

  // Add scroll event listener
  useEffect(() => {
    const container = chatContainerRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll)
      return () => container.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Set active conversation when conversations load
  useEffect(() => {
    if (conversations.length > 0 && !activeConversation) {
      setActiveConversation(conversations[0].id)
      setShowSuggestions(false)
    }
  }, [conversations, activeConversation])

  // Refetch messages when active conversation changes
  useEffect(() => {
    if (activeConversation) {
      console.log("Active conversation changed, refetching messages for:", activeConversation)
      setLocalMessages([]) // Clear local messages
      setStreamingMessage("") // Clear streaming message
      setStreamingMessageId(null)
      setIsCreatingImages(false)
      refetchMessages()
    }
  }, [activeConversation, refetchMessages])

  // Fix for mobile viewport height issues
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01
      document.documentElement.style.setProperty("--vh", `${vh}px`)
    }

    setVH()
    window.addEventListener("resize", setVH)
    window.addEventListener("orientationchange", setVH)

    return () => {
      window.removeEventListener("resize", setVH)
      window.removeEventListener("orientationchange", setVH)
    }
  }, [])

  // Helper function to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        const result = reader.result as string
        // Remove the data URL prefix to get just the base64 data
        const base64Data = result.split(',')[1]
        resolve(base64Data)
      }
      reader.onerror = error => reject(error)
    })
  }

  // Helper function to detect if response is image generation
  const isImageGenerationContent = (content: string): boolean => {
    try {
      let cleanContent = content
      if (content.includes("```json")) {
        cleanContent = content
          .replace(/```json\s*/g, "")
          .replace(/```\s*/g, "")
          .trim()
      }
      
      const parsed = JSON.parse(cleanContent)
      return parsed.type === "image_generation" && Array.isArray(parsed.prompts)
    } catch {
      return false
    }
  }

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async (title = "New Conversation") => {
      console.log("Creating conversation with title:", title)
      const response = await apiRequest("POST", "/api/conversations", { title })
      const data = await response.json()
      console.log("Conversation created:", data)
      return data
    },
    onSuccess: (conversation) => {
      console.log("Conversation creation success:", conversation)
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] })
      setActiveConversation(conversation.id)
      setShowSuggestions(true)
      setLocalMessages([]) // Clear local messages for new conversation
    },
    onError: (error) => {
      console.error("Conversation creation error:", error)
    },
  })

  // Streaming message mutation
  const sendStreamingMessageMutation = useMutation({
    mutationFn: async ({ content, imageData, imageMimeType }: { content: string; imageData?: string; imageMimeType?: string }) => {
      console.log("Sending streaming message:", content, "to conversation:", activeConversation)
      
      const payload: any = { content }
      if (imageData && imageMimeType) {
        payload.imageData = imageData
        payload.imageMimeType = imageMimeType
      }
      
      try {
        const response = await fetch(`/api/conversations/${activeConversation}/messages/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error("Streaming API error:", response.status, errorText)
          throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`)
        }
        
        return { type: 'stream', response }
      } catch (streamError) {
        console.warn("Streaming failed, falling back to regular API:", streamError)
        
        // Fallback to regular API
        const response = await apiRequest("POST", `/api/conversations/${activeConversation}/messages`, payload)
        const data = await response.json()
        return { type: 'regular', data }
      }
    },
    onSuccess: async (result) => {
      console.log("Message send success, type:", result.type)
      
      if (result.type === 'stream') {
        // Handle streaming response
        const response = result.response
        
        if (!response.body) {
          console.error("No response body")
          throw new Error("No response body")
        }
        
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        
        setStreamingMessage("")
        setStreamingMessageId(Date.now())
        setIsCreatingImages(false)
        
        try {
          let accumulatedContent = ""
          
          while (true) {
            const { done, value } = await reader.read()
            
            if (done) {
              console.log("Streaming complete")
              break
            }
            
            const chunk = decoder.decode(value, { stream: true })
            console.log("Received chunk:", chunk)
            const lines = chunk.split('\n')
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))
                  console.log("Parsed data:", data)
                  
                  if (data.type === 'user_message') {
                    // Add user message to local state
                    console.log("Adding user message:", data.message)
                    setLocalMessages(prev => [...prev, data.message])
                  } else if (data.type === 'stream_chunk') {
                    // Accumulate content to check for image generation
                    accumulatedContent += data.chunk
                    
                                         // Check if this looks like image generation JSON (early detection)
                     if (accumulatedContent.includes('"type"') && accumulatedContent.includes('"image_generation"')) {
                       console.log("Image generation detected, showing creating state")
                       setIsCreatingImages(true)
                       setStreamingMessage("") // Clear any accumulated text
                     } else if (accumulatedContent.includes('{\n  "type": "image_generation"') || accumulatedContent.includes('{"type":"image_generation"')) {
                       // Alternative JSON format detection
                       console.log("Image generation detected (alternative format)")
                       setIsCreatingImages(true)
                       setStreamingMessage("") // Clear any accumulated text
                     } else if (accumulatedContent.includes('"prompts"') && accumulatedContent.includes('[')) {
                       // Detect by prompts array
                       console.log("Image generation detected by prompts")
                       setIsCreatingImages(true)
                       setStreamingMessage("") // Clear any accumulated text
                     } else if (accumulatedContent.trim().startsWith('{') && accumulatedContent.includes('"type"')) {
                       // Any JSON with type field - likely image generation
                       console.log("JSON with type detected - likely image generation")
                       setIsCreatingImages(true)
                       setStreamingMessage("") // Clear any accumulated text
                     } else if (!isCreatingImages) {
                       // Only show typing animation if not creating images
                       setStreamingMessage(prev => prev + data.chunk)
                     }
                  } else if (data.type === 'assistant_message_complete') {
                    // Replace streaming message with final message
                    console.log("Streaming complete, adding final message:", data.message)
                    setStreamingMessage("")
                    setStreamingMessageId(null)
                    setIsCreatingImages(false)
                    setLocalMessages(prev => [...prev, data.message])
                  }
                } catch (e) {
                  console.error('Error parsing streaming data:', e, 'Line:', line)
                }
              }
            }
          }
        } catch (error) {
          console.error('Error reading stream:', error)
        } finally {
          reader.releaseLock()
        }
      } else {
        // Handle regular API response
        const data = result.data
        console.log("Regular API response:", data)
        
        if (data.userMessage && data.assistantMessage) {
          setLocalMessages(prev => [...prev, data.userMessage, data.assistantMessage])
          
          // Check if this is image generation content
          const content = data.assistantMessage.content
          if (isImageGenerationContent(content)) {
            console.log("Image generation detected in regular response")
            setIsCreatingImages(true)
            setStreamingMessageId(Date.now())
                         // Show creating for 3 seconds then complete
             setTimeout(() => {
               setStreamingMessage("")
               setStreamingMessageId(null)
               setIsCreatingImages(false)
             }, 3000)
          } else {
            // Regular typing animation
            setStreamingMessage("")
            setStreamingMessageId(Date.now())
            
            let index = 0
            const typingInterval = setInterval(() => {
              if (index < content.length) {
                setStreamingMessage(prev => prev + content[index])
                index++
              } else {
                clearInterval(typingInterval)
                setStreamingMessage("")
                setStreamingMessageId(null)
              }
            }, 10)
          }
        }
      }
      
      // Refresh messages from server
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", activeConversation, "messages"],
      })
      
      setTimeout(() => {
        refetchMessages()
      }, 500)
      
      setShowSuggestions(false)
    },
    onError: (error) => {
      console.error("Message send error:", error)
      setStreamingMessage("")
      setStreamingMessageId(null)
      setIsCreatingImages(false)
      
      // Show appropriate error message based on error type
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      if (errorMessage.includes("All") && errorMessage.includes("API keys failed")) {
        toast.error("All API keys have failed", {
          description: "Please check your API keys and try again later.",
          duration: 5000,
        })
      } else if (errorMessage.includes("quota") || errorMessage.includes("limit")) {
        toast.warning("API limit reached", {
          description: "Switching to backup API key automatically.",
          duration: 3000,
        })
      } else {
        toast.error("Failed to send message", {
          description: "Please try again in a moment.",
          duration: 3000,
        })
      }
    },
  })

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload an image file")
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size should be less than 5MB")
        return
      }

      setSelectedImage(file)

      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const copyMessage = (content: string, id: number) => {
    navigator.clipboard.writeText(content)
    setCopiedMessageId(id)
    setTimeout(() => setCopiedMessageId(null), 2000)
    toast.success("Message copied!")
  }

  // Custom renderer for code blocks
  const renderers = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || "")
      const language = match ? match[1] : "text"

      if (!inline && match) {
        return <CodeBlock language={language} value={String(children).replace(/\n$/, "")} />
      }

      return (
        <code className={className} {...props}>
          {children}
        </code>
      )
    },
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim() && !selectedImage) return

    console.log("Form submitted with input:", input)

    // Create conversation if none exists
    if (!activeConversation) {
      console.log("No active conversation, creating new one")
      const newConversation = await createConversationMutation.mutateAsync("New Conversation")
      setActiveConversation(newConversation.id)
      // Wait a bit for the conversation to be set
      setTimeout(() => {
        handleStreamingSubmit()
      }, 100)
      return
    }

    await handleStreamingSubmit()
  }

  const handleStreamingSubmit = async () => {
    setIsLoading(true)
    setIsCreatingImages(false)
    const content = input
    const imageFile = selectedImage
    setInput("")
    removeImage()

    // Blur input to hide keyboard
    inputRef.current?.blur()

    try {
      let imageData: string | undefined
      let imageMimeType: string | undefined
      
      if (imageFile) {
        imageData = await fileToBase64(imageFile)
        imageMimeType = imageFile.type
      }

      console.log("Sending streaming message mutation...")
      await sendStreamingMessageMutation.mutateAsync({ content, imageData, imageMimeType })
      console.log("Streaming message sent successfully")
    } catch (error) {
      console.error("Error sending streaming message:", error)
      
      // Show appropriate error message based on error type
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      if (errorMessage.includes("All") && errorMessage.includes("API keys failed")) {
        toast.error("All API keys have failed", {
          description: "Please check your API keys and try again later.",
          duration: 5000,
        })
      } else if (errorMessage.includes("quota") || errorMessage.includes("limit")) {
        toast.warning("API limit reached", {
          description: "Switching to backup API key automatically.",
          duration: 3000,
        })
      } else {
        toast.error("Failed to send message", {
          description: "Please try again in a moment.",
          duration: 3000,
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleNewConversation = () => {
    console.log("Creating new conversation")
    createConversationMutation.mutate("New Conversation")
  }

  const handleTopicSelect = (topic: string) => {
    setInput(topic)
    inputRef.current?.focus()
    setShowSuggestions(false)
  }

  const getImagePrompts = (content: string) => {
    try {
      let cleanContent = content
      if (content.includes("```json")) {
        cleanContent = content
          .replace(/```json\s*/g, "")
          .replace(/```\s*/g, "")
          .trim()
      }

      const parsed = JSON.parse(cleanContent)
      return parsed.prompts || []
    } catch {
      return []
    }
  }

  return (
    <div 
      className="h-screen flex flex-col bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 mobile-safe relative overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* Floating particles background */}
      <FloatingParticles />
      
      {/* Dynamic background gradients */}
      <motion.div
        className="absolute inset-0 opacity-30"
        animate={{
          background: [
            "radial-gradient(circle at 20% 80%, rgba(147, 51, 234, 0.3) 0%, transparent 50%)",
            "radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.3) 0%, transparent 50%)",
            "radial-gradient(circle at 40% 40%, rgba(236, 72, 153, 0.3) 0%, transparent 50%)",
            "radial-gradient(circle at 20% 80%, rgba(147, 51, 234, 0.3) 0%, transparent 50%)",
          ],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "linear",
        }}
      />
      {/* Header */}
      <motion.header 
        className="mobile-header bg-slate-950/80 backdrop-blur-2xl border-b border-purple-500/20 px-6 py-4 relative z-10"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="flex items-center justify-between">
          <motion.div 
            className="flex items-center space-x-4"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <div className="relative">
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full blur-lg opacity-30"
                animate={{ rotate: 360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              />
              <Avatar className="w-12 h-12 relative border-2 border-purple-400/50 bg-gradient-to-br from-purple-900 to-blue-900">
                <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
                <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white">
                  <Sparkles className="w-6 h-6" />
                </AvatarFallback>
              </Avatar>
            </div>
            <div>
              <motion.h1 
                className="text-white font-bold text-xl bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                Luna
              </motion.h1>
              <motion.p 
                className="text-white/60 text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                AI Assistant by Brajesh
              </motion.p>
            </div>
          </motion.div>
          
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              onClick={handleNewConversation}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0 shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
              size="sm"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              New Chat
            </Button>
          </motion.div>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col mobile-content relative z-10">
        {/* Messages */}
        <div 
          ref={chatContainerRef} 
          className="flex-1 overflow-y-auto px-6 py-8 space-y-8 scrollbar-thin" 
          style={{ paddingBottom: '80px' }}
        >
          <AnimatePresence mode="popLayout">
            {allMessages.length === 0 && showSuggestions && !streamingMessage ? (
              <motion.div 
                key="welcome"
                className="flex flex-col items-center justify-center h-full space-y-12"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
              >
                <motion.div 
                  className="text-center"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="relative mb-8">
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-purple-500/30 to-blue-500/30 rounded-full blur-3xl"
                      animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.6, 0.3] 
                      }}
                      transition={{ duration: 4, repeat: Infinity }}
                    />
                    <Avatar className="w-24 h-24 mx-auto relative border-4 border-purple-400/30 bg-gradient-to-br from-purple-900 to-blue-900">
                      <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
                      <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white">
                        <Sparkles className="w-12 h-12" />
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <motion.h2 
                    className="text-4xl font-bold text-white mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    Welcome to Luna
                  </motion.h2>
                  <motion.p 
                    className="text-white/70 text-lg mb-12 max-w-md mx-auto"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                  >
                    Your intelligent AI assistant created by Brajesh. Ready to help you create, learn, and explore!
                  </motion.p>
                </motion.div>

                <motion.div
                  className="w-full max-w-4xl"
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  <TopicSuggestion examples={TOPIC_SUGGESTIONS.flatMap(cat => cat.suggestions)} onSelect={handleTopicSelect} />
                </motion.div>
              </motion.div>
                      ) : (
              <>
                {allMessages.map((message) => (
                  <motion.div
                    key={message.id}
                    layout
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ 
                      type: "spring",
                      stiffness: 500,
                      damping: 30,
                      mass: 1
                    }}
                    className={cn(
                      "flex gap-4 message relative group",
                      message.role === "user" ? "justify-end ml-12" : "justify-start mr-12",
                    )}
                  >
                    {message.role === "assistant" && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                        className="relative"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full blur-lg" />
                        <Avatar className="w-10 h-10 relative border-2 border-purple-400/30 bg-gradient-to-br from-purple-900/50 to-blue-900/50">
                          <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
                          <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white">
                            <Bot className="w-5 h-5" />
                          </AvatarFallback>
                        </Avatar>
                        <motion.div
                          className="absolute -inset-1 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full opacity-20"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        />
                      </motion.div>
                    )}

                    <motion.div
                      layout
                      className={cn(
                        "message-container relative overflow-hidden",
                        message.role === "user" 
                          ? "bg-gradient-to-br from-purple-600/90 to-pink-600/90 backdrop-blur-xl border border-purple-400/30 text-white max-w-[80%]" 
                          : "bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border border-slate-600/30 text-white max-w-[85%]",
                        "rounded-3xl p-6 shadow-2xl"
                      )}
                      whileHover={{ 
                        scale: 1.02,
                        boxShadow: message.role === "user" 
                          ? "0 20px 40px rgba(147, 51, 234, 0.3)" 
                          : "0 20px 40px rgba(0, 0, 0, 0.4)"
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    >
                      {/* Animated background gradient */}
                      <motion.div
                        className={cn(
                          "absolute inset-0 opacity-10 rounded-3xl",
                          message.role === "user" 
                            ? "bg-gradient-to-br from-purple-300 via-pink-300 to-purple-300"
                            : "bg-gradient-to-br from-blue-300 via-purple-300 to-blue-300"
                        )}
                        animate={{
                          background: message.role === "user" ? [
                            "linear-gradient(45deg, #a855f7, #ec4899, #a855f7)",
                            "linear-gradient(135deg, #ec4899, #f59e0b, #ec4899)",
                            "linear-gradient(225deg, #f59e0b, #a855f7, #f59e0b)",
                            "linear-gradient(315deg, #a855f7, #ec4899, #a855f7)"
                          ] : [
                            "linear-gradient(45deg, #3b82f6, #8b5cf6, #3b82f6)",
                            "linear-gradient(135deg, #8b5cf6, #06b6d4, #8b5cf6)",
                            "linear-gradient(225deg, #06b6d4, #3b82f6, #06b6d4)",
                            "linear-gradient(315deg, #3b82f6, #8b5cf6, #3b82f6)"
                          ]
                        }}
                        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                      />

                      {/* Content */}
                      <div className="relative z-10">
                        {message.role === "user" && message.imageData && (
                          <motion.div 
                            className="mb-4"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 }}
                          >
                            <img
                              src={`data:${message.imageMimeType};base64,${message.imageData}`}
                              alt="Uploaded image"
                              className="max-w-xs max-h-48 object-contain rounded-2xl border-2 border-white/30 shadow-lg"
                            />
                          </motion.div>
                        )}
                        
                        {message.role === "assistant" && isImageGenerationContent(message.content) ? (
                          <ImageCollage prompts={getImagePrompts(message.content)} messageId={message.id} />
                        ) : (
                          <div className="markdown-content prose prose-invert max-w-none">
                            <ReactMarkdown components={renderers}>{message.content}</ReactMarkdown>
                          </div>
                        )}
                      </div>

                      {/* Copy button */}
                      <motion.button
                        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg p-2 transition-all duration-200"
                        onClick={() => copyMessage(message.content, message.id)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        {copiedMessageId === message.id ? 
                          <Check className="w-4 h-4 text-green-400" /> : 
                          <Copy className="w-4 h-4 text-white/70" />
                        }
                      </motion.button>
                    </motion.div>

                    {message.role === "user" && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                        className="relative"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-full blur-lg" />
                        <Avatar className="w-10 h-10 relative border-2 border-pink-400/30 bg-gradient-to-br from-pink-900/50 to-purple-900/50">
                          <AvatarImage src="/images/user-avatar.jpg" alt="User" />
                          <AvatarFallback className="bg-gradient-to-br from-pink-600 to-purple-600 text-white">
                            <User className="w-5 h-5" />
                          </AvatarFallback>
                        </Avatar>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
                
                {/* Streaming message */}
                {streamingMessageId && (streamingMessage || isCreatingImages) && (
                  <motion.div
                    key="streaming"
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    className="flex gap-4 justify-start mr-12"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                      className="relative"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full blur-lg" />
                      <Avatar className="w-10 h-10 relative border-2 border-purple-400/30 bg-gradient-to-br from-purple-900/50 to-blue-900/50">
                        <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
                        <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white">
                          <Bot className="w-5 h-5" />
                        </AvatarFallback>
                      </Avatar>
                      <motion.div
                        className="absolute -inset-1 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full opacity-20"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      />
                    </motion.div>
                    <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border border-slate-600/30 rounded-3xl p-6 shadow-2xl max-w-[85%] relative overflow-hidden">
                      <motion.div
                        className="absolute inset-0 opacity-10 rounded-3xl bg-gradient-to-br from-blue-300 via-purple-300 to-blue-300"
                        animate={{
                          background: [
                            "linear-gradient(45deg, #3b82f6, #8b5cf6, #3b82f6)",
                            "linear-gradient(135deg, #8b5cf6, #06b6d4, #8b5cf6)",
                            "linear-gradient(225deg, #06b6d4, #3b82f6, #06b6d4)",
                            "linear-gradient(315deg, #3b82f6, #8b5cf6, #3b82f6)"
                          ]
                        }}
                        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                      />
                      {isCreatingImages ? (
                        <ImageGenerationAnimation isVisible={isCreatingImages} />
                      ) : (
                        <div className="relative z-10 markdown-content prose prose-invert max-w-none">
                          <ReactMarkdown components={renderers}>{streamingMessage}</ReactMarkdown>
                          <motion.span
                            className="inline-block w-0.5 h-5 bg-purple-400 ml-1"
                            animate={{ opacity: [1, 0, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </AnimatePresence>

          {(isLoading || sendStreamingMessageMutation.isPending) && !streamingMessage && !isCreatingImages && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex gap-4 justify-start mr-12"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full blur-lg" />
                <Avatar className="w-10 h-10 relative border-2 border-purple-400/30 bg-gradient-to-br from-purple-900/50 to-blue-900/50">
                  <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
                  <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white">
                    <Bot className="w-5 h-5" />
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border border-slate-600/30 rounded-3xl p-6 shadow-2xl">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="w-5 h-5 text-purple-400" />
                  </motion.div>
                  <span className="text-white/80">Luna is thinking...</span>
                  <motion.div
                    className="flex space-x-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1 h-1 bg-purple-400 rounded-full"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: i * 0.2,
                        }}
                      />
                    ))}
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to Bottom Button */}
        <AnimatePresence>
          {isUserScrolledUp && (
            <motion.div 
              className="fixed bottom-32 right-8 z-40"
              initial={{ opacity: 0, scale: 0, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <motion.button
                onClick={() => {
                  setIsUserScrolledUp(false)
                  scrollToBottom(true)
                }}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-full p-4 shadow-2xl border border-purple-400/30 backdrop-blur-xl"
                whileHover={{ 
                  scale: 1.1,
                  boxShadow: "0 20px 40px rgba(147, 51, 234, 0.4)"
                }}
                whileTap={{ scale: 0.95 }}
              >
                <ArrowDown className="w-5 h-5" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Area */}
        <motion.div 
          className="mobile-input bg-slate-950/80 backdrop-blur-2xl border-t border-purple-500/20 p-6 relative z-10"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.2 }}
        >
          <AnimatePresence>
            {imagePreview && (
              <motion.div 
                className="mb-4 relative inline-block"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <img
                  src={imagePreview}
                  alt="Upload preview"
                  className="w-20 h-20 object-cover rounded-2xl border-2 border-purple-400/50 shadow-lg"
                />
                <motion.button
                  className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg"
                  onClick={removeImage}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-4 h-4 text-white" />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="flex gap-4">
            <div className="flex-1 relative">
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-2xl blur-xl"
                animate={{ opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  const textarea = e.target as HTMLTextAreaElement
                  textarea.style.height = "auto"
                  textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px"
                }}
                placeholder="Type your message..."
                className="w-full min-h-[60px] max-h-32 bg-slate-900/50 backdrop-blur-xl border border-purple-500/30 rounded-2xl px-6 py-4 text-white placeholder-white/50 resize-none focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400/50 transition-all duration-300 relative z-10"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
                onFocus={() => {
                  if (!isUserScrolledUp) {
                    setTimeout(() => scrollToBottom(), 300)
                  }
                }}
                onBlur={() => {
                  if (!isUserScrolledUp) {
                    setTimeout(() => scrollToBottom(), 100)
                  }
                }}
                rows={1}
                style={{
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  minHeight: "60px",
                  lineHeight: "1.5",
                }}
              />
              <motion.button
                type="button"
                className="absolute right-3 top-3 text-white/60 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all duration-200"
                onClick={() => fileInputRef.current?.click()}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <ImageIcon className="w-5 h-5" />
              </motion.button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </div>

            <motion.button
              type="submit"
              disabled={isLoading || sendStreamingMessageMutation.isPending || (!input.trim() && !selectedImage)}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-2xl px-8 py-4 h-[60px] disabled:opacity-50 disabled:cursor-not-allowed shadow-xl border border-purple-400/30 backdrop-blur-xl transition-all duration-300"
              whileHover={{ 
                scale: 1.05,
                boxShadow: "0 20px 40px rgba(147, 51, 234, 0.3)"
              }}
              whileTap={{ scale: 0.95 }}
            >
              {isLoading || sendStreamingMessageMutation.isPending ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="w-6 h-6" />
                </motion.div>
              ) : (
                <Send className="w-6 h-6" />
              )}
            </motion.button>
          </form>
        </motion.div>
      </div>
      
      {/* API Status Monitor */}
      <ApiStatus />
      
      {/* Toast Notifications */}
      <Toaster />
    </div>
  )
}
