// Multiple API keys for automatic fallback
const GOOGLE_API_KEYS = [
  "AIzaSyAOoY7jmqopJ5q34ELVyNViSPEtQ8WUDw0", // Original key
  "AIzaSyArRtMxtNBzbUyzWn09HuYbPkCag59qfjU", // Fallback 1
  "AIzaSyCDrjSPNGlOzVIBJdVDcMjMVePe7es4UwY", // Fallback 2
  "AIzaSyAVhqmKXcEdP7q2W-0-mCKaSL1w3KLyKZY", // Fallback 3
]

export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
  imageData?: string // Base64 encoded image data
  imageMimeType?: string // MIME type like image/jpeg, image/png
}

// Helper function to determine if error is retryable with different API key
const isRetryableError = (error: any): boolean => {
  if (typeof error === 'string') {
    return error.includes('quota') || 
           error.includes('rate') || 
           error.includes('limit') ||
           error.includes('429') ||
           error.includes('503') ||
           error.includes('502') ||
           error.includes('500')
  }
  
  if (error instanceof Error) {
    return error.message.includes('quota') || 
           error.message.includes('rate') || 
           error.message.includes('limit') ||
           error.message.includes('429') ||
           error.message.includes('503') ||
           error.message.includes('502') ||
           error.message.includes('500')
  }
  
  return false
}

// Helper function to make API request with fallback
async function makeGeminiRequest(
  endpoint: string,
  requestBody: any,
  isStreaming: boolean = false
): Promise<Response> {
  let lastError: any = null
  
  for (let i = 0; i < GOOGLE_API_KEYS.length; i++) {
    const apiKey = GOOGLE_API_KEYS[i]
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:${endpoint}?key=${apiKey}`
    
    try {
      console.log(`Trying API key ${i + 1}/${GOOGLE_API_KEYS.length} for ${endpoint}`)
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      if (response.ok) {
        console.log(`✅ Successfully used API key ${i + 1}`)
        return response
      }

      const errorText = await response.text()
      const error = `API key ${i + 1} failed: ${response.status} - ${errorText}`
      console.warn(error)
      lastError = error
      
      // If it's a retryable error and we have more keys, try next one
      if (isRetryableError(errorText) && i < GOOGLE_API_KEYS.length - 1) {
        console.log(`⚠️ Retryable error with API key ${i + 1}, trying next key...`)
        await new Promise(resolve => setTimeout(resolve, 500)) // Brief delay
        continue
      }
      
      // If it's not retryable, throw immediately
      if (!isRetryableError(errorText)) {
        throw new Error(error)
      }
      
    } catch (fetchError) {
      const error = `API key ${i + 1} request failed: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`
      console.warn(error)
      lastError = error
      
      // If it's a retryable error and we have more keys, try next one
      if (isRetryableError(fetchError) && i < GOOGLE_API_KEYS.length - 1) {
        console.log(`⚠️ Retryable error with API key ${i + 1}, trying next key...`)
        await new Promise(resolve => setTimeout(resolve, 500)) // Brief delay
        continue
      }
      
      // If it's not retryable, throw immediately
      if (!isRetryableError(fetchError)) {
        throw new Error(error)
      }
    }
  }
  
  // If we get here, all API keys failed
  throw new Error(`All ${GOOGLE_API_KEYS.length} API keys failed. Last error: ${lastError}`)
}

export async function generateChatResponse(messages: ChatMessage[], systemPrompt?: string): Promise<string> {
  try {
    console.log("Generating chat response with", messages.length, "messages")

    // Convert messages to Gemini format
    const geminiMessages = messages.map((msg) => {
      const parts: any[] = [{ text: msg.content }]
      
      // Add image data if present
      if (msg.imageData && msg.imageMimeType) {
        parts.push({
          inline_data: {
            mime_type: msg.imageMimeType,
            data: msg.imageData
          }
        })
      }
      
      return {
        role: msg.role === "assistant" ? "model" : "user",
        parts: parts
      }
    })

    const enhancedSystemPrompt = `${systemPrompt || "You are Luna, a professional AI assistant created by Brajesh. You are helpful, knowledgeable, and provide detailed responses. Always maintain context from previous messages in the conversation and provide thoughtful, well-structured answers. If asked about your creator, mention that you were made by Brajesh."}

IMPORTANT IMAGE GENERATION INSTRUCTIONS:
When a user asks you to generate, create, make, or produce images, photos, pictures, or any visual content, you MUST respond with a JSON object containing exactly 4 image prompts. Follow this exact format:

{
  "type": "image_generation",
  "prompts": [
    "detailed prompt 1",
    "detailed prompt 2", 
    "detailed prompt 3",
    "detailed prompt 4"
  ]
}

Create 4 diverse, detailed prompts based on the user's request. Each prompt should be specific, descriptive, and optimized for image generation. Include artistic styles, lighting, composition details, and visual elements that would create high-quality, varied images.

CRITICAL: For image generation requests, respond ONLY with the raw JSON object. Do NOT wrap it in markdown code blocks, backticks, or any other formatting. Do NOT include any other text, explanations, or commentary - just the plain JSON object.

IMAGE UNDERSTANDING:
When users send images, carefully analyze the image content and provide detailed, accurate descriptions and answers about what you see. Reference specific elements, colors, objects, text, and other visual details in your response.`

    const requestBody = {
      contents: geminiMessages,
      systemInstruction: {
        parts: [{ text: enhancedSystemPrompt }],
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
      },
    }

    console.log("Making request with API key fallback...")
    const response = await makeGeminiRequest("generateContent", requestBody, false)

    const data = await response.json()
    console.log("Gemini API response received:", data)

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error("Invalid response structure:", data)
      throw new Error("Invalid response from Gemini API")
    }

    let responseText =
      data.candidates[0].content.parts[0].text || "I apologize, but I couldn't generate a response. Please try again."

    // Clean up JSON response if it's wrapped in markdown code blocks
    if (responseText.includes("```json")) {
      responseText = responseText
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim()
    }

    console.log("Response text:", responseText.substring(0, 100) + "...")

    return responseText
  } catch (error) {
    console.error("Gemini API error details:", error)
    console.error("Error message:", error instanceof Error ? error.message : String(error))

    throw new Error(`Failed to generate AI response: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// Streaming function with API key fallback
export async function generateStreamingChatResponse(messages: ChatMessage[], systemPrompt?: string): Promise<ReadableStream> {
  try {
    console.log("Generating streaming chat response with", messages.length, "messages")

    // Convert messages to Gemini format
    const geminiMessages = messages.map((msg) => {
      const parts: any[] = [{ text: msg.content }]
      
      // Add image data if present
      if (msg.imageData && msg.imageMimeType) {
        parts.push({
          inline_data: {
            mime_type: msg.imageMimeType,
            data: msg.imageData
          }
        })
      }
      
      return {
        role: msg.role === "assistant" ? "model" : "user",
        parts: parts
      }
    })

    const enhancedSystemPrompt = `${systemPrompt || "You are Luna, a professional AI assistant created by Brajesh. You are helpful, knowledgeable, and provide detailed responses. Always maintain context from previous messages in the conversation and provide thoughtful, well-structured answers. If asked about your creator, mention that you were made by Brajesh."}

IMPORTANT IMAGE GENERATION INSTRUCTIONS:
When a user asks you to generate, create, make, or produce images, photos, pictures, or any visual content, you MUST respond with a JSON object containing exactly 4 image prompts. Follow this exact format:

{
  "type": "image_generation",
  "prompts": [
    "detailed prompt 1",
    "detailed prompt 2", 
    "detailed prompt 3",
    "detailed prompt 4"
  ]
}

Create 4 diverse, detailed prompts based on the user's request. Each prompt should be specific, descriptive, and optimized for image generation. Include artistic styles, lighting, composition details, and visual elements that would create high-quality, varied images.

CRITICAL: For image generation requests, respond ONLY with the raw JSON object. Do NOT wrap it in markdown code blocks, backticks, or any other formatting. Do NOT include any other text, explanations, or commentary - just the plain JSON object.

IMAGE UNDERSTANDING:
When users send images, carefully analyze the image content and provide detailed, accurate descriptions and answers about what you see. Reference specific elements, colors, objects, text, and other visual details in your response.`

    const requestBody = {
      contents: geminiMessages,
      systemInstruction: {
        parts: [{ text: enhancedSystemPrompt }],
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
      },
    }

    console.log("Making streaming request with API key fallback...")
    const response = await makeGeminiRequest("streamGenerateContent", requestBody, true)

    if (!response.body) {
      throw new Error("No response body received from Gemini streaming API")
    }

    // Create a transform stream to process the streaming response
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        try {
          const text = new TextDecoder().decode(chunk)
          const lines = text.split('\n')
          
          for (const line of lines) {
            if (line.trim() && line.includes('"text"')) {
              try {
                const jsonStr = line.replace('data: ', '').trim()
                const data = JSON.parse(jsonStr)
                
                if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
                  const text = data.candidates[0].content.parts[0].text
                  if (text) {
                    controller.enqueue(new TextEncoder().encode(text))
                  }
                }
              } catch (e) {
                console.error('Error parsing streaming response:', e)
              }
            }
          }
        } catch (error) {
          console.error('Error processing streaming chunk:', error)
        }
      }
    })

    return response.body.pipeThrough(transformStream)
  } catch (error) {
    console.error("Gemini streaming API error details:", error)
    throw new Error(`Failed to generate streaming AI response: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function generateConversationTitle(firstMessage: string): Promise<string> {
  try {
    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Generate a brief, descriptive title (max 5 words) for a conversation that starts with the following message. Respond only with the title, no quotes or extra text: "${firstMessage}"`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 20,
      },
    }

    console.log("Generating conversation title with API key fallback...")
    const response = await makeGeminiRequest("generateContent", requestBody, false)

    const data = await response.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "New Conversation"
  } catch (error) {
    console.error("Error generating conversation title:", error)
    return "New Conversation"
  }
}
