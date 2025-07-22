"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Send, ImageIcon, PlusCircle, Copy, X, Check, ArrowDown } from "lucide-react"
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
  const [showScrollButton, setShowScrollButton] = useState(false)

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

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

  // Smooth scroll handling with better performance
  const checkScrollPosition = useCallback(() => {
    if (!chatContainerRef.current) return
    
    const container = chatContainerRef.current
    const { scrollTop, scrollHeight, clientHeight } = container
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    
    setShowScrollButton(distanceFromBottom > 100)
  }, [])

  // Optimized scroll to bottom
  const scrollToBottom = useCallback((smooth: boolean = true) => {
    if (!messagesEndRef.current) return
    
    messagesEndRef.current.scrollIntoView({ 
      behavior: smooth ? "smooth" : "auto",
      block: "end",
      inline: "nearest"
    })
  }, [])

  // Auto-scroll management
  useEffect(() => {
    const shouldAutoScroll = !showScrollButton && (allMessages.length > 0 || streamingMessage || isLoading)
    
    if (shouldAutoScroll) {
      // Small delay to ensure DOM is updated
      const timer = setTimeout(() => scrollToBottom(), 100)
      return () => clearTimeout(timer)
    }
  }, [allMessages, streamingMessage, isLoading, showScrollButton, scrollToBottom])

  // Scroll event listener with throttling
  useEffect(() => {
    const container = chatContainerRef.current
    if (!container) return

    let ticking = false
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          checkScrollPosition()
          ticking = false
        })
        ticking = true
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [checkScrollPosition])

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Handle mobile viewport and keyboard
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01
      document.documentElement.style.setProperty("--vh", `${vh}px`)
    }

    // Set initial viewport height
    setVH()

    // Handle viewport changes (keyboard open/close)
    const handleResize = () => {
      setVH()
      // Small delay to ensure the viewport has settled
      setTimeout(() => {
        if (!showScrollButton) {
          scrollToBottom()
        }
      }, 150)
    }

    // Handle visual viewport API if available (better for mobile keyboards)
    if (window.visualViewport) {
      const handleViewportChange = () => {
        const keyboardHeight = window.innerHeight - window.visualViewport.height
        document.documentElement.style.setProperty("--keyboard-height", `${keyboardHeight}px`)
        
        // Scroll to bottom when keyboard opens
        if (!showScrollButton && keyboardHeight > 0) {
          setTimeout(() => scrollToBottom(), 100)
        }
      }

      window.visualViewport.addEventListener('resize', handleViewportChange)
      
      return () => {
        window.removeEventListener("resize", handleResize)
        window.visualViewport?.removeEventListener('resize', handleViewportChange)
      }
    } else {
      window.addEventListener("resize", handleResize)
      window.addEventListener("orientationchange", handleResize)
      
      return () => {
        window.removeEventListener("resize", handleResize)
        window.removeEventListener("orientationchange", handleResize)
      }
    }
  }, [showScrollButton, scrollToBottom])

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

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const textarea = e.target
    textarea.style.height = "auto"
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px"
  }

  console.log("Render - Server messages count:", messages.length)
  console.log("Render - Local messages count:", localMessages.length)
  console.log("Render - All messages count:", allMessages.length)
  console.log("Render - Active conversation:", activeConversation)
  console.log("Render - Show suggestions:", showSuggestions)

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="flex items-center gap-3">
          <div className="avatar-wrapper">
            <div className="avatar-inner">
              <Avatar className="w-full h-full">
                <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
                <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white font-semibold">
                  L
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg leading-tight">Luna</h1>
            <p className="text-white/60 text-sm leading-tight">AI Assistant by Brajesh</p>
          </div>
        </div>
        <Button
          onClick={handleNewConversation}
          variant="ghost"
          size="sm"
          className="text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200"
          disabled={createConversationMutation.isPending}
        >
          {createConversationMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <PlusCircle className="w-4 h-4 mr-2" />
          )}
          New Chat
        </Button>
      </header>

      {/* Chat Container */}
      <div 
        ref={chatContainerRef} 
        className="chat-container scrollbar-modern"
      >
          {allMessages.length === 0 && showSuggestions && !streamingMessage ? (
            <div className="welcome-container">
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center"
              >
                <div className="welcome-avatar">
                  <Avatar className="w-full h-full">
                    <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
                    <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white font-bold text-2xl">
                      L
                    </AvatarFallback>
                  </Avatar>
                </div>
                <h2 className="text-3xl font-bold text-white mb-3">Welcome to Luna</h2>
                <p className="text-white/70 text-lg max-w-md mx-auto mb-8">
                  Your intelligent AI assistant created by Brajesh. How can I help you today?
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <TopicSuggestion examples={TOPIC_SUGGESTIONS} onSelect={handleTopicSelect} />
              </motion.div>
            </div>
          ) : (
            <div className="messages-container">
              <AnimatePresence mode="popLayout">
                {allMessages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ 
                      duration: 0.3,
                      type: "spring",
                      stiffness: 500,
                      damping: 30
                    }}
                    className={cn(
                      "flex gap-4 items-start",
                      message.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="avatar-wrapper flex-shrink-0">
                        <div className="avatar-inner">
                          <Avatar className="w-full h-full">
                            <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
                            <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white font-semibold">
                              L
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      </div>
                    )}

                    <div
                      className={cn(
                        "message-bubble selectable",
                        message.role === "user" ? "user-message" : "assistant-message"
                      )}
                    >
                      {message.role === "user" && message.imageData && (
                        <div className="mb-3">
                          <img
                            src={`data:${message.imageMimeType};base64,${message.imageData}`}
                            alt="Uploaded image"
                            className="max-w-xs max-h-48 object-contain rounded-lg border-2 border-white/20"
                          />
                        </div>
                      )}
                      
                      {message.role === "assistant" && isImageGenerationContent(message.content) ? (
                        <ImageCollage prompts={getImagePrompts(message.content)} messageId={message.id} />
                      ) : (
                        <div className="markdown-content">
                          <ReactMarkdown components={renderers}>{message.content}</ReactMarkdown>
                        </div>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="message-copy-button"
                        onClick={() => copyMessage(message.content, message.id)}
                      >
                        {copiedMessageId === message.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>

                    {message.role === "user" && (
                      <div className="avatar-wrapper flex-shrink-0">
                        <div className="avatar-inner">
                          <Avatar className="w-full h-full">
                            <AvatarImage src="/images/user-avatar.jpg" alt="User" />
                            <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white font-semibold">
                              U
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              
                {/* Streaming message */}
                {streamingMessageId && (streamingMessage || isCreatingImages) && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ 
                      duration: 0.3,
                      type: "spring",
                      stiffness: 500,
                      damping: 30
                    }}
                    className="flex gap-4 items-start justify-start"
                  >
                    <div className="avatar-wrapper flex-shrink-0">
                      <div className="avatar-inner">
                        <Avatar className="w-full h-full">
                          <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
                          <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white font-semibold">
                            L
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </div>
                    <div className="message-bubble assistant-message">
                      {isCreatingImages ? (
                        <ImageGenerationAnimation isVisible={isCreatingImages} />
                      ) : (
                        <div className="markdown-content">
                          <ReactMarkdown components={renderers}>{streamingMessage + " ▊"}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
          )}

              {(isLoading || sendStreamingMessageMutation.isPending) && !streamingMessage && !isCreatingImages && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex gap-4 items-start justify-start"
                >
                  <div className="avatar-wrapper flex-shrink-0">
                    <div className="avatar-inner">
                      <Avatar className="w-full h-full">
                        <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
                        <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white font-semibold">
                          L
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                  <div className="message-bubble assistant-message">
                    <div className="typing-indicator">
                      <div className="typing-dots">
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                      </div>
                      <span className="text-white/80 ml-3">Luna is thinking...</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
      </div>

      {/* Scroll to Bottom Button */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => scrollToBottom()}
            className="scroll-to-bottom"
          >
            <ArrowDown className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="app-input">
        {imagePreview && (
          <div className="image-preview mb-3">
            <img
              src={imagePreview}
              alt="Upload preview"
              className="w-20 h-20 object-cover rounded-lg border-2 border-purple-400/50"
            />
            <button
              className="remove-image"
              onClick={removeImage}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              placeholder="Type your message..."
              className="chat-input"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              rows={1}
              disabled={isLoading || sendStreamingMessageMutation.isPending}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-3 bottom-3 text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || sendStreamingMessageMutation.isPending}
            >
              <ImageIcon className="w-4 h-4" />
            </Button>
            <input 
              ref={fileInputRef} 
              type="file" 
              accept="image/*" 
              onChange={handleImageUpload} 
              className="hidden" 
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading || sendStreamingMessageMutation.isPending || (!input.trim() && !selectedImage)}
            className="send-button"
          >
            {isLoading || sendStreamingMessageMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </form>
      </div>
      
      {/* API Status Monitor */}
      <ApiStatus />
      
      {/* Toast Notifications */}
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
          },
        }}
      />
    </div>
  )
}
