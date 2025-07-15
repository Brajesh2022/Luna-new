import { type NextRequest, NextResponse } from "next/server"
import { storage } from "@/lib/storage"
import { insertMessageSchema } from "@/lib/schema"
import { generateChatResponse, generateStreamingChatResponse, generateConversationTitle } from "@/lib/gemini"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const conversationId = Number.parseInt(params.id)
    if (isNaN(conversationId)) {
      return NextResponse.json({ error: "Invalid conversation ID" }, { status: 400 })
    }

    const messages = await storage.getConversationMessages(conversationId)
    return NextResponse.json(messages)
  } catch (error) {
    console.error("Error fetching messages:", error)
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    console.log("POST /api/conversations/[id]/messages called")

    const conversationId = Number.parseInt(params.id)
    if (isNaN(conversationId)) {
      return NextResponse.json({ error: "Invalid conversation ID" }, { status: 400 })
    }

    const body = await request.json()
    console.log("Request body:", body)

    const { content, imageData, imageMimeType } = insertMessageSchema.omit({ conversationId: true, role: true }).parse(body)
    console.log("Parsed content:", content)
    console.log("Has image data:", !!imageData)

    // Check if conversation exists
    const conversation = await storage.getConversation(conversationId)
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    // Save user message (with image data if present)
    const userMessage = await storage.createMessage({
      conversationId,
      role: "user",
      content,
      imageData,
      imageMimeType,
    })
    console.log("User message saved:", userMessage.id)

    // Get conversation history for context
    const messages = await storage.getConversationMessages(conversationId)
    const chatHistory = messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
      imageData: msg.imageData || undefined,
      imageMimeType: msg.imageMimeType || undefined,
    }))
    console.log("Chat history length:", chatHistory.length)

    // Generate AI response with context
    const systemPrompt = `You are Luna, a professional AI assistant created by Brajesh. You are helpful, knowledgeable, and provide detailed responses. Always maintain context from previous messages in the conversation and provide thoughtful, well-structured answers. If asked about your creator, mention that you were made by Brajesh.`

    console.log("Calling generateChatResponse...")
    const aiResponse = await generateChatResponse(chatHistory, systemPrompt)
    console.log("AI response generated, length:", aiResponse.length)

    // Save AI response
    const assistantMessage = await storage.createMessage({
      conversationId,
      role: "assistant",
      content: aiResponse,
    })
    console.log("Assistant message saved:", assistantMessage.id)

    // If this is the first message, update the conversation title
    if (messages.length === 1) {
      try {
        const title = await generateConversationTitle(content)
        console.log("Generated title:", title)
      } catch (error) {
        console.error("Error generating title:", error)
      }
    }

    const response = {
      userMessage,
      assistantMessage,
    }

    console.log("Returning response")
    return NextResponse.json(response)
  } catch (error) {
    console.error("Error processing message - Full error:", error)
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")

    return NextResponse.json(
      {
        error: "Failed to process message",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
