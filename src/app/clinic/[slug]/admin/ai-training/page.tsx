'use client'

import { use, useEffect, useState, useRef } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, updateDoc, doc, onSnapshot } from 'firebase/firestore'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Bot, User, Send, Loader2, Info, Sparkles, Trash2, AlertTriangle, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useLanguage } from '@/context/LanguageContext'

export default function AITrainingPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const { t, dir } = useLanguage()

  const [clinicId, setClinicId] = useState<string | null>(null)
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [aiEnabled, setAiEnabled] = useState(true)
  const [aiResponsesCount, setAiResponsesCount] = useState<number>(0)
  const [aiResponsesLimit, setAiResponsesLimit] = useState<number>(100)
  const [clinic, setClinic] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = query(collection(db, 'clinics'), where('slug', '==', slug))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const cDoc = snapshot.docs[0]
          setClinicId(cDoc.id)
          const data = cDoc.data()
          setClinic({ id: cDoc.id, ...data })
          setHasApiKey(!!data.aiApiKey)
          setApiKey(data.aiApiKey || '')
          setAiEnabled(data.aiEnabled !== false)
          setAiResponsesCount(Number(data.aiResponsesCount || 0))
          setAiResponsesLimit(Number(data.aiResponsesLimit ?? 100))
          if (data.aiKnowledge && data.aiKnowledge.length > 0) {
            setMessages(data.aiKnowledge)
          } else {
            setMessages([{
              role: 'model',
              text: t('ai_welcome_initial')
            }])
          }
        }
      },
      (err) => {
        console.error(err)
      }
    )

    return () => unsubscribe()
  }, [slug])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !clinicId) return

    const userText = input.trim()
    setInput('')

    const newMessages = [...messages, { role: 'user' as const, text: userText }]
    setMessages(newMessages)
    setIsLoading(true)

    try {
      await updateDoc(doc(db, 'clinics', clinicId), { aiKnowledge: newMessages })

      const res = await fetch('/api/ai-train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, newMessages })
      })

      const data = await res.json()

      if (data.reply) {
        const finalMessages = [...newMessages, { role: 'model' as const, text: data.reply }]
        setMessages(finalMessages)
        await updateDoc(doc(db, 'clinics', clinicId), { aiKnowledge: finalMessages })
      }
    } catch (err) {
      toast.error(t('ai_error_model'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearMemory = async () => {
    if (!clinicId) return
    if (!confirm(t('ai_confirm_clear'))) return

    const initial = [{
      role: 'model' as const,
      text: t('ai_cleared_msg')
    }]
    setMessages(initial)
    await updateDoc(doc(db, 'clinics', clinicId), { aiKnowledge: initial })
    toast.success(t('ai_cleared_toast'))
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6" dir={dir}>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            {t('ai_training_title')}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('ai_training_subtitle')}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleClearMemory}
          className="h-9 text-xs font-bold text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/10 rounded-xl"
        >
          <Trash2 className="w-3.5 h-3.5 mx-1" />
          {t('clear_memory')}
        </Button>
      </div>

      {/* AI Usage Quota Card */}
      <div className="yalla-card p-5 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">{t('ai_quota_title')}</h3>
              <p className="text-xs text-muted-foreground">
                {t('ai_quota_desc')}
              </p>
            </div>
          </div>

          <div className="text-start">
            <div className="flex items-baseline gap-1 font-mono font-black" dir="ltr">
              <span className={`text-xl ${aiResponsesCount >= aiResponsesLimit ? 'text-rose-600 dark:text-rose-400' : 'text-primary'}`}>
                {aiResponsesCount}
              </span>
              <span className="text-xs text-muted-foreground">/ {aiResponsesLimit} {t('responses_unit')}</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-bold block text-start">
              {aiResponsesCount >= aiResponsesLimit
                ? t('responses_consumed_full')
                : `${t('responses_remaining')} ${Math.max(0, aiResponsesLimit - aiResponsesCount)} ${t('responses_unit')}`}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              aiResponsesCount >= aiResponsesLimit
                ? 'bg-rose-500'
                : (aiResponsesCount / aiResponsesLimit) >= 0.8
                ? 'bg-amber-400'
                : 'bg-primary'
            }`}
            style={{ width: `${Math.min(100, Math.round((aiResponsesCount / Math.max(1, aiResponsesLimit)) * 100))}%` }}
          />
        </div>

        {/* Limit Warning */}
        {aiResponsesCount >= aiResponsesLimit && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{t('ai_quota_exhausted_alert')}</span>
            </div>
          </div>
        )}
      </div>

      {!aiEnabled && (
        <div className="p-4 rounded-2xl bg-muted/60 border border-border text-foreground text-xs font-semibold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <span className="font-bold block text-foreground">{t('ai_disabled_in_clinic')}</span>
              <span className="text-muted-foreground">{t('ai_disabled_hint')}</span>
            </div>
          </div>
          <Link href={`/clinic/${slug}/admin/settings`}>
            <Button size="sm" variant="outline" className="h-8 text-xs font-bold rounded-lg border-border">
              {t('go_to_settings')}
              <ArrowLeft className="w-3.5 h-3.5 mx-1 rtl:rotate-0 ltr:rotate-180" />
            </Button>
          </Link>
        </div>
      )}

      {!hasApiKey && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block mb-0.5">{t('ai_api_key_note')}</span>
            <span>{t('ai_api_key_desc')}</span>
          </div>
        </div>
      )}

      {/* Chat Container */}
      <div className="yalla-card overflow-hidden h-[580px] flex flex-col">
        
        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-muted/20">
          {messages.map((m, idx) => (
            <div key={idx} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-xs flex items-start gap-3 ${
                  m.role === 'user'
                    ? 'yalla-gradient-btn text-white rounded-tr-none'
                    : 'bg-card text-card-foreground border border-border rounded-tl-none'
                }`}
              >
                {m.role === 'model' && (
                  <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                {m.role === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
                <div className="pt-0.5">{m.text}</div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-end">
              <div className="bg-card border border-border rounded-2xl rounded-tl-none p-3 shadow-xs flex items-center gap-2 text-xs text-muted-foreground font-bold">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                {t('ai_learning_loader')}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <div className="p-4 bg-card border-t border-border">
          <form onSubmit={handleSend} className="flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={t('ai_input_placeholder')}
              className="h-12 text-xs sm:text-sm rounded-xl bg-background border-border"
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="h-12 px-6 font-bold yalla-gradient-btn text-white rounded-xl shadow-xs"
            >
              <Send className="w-4 h-4 mx-1.5 rtl:rotate-0 ltr:rotate-180" />
              {t('send')}
            </Button>
          </form>
        </div>

      </div>
    </div>
  )
}
