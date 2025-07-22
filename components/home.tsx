"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Send, ImageIcon, PlusCircle, Copy, X, Check, ArrowDown, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion"
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
  const [isInputFocused, setIsInputFocused] = useState(false)

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

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

  // Enhanced scroll handling
  const updateScrollPosition = useCallback(() => {
    if (!scrollContainerRef.current) return
    
    const container = scrollContainerRef.current
    const { scrollTop, scrollHeight, clientHeight } = container
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50
    
    setIsUserScrolledUp(!isAtBottom)
  }, [])

  const handleScroll = useCallback(() => {
    updateScrollPosition()
  }, [updateScrollPosition])

  const scrollToBottom = useCallback((force: boolean = false) => {
    if (!messagesEndRef.current || (!force && isUserScrolledUp)) return
    
    messagesEndRef.current.scrollIntoView({ 
      behavior: force ? "instant" : "smooth",
      block: "end"
    })
  }, [isUserScrolledUp])

  // Auto-scroll effect
  useEffect(() => {
    if (streamingMessage || isCreatingImages) {
      scrollToBottom()
    }
  }, [streamingMessage, isCreatingImages, scrollToBottom])

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
    toast.success("Message copied to clipboard")
    setTimeout(() => setCopiedMessageId(null), 2000)
  }

  // Enhanced renderers for markdown
  const renderers = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || "")
      const language = match ? match[1] : "text"

      if (!inline && match) {
        return <CodeBlock language={language} value={String(children).replace(/\n$/, "")} />
      }

      return (
        <code className={cn("bg-white/10 px-2 py-1 rounded text-purple-200", className)} {...props}>
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
    <div className="h-screen flex flex-col relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.3),rgba(255,255,255,0))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(120,119,198,0.4),rgba(255,255,255,0))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(120,119,198,0.4),rgba(255,255,255,0))]" />
        
        {/* Floating Particles */}
        {typeof window !== 'undefined' && [...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full"
            initial={{
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
              y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
            }}
            animate={{
              y: [null, Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800)],
              x: [null, Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000)],
            }}
            transition={{
              duration: Math.random() * 20 + 10,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "linear",
            }}
          />
        ))}
      </div>

      {/* Enhanced Header */}
      <motion.header 
        className="relative z-50 backdrop-blur-xl bg-black/10 border-b border-white/10"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <motion.div 
              className="flex items-center space-x-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="relative">
                <Avatar className="w-12 h-12 ring-2 ring-purple-400/50">
                  <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
                  <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">L</AvatarFallback>
                </Avatar>
                <motion.div
                  className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <div>
                <motion.h1 
                  className="text-white font-bold text-xl bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  Luna AI
                </motion.h1>
                <motion.p 
                  className="text-white/60 text-sm flex items-center gap-1"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <Sparkles className="w-3 h-3" />
                  AI Assistant by Brajesh
                </motion.p>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Button
                onClick={handleNewConversation}
                variant="ghost"
                size="sm"
                className="text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300 hover:scale-105"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                New Chat
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.header>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden">
        <div 
          ref={scrollContainerRef}
          className="h-full overflow-y-auto"
          onScroll={handleScroll}
          style={{
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div className="px-6 py-6 pb-32 min-h-full">
                      {allMessages.length === 0 && showSuggestions && !streamingMessage ? (
              // Welcome Screen
              <motion.div 
                className="flex flex-col items-center justify-center min-h-[60vh] space-y-8"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <motion.div 
                  className="text-center"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                >
                  <div className="relative mb-6">
                    <Avatar className="w-24 h-24 mx-auto ring-4 ring-purple-400/30">
                      <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-2xl">L</AvatarFallback>
                    </Avatar>
                    <motion.div
                      className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles className="w-4 h-4 text-white" />
                    </motion.div>
                  </div>
                  
                  <motion.h2 
                    className="text-4xl font-bold text-white mb-4 bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                  >
                    Welcome to Luna
                  </motion.h2>
                  
                  <motion.p 
                    className="text-white/70 text-lg max-w-md mx-auto leading-relaxed"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                  >
                    Your intelligent AI assistant is ready to help with anything you need. 
                    Start a conversation below!
                  </motion.p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.8 }}
                  className="w-full max-w-4xl"
                >
                  <TopicSuggestion examples={TOPIC_SUGGESTIONS} onSelect={handleTopicSelect} />
                </motion.div>
              </motion.div>
                         ) : (
              // Messages Area
              <div className="space-y-6">
                <AnimatePresence mode="popLayout">
                  {allMessages.map((message, index) => (
                    <motion.div
                      key={message.id}
                      layout
                      initial={{ opacity: 0, y: 50, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -50, scale: 0.8 }}
                      transition={{ 
                        duration: 0.5,
                        type: "spring",
                        stiffness: 100,
                        damping: 15
                      }}
                      className={cn(
                        "flex gap-4 group",
                        message.role === "user" ? "justify-end" : "justify-start",
                      )}
                    >
                                         {message.role === "assistant" && (
                       <motion.div
                         initial={{ scale: 0 }}
                         animate={{ scale: 1 }}
                         transition={{ duration: 0.3, delay: 0.1 }}
                       >
                         <Avatar className="w-10 h-10 flex-shrink-0 ring-2 ring-purple-400/30">
                           <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
                           <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">L</AvatarFallback>
                         </Avatar>
                       </motion.div>
                     )}

                     <div className="flex flex-col max-w-[85%] md:max-w-[75%]">
                       <motion.div
                         className={cn(
                           "relative backdrop-blur-xl border transition-all duration-300 group-hover:scale-[1.02]",
                           message.role === "user" 
                             ? "bg-gradient-to-r from-purple-600/80 to-pink-600/80 border-purple-400/30 text-white rounded-3xl rounded-tr-lg" 
                             : "bg-black/20 border-white/10 text-white rounded-3xl rounded-tl-lg",
                         )}
                         whileHover={{ y: -2 }}
                         transition={{ duration: 0.2 }}
                       >
                         <div className="p-5">
                                                 {message.role === "user" && message.imageData && (
                             <motion.div 
                               className="mb-4"
                               initial={{ opacity: 0, scale: 0.8 }}
                               animate={{ opacity: 1, scale: 1 }}
                               transition={{ duration: 0.3 }}
                             >
                               <img
                                 src={`data:${message.imageMimeType};base64,${message.imageData}`}
                                 alt="Uploaded image"
                                 className="max-w-xs max-h-48 object-contain rounded-2xl border-2 border-white/20 shadow-lg"
                               />
                             </motion.div>
                           )}
                           
                           {message.role === "assistant" && isImageGenerationContent(message.content) ? (
                             <ImageCollage prompts={getImagePrompts(message.content)} messageId={message.id} />
                           ) : (
                             <div className="markdown-content prose prose-invert max-w-none">
                               <ReactMarkdown components={renderers}>
                                 {message.content}
                               </ReactMarkdown>
                             </div>
                           )}
                         </div>

                         {/* Copy Button */}
                         <motion.div
                           className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                           whileHover={{ scale: 1.1 }}
                           whileTap={{ scale: 0.9 }}
                         >
                           <Button
                             variant="ghost"
                             size="sm"
                             className="h-8 w-8 p-0 bg-black/20 hover:bg-black/40 border border-white/20"
                             onClick={() => copyMessage(message.content, message.id)}
                           >
                             {copiedMessageId === message.id ? 
                               <Check className="w-3 h-3 text-green-400" /> : 
                               <Copy className="w-3 h-3 text-white/60" />
                             }
                           </Button>
                         </motion.div>
                       </motion.div>

                       {/* Message timestamp */}
                       <motion.div
                         className={cn(
                           "text-xs text-white/40 mt-2 px-2",
                           message.role === "user" ? "text-right" : "text-left"
                         )}
                         initial={{ opacity: 0 }}
                         animate={{ opacity: 1 }}
                         transition={{ duration: 0.3, delay: 0.2 }}
                       >
                         {new Date(message.createdAt).toLocaleTimeString([], { 
                           hour: '2-digit', 
                           minute: '2-digit' 
                         })}
                       </motion.div>
                     </div>

                                         {message.role === "user" && (
                       <motion.div
                         initial={{ scale: 0 }}
                         animate={{ scale: 1 }}
                         transition={{ duration: 0.3, delay: 0.1 }}
                       >
                         <Avatar className="w-10 h-10 flex-shrink-0 ring-2 ring-pink-400/30">
                           <AvatarImage src="/images/user-avatar.jpg" alt="User" />
                           <AvatarFallback className="bg-gradient-to-br from-pink-500 to-purple-500 text-white">U</AvatarFallback>
                         </Avatar>
                       </motion.div>
                     )}
                   </motion.div>
                 ))}
                </AnimatePresence>
                
                {/* Streaming Message */}
                {streamingMessageId && (streamingMessage || isCreatingImages) && (
                  <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -50, scale: 0.8 }}
                    className="flex gap-4 justify-start"
                  >
                    <Avatar className="w-10 h-10 flex-shrink-0 ring-2 ring-purple-400/30">
                      <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">L</AvatarFallback>
                    </Avatar>
                    <div className="backdrop-blur-xl bg-black/20 border border-white/10 text-white rounded-3xl rounded-tl-lg max-w-[85%] md:max-w-[75%]">
                      {isCreatingImages ? (
                        <ImageGenerationAnimation isVisible={isCreatingImages} />
                      ) : (
                        <div className="p-5">
                          <div className="markdown-content prose prose-invert max-w-none">
                            <ReactMarkdown components={renderers}>
                              {streamingMessage}
                            </ReactMarkdown>
                            <motion.span
                              className="inline-block w-2 h-5 bg-purple-400 ml-1"
                              animate={{ opacity: [1, 0] }}
                              transition={{ duration: 0.8, repeat: Infinity }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
          )}

                          {/* Loading State */}
                {(isLoading || sendStreamingMessageMutation.isPending) && !streamingMessage && !isCreatingImages && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-4 justify-start"
                  >
                    <Avatar className="w-10 h-10 flex-shrink-0 ring-2 ring-purple-400/30">
                      <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">L</AvatarFallback>
                    </Avatar>
                    <div className="backdrop-blur-xl bg-black/20 border border-white/10 rounded-3xl rounded-tl-lg p-5">
                      <div className="flex items-center gap-3">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <Loader2 className="w-5 h-5 text-purple-400" />
                        </motion.div>
                        <span className="text-white/80">Luna is thinking...</span>
                        <motion.div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              className="w-1 h-1 bg-purple-400 rounded-full"
                              animate={{ y: [0, -8, 0] }}
                              transition={{
                                duration: 0.6,
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
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Scroll to Bottom Button */}
      <AnimatePresence>
        {isUserScrolledUp && (
          <motion.div
            initial={{ opacity: 0, scale: 0, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0, y: 20 }}
            className="fixed bottom-28 right-6 z-40"
          >
            <Button
              onClick={() => {
                setIsUserScrolledUp(false)
                scrollToBottom(true)
              }}
              variant="default"
              size="sm"
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-full p-3 shadow-xl backdrop-blur-xl border border-white/20 hover:scale-110 transition-all duration-300"
            >
              <ArrowDown className="w-5 h-5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

              {/* Enhanced Input Area */}
      <motion.div 
        className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-2xl bg-black/10 border-t border-white/10"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <div className="px-6 py-4">
          {imagePreview && (
            <motion.div 
              className="mb-4 relative inline-block"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
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

          <form onSubmit={handleSubmit} className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <motion.div
                className="relative"
                animate={{ 
                  scale: isInputFocused ? 1.02 : 1,
                }}
                transition={{ duration: 0.2 }}
              >
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
                  className="w-full min-h-[56px] max-h-[120px] bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl px-5 py-4 pr-14 text-white placeholder-white/40 resize-none focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400/50 transition-all duration-300"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit(e)
                    }
                  }}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  rows={1}
                />
                
                <motion.button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200"
                  onClick={() => fileInputRef.current?.click()}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
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
              </motion.div>
            </div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                type="submit"
                disabled={isLoading || sendStreamingMessageMutation.isPending || (!input.trim() && !selectedImage)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-2xl px-6 py-4 h-14 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg backdrop-blur-xl border border-purple-400/20 transition-all duration-300"
              >
                {isLoading || sendStreamingMessageMutation.isPending ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </motion.div>
          </form>
        </div>
      </motion.div>
      </div>
      
      {/* API Status Monitor */}
      <ApiStatus />
      
      {/* Toast Notifications */}
      <Toaster />
    </div>
  )
}
