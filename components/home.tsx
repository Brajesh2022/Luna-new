"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Send, ImageIcon, PlusCircle, Copy, X, Check, ArrowDown, Brain } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { TopicSuggestion } from "@/components/topic-suggestion"
import ReactMarkdown from "react-markdown"
import { CodeBlock } from "@/components/code-block"
import { apiRequest } from "@/lib/queryClient"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Message, Conversation } from "@/lib/schema"
import ImageCollage from "@/components/image-collage"
import ApiStatus from "@/components/api-status"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"
import ImageGenerationAnimation from "@/components/image-generation-animation"

const TOPIC_SUGGESTIONS = [
  "Write a short story about a time traveler",
  "Help me draft a professional email",
  "Explain quantum computing in simple terms",
  "Create a study plan for learning JavaScript",
  "Generate images of a beautiful sunset",
  "How can I improve my presentation skills?",
]

export default function Home() {
  // State
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [activeConversation, setActiveConversation] = useState<number | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null)
  const [localMessages, setLocalMessages] = useState<Message[]>([])
  const [streamingMessage, setStreamingMessage] = useState<string>("")
  const [streamingMessageId, setStreamingMessageId] = useState<number | null>(null)
  const [isCreatingImages, setIsCreatingImages] = useState(false)
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false)

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const queryClient = useQueryClient()

  // Queries
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  })

  const { data: messages = [], refetch: refetchMessages } = useQuery<Message[]>({
    queryKey: ["/api/conversations", activeConversation, "messages"],
    enabled: !!activeConversation,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  const allMessages = [...messages, ...localMessages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              <AvatarImage src="/images/luna-avatar.png" alt="Luna AI" />
              <AvatarFallback className="bg-purple-600 text-white text-sm">L</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-white font-semibold text-lg">Luna</h1>
              <p className="text-white/60 text-xs flex items-center gap-1">
                <Brain className="w-3 h-3" />
                AI Assistant by Brajesh
              </p>
            </div>
          </div>
          <Button
            onClick={() => {}}
            variant="ghost"
            size="sm"
            className="text-white/80 hover:text-white hover:bg-white/10 text-sm"
          >
            <PlusCircle className="w-4 h-4 mr-1" />
            New
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-24">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-white">Content will go here</div>
        </div>
      </main>

      {/* Fixed Input Area */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-t border-white/10">
        <div className="max-w-4xl mx-auto p-4">
          <form className="flex gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="w-full min-h-[44px] max-h-[100px] bg-white/10 border border-white/20 rounded-lg px-3 py-2 pr-10 text-white placeholder-white/50 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={1}
              />
              <button
                type="button"
                className="absolute right-2 top-2 text-white/60 hover:text-white p-1"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
            </div>
            <Button
              type="submit"
              disabled={!input.trim()}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg px-4 py-2 h-11 min-w-[44px]"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
      
      <ApiStatus />
      <Toaster position="top-center" />
    </div>
  )
}
