import { z } from "zod"

export const insertUserSchema = z.object({
  username: z.string(),
  password: z.string(),
})

export const insertConversationSchema = z.object({
  title: z.string(),
  userId: z.number().optional(),
})

export const insertMessageSchema = z.object({
  conversationId: z.number(),
  role: z.string(),
  content: z.string(),
  imageData: z.string().optional(), // Base64 encoded image data
  imageMimeType: z.string().optional(), // MIME type like image/jpeg, image/png
})

export type InsertUser = z.infer<typeof insertUserSchema>
export type User = {
  id: number
  username: string
  password: string
}

export type InsertConversation = z.infer<typeof insertConversationSchema>
export type Conversation = {
  id: number
  userId: number | null
  title: string
  createdAt: Date
}

export type InsertMessage = z.infer<typeof insertMessageSchema>
export type Message = {
  id: number
  conversationId: number
  role: string
  content: string
  imageData?: string | null
  imageMimeType?: string | null
  createdAt: Date
}
