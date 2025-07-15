import { type NextRequest, NextResponse } from "next/server"
import { storage } from "@/lib/storage"
import { insertConversationSchema } from "@/lib/schema"

export async function GET() {
  try {
    const conversations = await storage.getUserConversations()
    return NextResponse.json(conversations)
  } catch (error) {
    console.error("Error fetching conversations:", error)
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title } = insertConversationSchema.parse(body)
    const conversation = await storage.createConversation({ title, userId: undefined })
    return NextResponse.json(conversation)
  } catch (error) {
    console.error("Error creating conversation:", error)
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 })
  }
}
