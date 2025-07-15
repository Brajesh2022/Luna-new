import { type NextRequest, NextResponse } from "next/server"
import { storage } from "@/lib/storage"
import { insertMessageSchema } from "@/lib/schema"
import { generateChatResponse, generateConversationTitle } from "@/lib/gemini"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    console.log("POST /api/conversations/[id]/messages/stream called")

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

    console.log("Generating AI response...")
    
    // Use regular API call instead of streaming for now (more reliable)
    const aiResponse = await generateChatResponse(chatHistory, systemPrompt)
    console.log("AI response generated, length:", aiResponse.length)

    // Save AI response
    const assistantMessage = await storage.createMessage({
      conversationId,
      role: "assistant",
      content: aiResponse,
    })
    console.log("Assistant message saved:", assistantMessage.id)

    // Create a simple streaming response that simulates typing
    const encoder = new TextEncoder()
    
    const readableStream = new ReadableStream({
      start(controller) {
        // Send the user message immediately
        const userMessageData = {
          type: "user_message",
          message: userMessage,
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(userMessageData)}\n\n`))
        
        // Start streaming the response character by character
        let index = 0
        const streamInterval = setInterval(() => {
          if (index < aiResponse.length) {
            const char = aiResponse[index]
            const streamData = {
              type: "stream_chunk",
              chunk: char,
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(streamData)}\n\n`))
            index++
          } else {
            // Send the final complete message
            const finalMessage = {
              type: "assistant_message_complete",
              message: assistantMessage,
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalMessage)}\n\n`))
            
            clearInterval(streamInterval)
            controller.close()
          }
        }, 20) // Stream characters every 20ms for smooth animation
      },
    })

    // If this is the first message, update the conversation title
    if (messages.length === 1) {
      try {
        const title = await generateConversationTitle(content)
        console.log("Generated title:", title)
      } catch (error) {
        console.error("Error generating title:", error)
      }
    }

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  } catch (error) {
    console.error("Error processing streaming message - Full error:", error)
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")

    return NextResponse.json(
      {
        error: "Failed to process streaming message",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}