import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { BOT_SYSTEM_PROMPT } from './constants'
import type { EvaluationResult } from './types'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
]

export interface GeminiMessage {
  role: 'user' | 'model'
  parts: { text: string }[]
}

export async function sendMessageToGemini(
  history: GeminiMessage[],
  newUserMessage: string
): Promise<{ text: string; evaluation: EvaluationResult | null; isComplete: boolean }> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: BOT_SYSTEM_PROMPT,
    safetySettings,
    generationConfig: {
      temperature: 0.8,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    },
  })

  const chat = model.startChat({ history })
  const result = await chat.sendMessage(newUserMessage)
  const rawText = result.response.text()

  const evalMatch = rawText.match(/\[EVALUATION_RESULT\]([\s\S]*?)\[\/EVALUATION_RESULT\]/)

  let evaluation: EvaluationResult | null = null
  let cleanText = rawText

  if (evalMatch) {
    try {
      evaluation = JSON.parse(evalMatch[1].trim()) as EvaluationResult
      cleanText = rawText.replace(/\[EVALUATION_RESULT\][\s\S]*?\[\/EVALUATION_RESULT\]/, '').trim()
    } catch {
      evaluation = null
    }
  }

  return {
    text: cleanText,
    evaluation,
    isComplete: evaluation !== null,
  }
}

export function buildGeminiHistory(
  messages: { role: string; content: string }[]
): GeminiMessage[] {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
}
