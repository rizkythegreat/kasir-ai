import { NextResponse } from 'next/server'
import { llm } from '@/lib/ai/langchain'
import { StringOutputParser } from '@langchain/core/output_parsers'

export async function GET() {
  try {
    const parser = new StringOutputParser()

    const response = await llm.pipe(parser).invoke(
      'Jawab dalam 1 kalimat: Apa fungsi utama sistem kasir?'
    )

    return NextResponse.json({
      status: 'ok',
      message: 'LangChain is working!',
      aiResponse: response
    })
  } catch (error: any) {
    console.error('AI Test Error:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: error.message,
        hint: 'Pastikan GEMINI_API_KEY sudah di-set di .env.local'
      },
      { status: 500 }
    )
  }
}