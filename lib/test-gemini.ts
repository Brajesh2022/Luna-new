// Test script to verify Gemini API functionality
import { generateChatResponse } from "./gemini"

export async function testGeminiAPI() {
  try {
    console.log("Testing Gemini API...")
    
    const testMessages = [
      {
        role: "user" as const,
        content: "Hello, can you tell me your name?",
      },
    ]
    
    const response = await generateChatResponse(testMessages)
    console.log("✅ Gemini API test successful!")
    console.log("Response:", response)
    
    return { success: true, response }
  } catch (error) {
    console.error("❌ Gemini API test failed:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// Test endpoint for manual testing
export async function testAPIEndpoint() {
  const result = await testGeminiAPI()
  return result
}