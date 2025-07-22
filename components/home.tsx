"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Send, ImageIcon, PlusCircle, Copy, X, Check, ArrowDown, Brain, Zap, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { motion, AnimatePresence } from "framer-motion"
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

// Simplified topic suggestions
const TOPIC_SUGGESTIONS = [
  "Write a short story about a time traveler",
  "Help me draft a professional email",
  "Explain quantum computing in simple terms",
  "Create a study plan for learning JavaScript",
  "Generate images of a beautiful sunset",
  "How can I improve my presentation skills?",
]

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

  // Document scroll handling
  const updateScrollPosition = useCallback(() => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const scrollHeight = document.documentElement.scrollHeight
    const clientHeight = window.innerHeight
    const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 100
    
    setIsUserScrolledUp(!scrolledToBottom)
  }, [])

  // Optimized scroll handler with RAF
  const handleScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      cancelAnimationFrame(scrollTimeoutRef.current)
    }
    
    scrollTimeoutRef.current = requestAnimationFrame(() => {
      updateScrollPosition()
    })
  }, [updateScrollPosition])

  // Smooth scroll to bottom function
  const scrollToBottom = useCallback((force: boolean = false) => {
    const shouldScroll = force || !isUserScrolledUp
    
    if (shouldScroll) {
      window.scrollTo({ 
        top: document.documentElement.scrollHeight, 
        behavior: "smooth" 
      })
      
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
    }, 100)
    
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

  // Add scroll event listener for window
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

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
        alert("Please upload an image file")
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        alert("Image size should be less than 5MB")
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
    console.log("Topic selected:", topic)
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

  console.log("Render - Server messages count:", messages.length)
  console.log("Render - Local messages count:", localMessages.length)
  console.log("Render - All messages count:", allMessages.length)
  console.log("Render - Active conversation:", activeConversation)
  console.log("Render - Show suggestions:", showSuggestions)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Enhanced Background with Aurora Effect */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(236,72,153,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_30%,rgba(139,92,246,0.02)_50%,transparent_70%)] animate-pulse" />
      </div>

      {/* Floating Particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-gradient-to-r from-purple-400/20 to-blue-400/20"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 4 + 2}px`,
              height: `${Math.random() * 4 + 2}px`,
            }}
            animate={{
              y: [0, -100, 0],
              opacity: [0, 0.6, 0],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 15,
              delay: Math.random() * 10,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Enhanced Header - Now sticky */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="sticky top-0 z-50 bg-black/20 backdrop-blur-xl border-b border-white/10 px-6 py-4"
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <motion.div
              whileHover={{ scale: 1.05, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <Avatar className="w-12 h-12 ring-2 ring-purple-500/30 ring-offset-2 ring-offset-transparent">
                <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold">L</AvatarFallback>
              </Avatar>
            </motion.div>
            <div>
              <h1 className="text-white font-bold text-xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Luna
              </h1>
              <p className="text-white/60 text-sm flex items-center gap-1">
                <Brain className="w-3 h-3" />
                AI Assistant by Brajesh
              </p>
            </div>
          </div>
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              onClick={handleNewConversation}
              variant="ghost"
              size="sm"
              className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 text-white/90 hover:text-white transition-all duration-300 backdrop-blur-sm"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              New Chat
            </Button>
          </motion.div>
        </div>
      </motion.header>

      {/* Main Content - Now properly scrollable */}
      <div className="container mx-auto px-4 pb-4">
        {/* Messages */}
        <div 
          ref={chatContainerRef} 
          className="py-8 space-y-8"
        >
          {allMessages.length === 0 && showSuggestions && !streamingMessage ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex flex-col items-center justify-center h-full space-y-12 max-w-4xl mx-auto"
            >
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="text-center"
              >
                <motion.div
                  animate={{ 
                    rotate: [0, 5, -5, 0],
                    scale: [1, 1.02, 1]
                  }}
                  transition={{ 
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <Avatar className="w-24 h-24 mx-auto mb-6 ring-4 ring-purple-500/20 ring-offset-4 ring-offset-transparent shadow-2xl">
                    <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold text-2xl">L</AvatarFallback>
                  </Avatar>
                </motion.div>
                <motion.h2 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-4xl font-bold text-white mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent"
                >
                  Welcome to Luna
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="text-white/70 text-lg mb-12 leading-relaxed max-w-2xl mx-auto"
                >
                  Your intelligent AI assistant created by Brajesh. I can help you with writing, coding, 
                  image generation, and much more. How can I assist you today?
                </motion.p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="w-full max-w-2xl"
              >
                <TopicSuggestion examples={TOPIC_SUGGESTIONS} onSelect={handleTopicSelect} />
              </motion.div>
            </motion.div>
          ) : (
            <div className="max-w-4xl mx-auto w-full space-y-8">
              <AnimatePresence mode="popLayout">
                {allMessages.map((message, index) => {
                  console.log("Rendering message:", message.id, message.role, message.content.substring(0, 50))
                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.95 }}
                      transition={{ 
                        duration: 0.5,
                        delay: index * 0.1,
                        ease: "easeOut"
                      }}
                      className={cn(
                        "flex gap-6 message relative group",
                        message.role === "user" ? "justify-end" : "justify-start",
                      )}
                    >
                      {message.role === "assistant" && (
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        >
                          <Avatar className="w-10 h-10 flex-shrink-0 ring-2 ring-purple-500/20 shadow-lg">
                            <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
                            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold">L</AvatarFallback>
                          </Avatar>
                        </motion.div>
                      )}

                      <motion.div
                        whileHover={{ y: -2 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        className={cn(
                          "message-container relative group",
                          message.role === "user" 
                            ? "p-6 rounded-2xl backdrop-blur-xl shadow-2xl max-w-[80%] bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-white" 
                            : "flex-1 text-white"
                        )}
                      >
                        {message.role === "user" && message.imageData && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="mb-4"
                          >
                            <img
                              src={`data:${message.imageMimeType};base64,${message.imageData}`}
                              alt="Uploaded image"
                              className="max-w-xs max-h-48 object-contain rounded-xl border-2 border-white/20 shadow-lg"
                            />
                          </motion.div>
                        )}
                        
                        {message.role === "assistant" && isImageGenerationContent(message.content) ? (
                          <ImageCollage prompts={getImagePrompts(message.content)} messageId={message.id} />
                        ) : (
                          <div className="markdown-enhanced">
                            <ReactMarkdown components={renderers}>{message.content}</ReactMarkdown>
                          </div>
                        )}

                        {message.role === "user" && (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-200 p-2 rounded-lg bg-black/20 hover:bg-black/40 backdrop-blur-sm"
                            onClick={() => copyMessage(message.content, message.id)}
                          >
                            {copiedMessageId === message.id ? 
                              <Check className="w-4 h-4 text-green-400" /> : 
                              <Copy className="w-4 h-4 text-white/70" />
                            }
                          </motion.button>
                        )}

                        {message.role === "assistant" && (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="ml-4 mt-2 opacity-70 hover:opacity-100 transition-all duration-200 p-2 rounded-lg bg-white/5 hover:bg-white/10 backdrop-blur-sm"
                            onClick={() => copyMessage(message.content, message.id)}
                          >
                            {copiedMessageId === message.id ? 
                              <Check className="w-4 h-4 text-green-400" /> : 
                              <Copy className="w-4 h-4 text-white/70" />
                            }
                          </motion.button>
                        )}
                      </motion.div>

                      {message.role === "user" && (
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        >
                          <Avatar className="w-10 h-10 flex-shrink-0 ring-2 ring-blue-500/20 shadow-lg">
                            <AvatarImage src="/images/user-avatar.jpg" alt="User" />
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-bold">U</AvatarFallback>
                          </Avatar>
                        </motion.div>
                      )}
                    </motion.div>
                )
                })}
                
                {/* Streaming message */}
                {streamingMessageId && (streamingMessage || isCreatingImages) && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="flex gap-6 justify-start"
                  >
                    <Avatar className="w-10 h-10 flex-shrink-0 ring-2 ring-purple-500/20 shadow-lg">
                      <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold">L</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-white">
                      {isCreatingImages ? (
                        <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl shadow-2xl">
                          <ImageGenerationAnimation isVisible={isCreatingImages} />
                        </div>
                      ) : (
                        <div className="markdown-enhanced">
                          <ReactMarkdown components={renderers}>
                            {streamingMessage + " "}
                          </ReactMarkdown>
                          <motion.span
                            animate={{ opacity: [1, 0] }}
                            transition={{ duration: 1, repeat: Infinity }}
                            className="inline-block w-2 h-5 bg-purple-400 ml-1 rounded-sm"
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {(isLoading || sendStreamingMessageMutation.isPending) && !streamingMessage && !isCreatingImages && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-6 justify-start max-w-4xl mx-auto"
            >
              <Avatar className="w-10 h-10 flex-shrink-0 ring-2 ring-purple-500/20 shadow-lg">
                <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold">L</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-white">
                <div className="flex items-center gap-3 py-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Zap className="w-5 h-5 text-purple-400" />
                  </motion.div>
                  <span className="text-white/80 font-medium">Luna is thinking...</span>
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 bg-purple-400 rounded-full"
                        animate={{ 
                          scale: [1, 1.2, 1],
                          opacity: [0.5, 1, 0.5]
                        }}
                        transition={{ 
                          duration: 1,
                          repeat: Infinity,
                          delay: i * 0.2
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Enhanced Scroll to Bottom Button */}
        <AnimatePresence>
          {isUserScrolledUp && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              className="fixed bottom-24 right-6 z-40"
            >
              <motion.button
                whileHover={{ scale: 1.1, y: -2 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  setIsUserScrolledUp(false)
                  scrollToBottom(true)
                }}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-full p-4 shadow-2xl backdrop-blur-sm border border-white/20"
              >
                <ArrowDown className="w-5 h-5" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

      {/* Enhanced Input Area - Now sticky at bottom */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="sticky bottom-0 z-50 bg-black/20 backdrop-blur-xl border-t border-white/10 p-6"
      >
          <div className="max-w-4xl mx-auto">
            {imagePreview && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-4 relative inline-block"
              >
                <img
                  src={imagePreview || "/placeholder.svg"}
                  alt="Upload preview"
                  className="w-20 h-20 object-cover rounded-xl border-2 border-purple-400/50 shadow-lg"
                />
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg"
                  onClick={removeImage}
                >
                  <X className="w-3 h-3" />
                </motion.button>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="flex gap-4 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    const textarea = e.target as HTMLTextAreaElement
                    textarea.style.height = "auto"
                    textarea.style.height = Math.min(textarea.scrollHeight, 128) + "px"
                  }}
                  placeholder="Type your message..."
                  className="w-full min-h-[56px] max-h-32 bg-white/5 backdrop-blur-xl border border-white/20 hover:border-white/30 focus:border-purple-500/50 rounded-2xl px-6 py-4 text-white placeholder-white/50 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all duration-300 scrollbar-enhanced"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit(e)
                    }
                  }}
                  onFocus={() => {
                    if (!isUserScrolledUp) {
                      setTimeout(() => {
                        scrollToBottom()
                      }, 300)
                    }
                  }}
                  onBlur={() => {
                    if (!isUserScrolledUp) {
                      setTimeout(() => {
                        scrollToBottom()
                      }, 100)
                    }
                  }}
                  rows={1}
                  style={{
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    minHeight: "56px",
                    lineHeight: "1.5",
                  }}
                />
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  className="absolute right-4 top-4 text-white/60 hover:text-white transition-colors duration-200 p-2 rounded-lg hover:bg-white/10"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="w-5 h-5" />
                </motion.button>
                <input 
                  ref={fileInputRef} 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                  className="hidden" 
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={isLoading || sendStreamingMessageMutation.isPending || (!input.trim() && !selectedImage)}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-2xl px-8 py-4 h-14 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-2xl backdrop-blur-sm border border-white/20 flex items-center gap-2 font-medium"
              >
                {isLoading || sendStreamingMessageMutation.isPending ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send
                  </>
                )}
              </motion.button>
            </form>
          </div>
        </motion.div>
      
      {/* API Status Monitor */}
      <ApiStatus />
      
      {/* Enhanced Toast Notifications */}
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'white',
          },
        }}
      />
      </div>
    </div>
  )
}
