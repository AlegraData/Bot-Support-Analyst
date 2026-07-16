import { BOT_SYSTEM_PROMPT } from './constants'
import type { EvaluationResult } from './types'

export const LLM_PROVIDER = {
  id: 'litellm-alegra',
  displayName: 'LiteLLM Alegra',
  baseUrl: process.env.LITELLM_BASE_URL || 'https://almost-litellm.alegra.com/v1',
  // La key solo permite modelos con el patron deepseek/* (prefijo obligatorio)
  model: 'deepseek/deepseek-chat',
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletionResponse {
  choices: {
    message: { role: string; content: string | null }
    finish_reason: string
  }[]
}

export async function sendMessageToLLM(
  history: ChatMessage[],
  newUserMessage: string
): Promise<{ text: string; evaluation: EvaluationResult | null; isComplete: boolean }> {
  const res = await fetch(`${LLM_PROVIDER.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LITELLM_API_KEY || ''}`,
    },
    body: JSON.stringify({
      model: LLM_PROVIDER.model,
      messages: [
        { role: 'system', content: BOT_SYSTEM_PROMPT },
        ...history,
        { role: 'user', content: newUserMessage },
      ],
      temperature: 0.8,
      top_p: 0.95,
      max_tokens: 4096,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`[${LLM_PROVIDER.id}] HTTP ${res.status}: ${body}`)
  }

  const data = (await res.json()) as ChatCompletionResponse
  const rawText = data.choices?.[0]?.message?.content ?? ''

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

export function buildChatHistory(
  messages: { role: string; content: string }[]
): ChatMessage[] {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: m.content,
    }))
}
