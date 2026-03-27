export type Role = 'admin' | 'candidate'

export interface SessionData {
  email: string
  role: Role
  name?: string
  candidateId?: string
  challengeId?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface EvaluationResult {
  score: number
  feedback: string
  strengths: string[]
  improvements: string[]
}

export interface FullMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

export interface CandidateFullDetail {
  id: string
  name: string
  email: string
  teamtailorId: string
  status: string
  createdAt: string
  challenges: Array<{
    id: string
    score: number | null
    feedback: string | null
    strengths: string[]
    improvements: string[]
    completedAt: string | null
    createdAt: string
    messages: FullMessage[]
  }>
}

export interface CandidateWithChallenge {
  id: string
  name: string
  email: string
  teamtailorId: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
  createdAt: string
  updatedAt: string
  challenges: {
    id: string
    score: number | null
    feedback: string | null
    strengths: string[]
    improvements: string[]
    completedAt: string | null
    createdAt: string
    _count?: { messages: number }
  }[]
}
