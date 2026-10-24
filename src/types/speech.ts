export type DictationLanguage = 'ar-EG' | 'en-US'

export type DictationStatus = 'idle' | 'listening' | 'processing' | 'error'

export interface DictationError {
  code: string
  message: string
}

export interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

export interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  [index: number]: SpeechRecognitionAlternative
}

export interface SpeechRecognitionResultList {
  length: number
  [index: number]: SpeechRecognitionResult
}

export interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

export interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}

export interface ISpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onstart: ((this: ISpeechRecognition, ev: Event) => any) | null
  onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
  onerror: ((this: ISpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null
  onend: ((this: ISpeechRecognition, ev: Event) => any) | null
  onspeechstart?: ((this: ISpeechRecognition, ev: Event) => any) | null
  onspeechend?: ((this: ISpeechRecognition, ev: Event) => any) | null
}

declare global {
  interface Window {
    SpeechRecognition?: {
      new (): ISpeechRecognition
    }
    webkitSpeechRecognition?: {
      new (): ISpeechRecognition
    }
  }
}
