'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  DictationLanguage,
  DictationStatus,
  ISpeechRecognition,
  SpeechRecognitionEvent,
  SpeechRecognitionErrorEvent
} from '@/types/speech'

/**
 * Safely joins prefix, spoken text, and suffix without duplicating spaces or words.
 */
export function composeDictatedText(
  prefix: string,
  spokenText: string,
  suffix: string
): string {
  const cleanSpoken = spokenText.trim()
  if (!cleanSpoken) {
    return prefix + suffix
  }

  let result = prefix
  if (result.length > 0 && !result.endsWith(' ') && !result.endsWith('\n')) {
    result += ' '
  }
  result += cleanSpoken

  if (suffix.length > 0) {
    if (
      !result.endsWith(' ') &&
      !result.endsWith('\n') &&
      !suffix.startsWith(' ') &&
      !suffix.startsWith('\n')
    ) {
      result += ' '
    }
    result += suffix
  }

  return result
}

// -----------------------------------------------------------------------------
// Global Singleton Session Coordinator
// Ensures ONLY ONE microphone session is active at any time across the app.
// -----------------------------------------------------------------------------
interface ActiveSession {
  sessionId: string
  fieldId: string
  recognition: ISpeechRecognition
  stop: () => void
  abort: () => void
  epoch: number
}

let globalActiveSession: ActiveSession | null = null
let globalActiveStatus: DictationStatus = 'idle'
let globalEpoch = 0
const listeners = new Set<() => void>()

function notifyListeners() {
  listeners.forEach(fn => {
    try {
      fn()
    } catch {}
  })
}

/**
 * Public function to immediately stop any active microphone session.
 * Used when changing patient, switching prescriptions, or navigating away.
 */
export function stopGlobalVoiceDictation() {
  if (globalActiveSession) {
    try {
      globalActiveSession.stop()
    } catch {
      try {
        globalActiveSession.abort()
      } catch {}
    }
    globalActiveSession = null
    globalActiveStatus = 'idle'
    globalEpoch++
    notifyListeners()
  }
}

/**
 * Returns whether speech recognition is supported in the current browser.
 */
export function checkSpeechRecognitionSupport(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export interface StartDictationOptions {
  fieldId: string
  currentValue: string
  onTextChange: (newText: string) => void
  cursorStart?: number | null
  cursorEnd?: number | null
  language?: DictationLanguage
}

export function useVoiceDictation() {
  const [isSupported, setIsSupported] = useState<boolean>(false)
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null)
  const [status, setStatus] = useState<DictationStatus>('idle')
  const [interimText, setInterimText] = useState<string>('')
  const [language, setLanguage] = useState<DictationLanguage>('ar-EG')

  // Sync with global coordinator
  useEffect(() => {
    setIsSupported(checkSpeechRecognitionSupport())

    const handleGlobalChange = () => {
      if (globalActiveSession) {
        setActiveFieldId(globalActiveSession.fieldId)
      } else {
        setActiveFieldId(null)
        setStatus('idle')
        setInterimText('')
      }
    }

    listeners.add(handleGlobalChange)
    return () => {
      listeners.delete(handleGlobalChange)
    }
  }, [])

  // Cleanup on unmount: stop recording if this component instance unmounts
  useEffect(() => {
    return () => {
      // Do not stop if another component instance is managing the active session
    }
  }, [])

  const toggleLanguage = useCallback(() => {
    setLanguage(prev => (prev === 'ar-EG' ? 'en-US' : 'ar-EG'))
  }, [])

  const stop = useCallback(() => {
    stopGlobalVoiceDictation()
  }, [])

  const start = useCallback(
    (options: StartDictationOptions) => {
      if (typeof window === 'undefined') return

      const SpeechConstructor =
        window.SpeechRecognition || window.webkitSpeechRecognition

      if (!SpeechConstructor) {
        toast.error(
          'المتصفح الحالي لا يدعم ميزة الإملاء الصوتي (Web Speech API). يُنصح باستخدام Google Chrome أو Microsoft Edge أو Safari.'
        )
        return
      }

      // 1. Terminate any previous session before starting a new one
      stopGlobalVoiceDictation()

      const sessionEpoch = ++globalEpoch
      const sessionId = `rx_dictation_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      const chosenLang = options.language || language

      // 2. Snapshot current text boundaries at insertion point
      const initialValue = options.currentValue || ''
      const safeCursorStart =
        options.cursorStart !== undefined &&
        options.cursorStart !== null &&
        options.cursorStart >= 0 &&
        options.cursorStart <= initialValue.length
          ? options.cursorStart
          : initialValue.length

      const safeCursorEnd =
        options.cursorEnd !== undefined &&
        options.cursorEnd !== null &&
        options.cursorEnd >= safeCursorStart &&
        options.cursorEnd <= initialValue.length
          ? options.cursorEnd
          : safeCursorStart

      const prefix = initialValue.substring(0, safeCursorStart)
      const suffix = initialValue.substring(safeCursorEnd)

      let recognitionInstance: ISpeechRecognition
      try {
        recognitionInstance = new SpeechConstructor()
      } catch (err) {
        toast.error('تعذر تهيئة محرك التعرف على الصوت.')
        return
      }

      recognitionInstance.continuous = true
      recognitionInstance.interimResults = true
      recognitionInstance.lang = chosenLang
      recognitionInstance.maxAlternatives = 1

      // Register active session
      globalActiveSession = {
        sessionId,
        fieldId: options.fieldId,
        recognition: recognitionInstance,
        epoch: sessionEpoch,
        stop: () => {
          try {
            recognitionInstance.stop()
          } catch {
            try {
              recognitionInstance.abort()
            } catch {}
          }
        },
        abort: () => {
          try {
            recognitionInstance.abort()
          } catch {}
        }
      }

      setActiveFieldId(options.fieldId)
      setStatus('listening')
      setInterimText('')
      notifyListeners()

      recognitionInstance.onstart = () => {
        if (
          globalActiveSession?.sessionId !== sessionId ||
          globalEpoch !== sessionEpoch
        ) {
          return
        }
        setStatus('listening')
        notifyListeners()
      }

      recognitionInstance.onspeechstart = () => {
        if (
          globalActiveSession?.sessionId !== sessionId ||
          globalEpoch !== sessionEpoch
        ) {
          return
        }
        setStatus('listening')
      }

      recognitionInstance.onspeechend = () => {
        if (
          globalActiveSession?.sessionId !== sessionId ||
          globalEpoch !== sessionEpoch
        ) {
          return
        }
        // Processing the speech received
        setStatus('processing')
      }

      recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
        if (
          globalActiveSession?.sessionId !== sessionId ||
          globalEpoch !== sessionEpoch
        ) {
          return // stale event from aborted session
        }

        setStatus('listening')

        let sessionFinalChunk = ''
        let sessionInterimChunk = ''

        // Iterate through all speech segments in the current session
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i]
          const chunk = res[0]?.transcript || ''
          if (res.isFinal) {
            sessionFinalChunk += (sessionFinalChunk ? ' ' : '') + chunk.trim()
          } else {
            sessionInterimChunk += (sessionInterimChunk ? ' ' : '') + chunk.trim()
          }
        }

        setInterimText(sessionInterimChunk)

        // Combine finalized and interim spoken words cleanly
        const spoken = [sessionFinalChunk.trim(), sessionInterimChunk.trim()]
          .filter(Boolean)
          .join(' ')

        const updatedText = composeDictatedText(prefix, spoken, suffix)
        options.onTextChange(updatedText)
      }

      recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (
          globalActiveSession?.sessionId !== sessionId ||
          globalEpoch !== sessionEpoch
        ) {
          return
        }

        const errorCode = event.error || 'unknown'

        // 'aborted' is intentional when user stops or switches field
        if (errorCode === 'aborted') {
          setStatus('idle')
          setInterimText('')
          return
        }

        setStatus('error')

        switch (errorCode) {
          case 'not-allowed':
          case 'service-not-allowed':
            toast.error(
              'تم رفض إذن استخدام الميكروفون. يرجى تفعيل الإذن من إعدادات المتصفح (أيقونة القفل في شريط العنوان) ثم المحاولة مجددًا.'
            )
            break
          case 'audio-capture':
            toast.error(
              'لم يتم العثور على ميكروفون متصل بالجهاز. يرجى توصيل ميكروفون والتأكد من إعدادات الصوت.'
            )
            break
          case 'no-speech':
            toast.info(
              'لم يتم التقاط أي صوت، يرجى التحدث بوضوح بالقرب من الميكروفون والمحاولة مرة أخرى.'
            )
            break
          case 'network':
            toast.error(
              'تعذر الاتصال بخدمة التعرف على الصوت. يتطلب تحويل الصوت اتصالاً بالإنترنت في المتصفح الحالي.'
            )
            break
          case 'language-not-supported':
            toast.error(
              `لغة الإملاء المحددة (${chosenLang}) غير مدعومة في محرك الصوت لهذا المتصفح.`
            )
            break
          default:
            toast.error(`حدث خطأ أثناء الإملاء الصوتي: ${errorCode}`)
            break
        }
      }

      recognitionInstance.onend = () => {
        if (
          globalActiveSession?.sessionId === sessionId &&
          globalEpoch === sessionEpoch
        ) {
          globalActiveSession = null
          setActiveFieldId(null)
          setStatus('idle')
          setInterimText('')
          notifyListeners()
        }
      }

      try {
        recognitionInstance.start()
      } catch (err) {
        toast.error('تعذر بدء الاستماع الصوتي.')
        globalActiveSession = null
        setActiveFieldId(null)
        setStatus('idle')
        notifyListeners()
      }
    },
    [language]
  )

  return {
    isSupported,
    activeFieldId,
    status,
    interimText,
    language,
    setLanguage,
    toggleLanguage,
    start,
    stop,
    stopAll: stopGlobalVoiceDictation
  }
}
