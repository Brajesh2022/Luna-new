import type { User, InsertUser, Conversation, InsertConversation, Message, InsertMessage } from "./schema"

export interface IStorage {
  getUser(id: number): Promise<User | undefined>
  getUserByUsername(username: string): Promise<User | undefined>
  createUser(user: InsertUser): Promise<User>

  // Conversation methods
  createConversation(conversation: InsertConversation): Promise<Conversation>
  getConversation(id: number): Promise<Conversation | undefined>
  getUserConversations(userId?: number): Promise<Conversation[]>

  // Message methods
  createMessage(message: InsertMessage): Promise<Message>
  getConversationMessages(conversationId: number): Promise<Message[]>
}

export class MemStorage implements IStorage {
  private users: Map<number, User>
  private conversations: Map<number, Conversation>
  private messages: Map<number, Message>
  private currentUserId: number
  private currentConversationId: number
  private currentMessageId: number

  constructor() {
    this.users = new Map()
    this.conversations = new Map()
    this.messages = new Map()
    this.currentUserId = 1
    this.currentConversationId = 1
    this.currentMessageId = 1
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id)
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((user) => user.username === username)
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++
    const user: User = { ...insertUser, id }
    this.users.set(id, user)
    return user
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const id = this.currentConversationId++
    const conversation: Conversation = {
      ...insertConversation,
      userId: insertConversation.userId || null,
      id,
      createdAt: new Date(),
    }
    this.conversations.set(id, conversation)
    return conversation
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    return this.conversations.get(id)
  }

  async getUserConversations(userId?: number): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).filter((conv) => !userId || conv.userId === userId)
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++
    const message: Message = {
      ...insertMessage,
      id,
      createdAt: new Date(),
    }
    this.messages.set(id, message)
    return message
  }

  async getConversationMessages(conversationId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((message) => message.conversationId === conversationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }
}

export const storage = new MemStorage()
