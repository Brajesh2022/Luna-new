import { NextResponse } from "next/server"
import { testGeminiAPI } from "@/lib/test-gemini"

export async function GET() {
  try {
    const result = await testGeminiAPI()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    )
  }
}