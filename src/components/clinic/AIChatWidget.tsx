'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Bot, X, Send, User, Loader2, Sparkles } from 'lucide-react'
import { isClinicFeatureEnabled } from '@/lib/featurePermissions'
import { useLanguage } from '@/context/LanguageContext'

export function AIChatWidget({ clinic }: { clinic: any }) {
  if (!isClinicFeatureEnabled(clinic, 'ai') || clinic?.aiEnabled === false || clinic?.aiLockedByOwner === true) return null

  const { dir, t, isRtl } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([
    {
      role: 'bot',
      text: isRtl
        ? `مرحباً بك في عيادة ${clinic?.clinicName || 'الطبيب'}! أنا المساعد الذكي، كيف يمكنني مساعدتك اليوم بخصوص المواعيد أو الخدمات؟`
        : `Welcome to ${clinic?.clinicName || 'the clinic'}! I am the smart assistant, how can I assist you today with appointments or services?`
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim()) return

    const userText = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userText }])
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          aiKnowledge: clinic?.aiKnowledge || [],
          clinicId: clinic?.id,
          clinicPhone: clinic?.clinicPhone || clinic?.clinicPhones?.[0] || clinic?.doctorPhone || ''
        })
      })

      const data = await res.json()
      setMessages(prev => [...prev, { role: 'bot', text: data.reply }])
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'bot',
          text: isRtl
            ? 'عذراً، لم أتمكن من الرد في الوقت الحالي. يرجى مراجعة العيادة مباشرة.'
            : 'Sorry, I was unable to reply right now. Please contact the clinic directly.'
        }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {/* Floating Action Bubble */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 rtl:left-6 ltr:right-6 w-14 h-14 rounded-full shadow-2xl bg-primary hover:bg-primary-hover text-white z-50 flex items-center justify-center transition-all hover:scale-110 active:scale-95 group cursor-pointer border-2 border-background"
          title={isRtl ? 'تحدث مع المساعد الذكي' : 'Chat with AI Assistant'}
        >
          <Bot className="w-7 h-7" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full border-2 border-background flex items-center justify-center text-[9px] text-slate-900 font-black animate-pulse">
            !
          </span>
        </button>
      )}

      {/* Floating Chat Modal */}
      {isOpen && (
        <div
          className="fixed bottom-6 rtl:left-6 ltr:right-6 w-84 sm:w-96 shadow-2xl z-50 bg-card border border-border flex flex-col h-[520px] max-h-[85vh] rounded-3xl overflow-hidden font-sans text-foreground"
          dir={dir}
        >
          {/* Header */}
          <div className="yalla-gradient-btn text-white px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 text-white flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">{isRtl ? 'المساعد الذكي للعيادة' : 'Clinic AI Assistant'}</h3>
                <span className="text-[10px] text-white/80 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  {isRtl ? 'متصل ومتاح للرد فوراً' : 'Online & ready to help'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-xs ${
                    m.role === 'user'
                      ? 'yalla-gradient-btn text-white rounded-tr-none'
                      : 'bg-card text-foreground border border-border rounded-tl-none font-medium'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-end">
                <div className="bg-card border border-border rounded-2xl rounded-tl-none p-3 shadow-xs flex items-center gap-2 text-xs text-muted-foreground font-bold">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  {isRtl ? 'جاري صياغة الإجابة...' : 'Formulating answer...'}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-card border-t border-border">
            <form onSubmit={handleSend} className="flex gap-2 relative">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={isRtl ? 'اسألني أي سؤال عن العيادة...' : 'Ask any question about the clinic...'}
                className="h-11 rtl:pr-3 rtl:pl-11 ltr:pl-3 ltr:pr-11 text-xs bg-secondary/60 border-border rounded-xl focus:bg-card text-foreground"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
                className="absolute rtl:left-1 ltr:right-1 top-1 w-9 h-9 yalla-gradient-btn text-white rounded-lg"
              >
                <Send className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
