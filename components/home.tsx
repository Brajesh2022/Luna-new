"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Send, ImageIcon, PlusCircle, Copy, X, Check } from "lucide-react"
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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    const timeoutId = setTimeout(scrollToBottom, 100)
    return () => clearTimeout(timeoutId)
  }, [allMessages, isLoading])

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

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      console.log("Sending message:", content, "to conversation:", activeConversation)
      const response = await apiRequest("POST", `/api/conversations/${activeConversation}/messages`, { content })
      const data = await response.json()
      console.log("Message response received:", data)
      return data
    },
    onSuccess: (data) => {
      console.log("Message send success:", data)

      // Add messages to local state immediately
      if (data.userMessage && data.assistantMessage) {
        setLocalMessages((prev) => [...prev, data.userMessage, data.assistantMessage])

        // Start typing effect for the new assistant message
        console.log("Starting typing effect for message:", data.assistantMessage.id)
        setTypingMessageId(data.assistantMessage.id)
      }

      // Also invalidate and refetch server data
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", activeConversation, "messages"],
      })

      // Force refetch after a short delay
      setTimeout(() => {
        refetchMessages()
      }, 500)

      setShowSuggestions(false)
    },
    onError: (error) => {
      console.error("Message send error:", error)
      alert("Failed to send message. Check console for details.")
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
        sendMessageMutation.mutate(input)
      }, 100)
      setInput("")
      removeImage()
      return
    }

    setIsLoading(true)
    const content = input
    setInput("")
    removeImage()

    // Blur input to hide keyboard
    inputRef.current?.blur()

    try {
      console.log("Sending message mutation...")
      await sendMessageMutation.mutateAsync(content)
      console.log("Message sent successfully")
    } catch (error) {
      console.error("Error sending message:", error)
      alert("Error sending message: " + (error instanceof Error ? error.message : String(error)))
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

  const isImageGenerationResponse = (content: string) => {
    try {
      let cleanContent = content
      if (content.includes("```json")) {
        cleanContent = content
          .replace(/```json\s*/g, "")
          .replace(/```\s*/g, "")
          .trim()
      }

      const parsed = JSON.parse(cleanContent)
      return parsed.type === "image_generation" && Array.isArray(parsed.prompts) && parsed.prompts.length === 4
    } catch {
      return false
    }
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
    <div className="h-screen flex flex-col bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 mobile-safe">
      {/* Header */}
      <header className="mobile-header bg-black/20 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
            <AvatarFallback>L</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-white font-semibold text-lg">Luna</h1>
            <p className="text-white/60 text-xs">AI Assistant by Brajesh</p>
          </div>
        </div>
        <Button
          onClick={handleNewConversation}
          variant="ghost"
          size="sm"
          className="text-white/80 hover:text-white hover:bg-white/10"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col mobile-content">
        {/* Messages */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scrollbar-thin">
          {allMessages.length === 0 && showSuggestions ? (
            <div className="flex flex-col items-center justify-center h-full space-y-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                <Avatar className="w-20 h-20 mx-auto mb-4">
                  <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
                  <AvatarFallback>L</AvatarFallback>
                </Avatar>
                <h2 className="text-2xl font-semibold text-white mb-2">Welcome to Luna</h2>
                <p className="text-white/60 mb-8">
                  Your intelligent AI assistant created by Brajesh. How can I help you today?
                </p>
              </motion.div>

              <TopicSuggestion examples={TOPIC_SUGGESTIONS} onSelect={handleTopicSelect} />
            </div>
          ) : (
            <AnimatePresence>
              {allMessages.map((message, index) => {
                console.log("Rendering message:", message.id, message.role, message.content.substring(0, 50))
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                      "flex gap-4 message relative",
                      message.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    {message.role === "assistant" && (
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
                        <AvatarFallback>L</AvatarFallback>
                      </Avatar>
                    )}

                    <div
                      className={cn(
                        "message-container glass-morphism p-4 rounded-2xl",
                        message.role === "user" ? "user-message text-white" : "assistant-message text-white",
                      )}
                    >
                      {message.role === "assistant" && isImageGenerationResponse(message.content) ? (
                        <ImageCollage prompts={getImagePrompts(message.content)} messageId={message.id} />
                      ) : (
                        <div className="markdown-content">
                          {message.role === "assistant" && typingMessageId === message.id ? (
                            <TypingEffect
                              text={message.content}
                              onComplete={() => setTypingMessageId(null)}
                              renderers={renderers}
                            />
                          ) : (
                            <ReactMarkdown components={renderers}>{message.content}</ReactMarkdown>
                          )}
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
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src="/images/user-avatar.jpg" alt="User" />
                        <AvatarFallback>U</AvatarFallback>
                      </Avatar>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}

          {(isLoading || sendMessageMutation.isPending) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4 justify-start"
            >
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
                <AvatarFallback>L</AvatarFallback>
              </Avatar>
              <div className="glass-morphism p-4 rounded-2xl bg-black/20">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                  <span className="text-white/80">Luna is thinking...</span>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="mobile-input bg-black/20 backdrop-blur-xl border-t border-white/10 p-4">
          {imagePreview && (
            <div className="mb-4 relative inline-block">
              <img
                src={imagePreview || "/placeholder.svg"}
                alt="Upload preview"
                className="w-16 h-16 object-cover rounded-lg border-2 border-purple-400/50"
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600"
                onClick={removeImage}
              >
                <X className="w-3 h-3 text-white" />
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  // Auto-resize textarea
                  const textarea = e.target as HTMLTextAreaElement
                  textarea.style.height = "auto"
                  textarea.style.height = Math.min(textarea.scrollHeight, 128) + "px"
                }}
                placeholder="Type your message..."
                className="w-full min-h-[48px] max-h-32 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 resize-none focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
                onFocus={() => {
                  // Auto-scroll when input is focused (keyboard appears)
                  setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
                  }, 300)
                }}
                onBlur={() => {
                  // Small delay to handle keyboard closing
                  setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
                  }, 100)
                }}
                rows={1}
                style={{
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  minHeight: "48px",
                  lineHeight: "1.5",
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-2 text-white/60 hover:text-white hover:bg-white/10"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="w-4 h-4" />
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </div>

            <Button
              type="submit"
              disabled={isLoading || sendMessageMutation.isPending || (!input.trim() && !selectedImage)}
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-6 py-3 h-12 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading || sendMessageMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
