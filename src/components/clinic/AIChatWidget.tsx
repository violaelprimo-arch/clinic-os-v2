'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Bot, X, Send, User, Loader2, Sparkles } from 'lucide-react'
import { isClinicFeatureEnabled } from '@/lib/featurePermissions'

export function AIChatWidget({ clinic }: { clinic: any }) {
  if (!isClinicFeatureEnabled(clinic, 'ai') || clinic?.aiEnabled === false || clinic?.aiLockedByOwner === true) return null

  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([
    {
      role: 'bot',
      text: `مرحباً بك في عيادة ${clinic?.clinicName || 'الطبيب'}! أنا المساعد الذكي، كيف يمكنني مساعدتك اليوم بخصوص المواعيد أو الخدمات؟`
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
        { role: 'bot', text: 'عذراً، لم أتمكن من الرد في الوقت الحالي. يرجى مراجعة العيادة مباشرة.' }
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
          className="fixed bottom-6 left-6 w-14 h-14 rounded-full shadow-2xl bg-[#087CF4] hover:bg-[#0769D1] text-white z-50 flex items-center justify-center transition-all hover:scale-110 active:scale-95 group cursor-pointer border-2 border-white"
          title="تحدث مع المساعد الذكي"
        >
          <Bot className="w-7 h-7" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full border-2 border-white flex items-center justify-center text-[9px] text-slate-900 font-black animate-pulse">
            !
          </span>
        </button>
      )}

      {/* Floating Chat Modal */}
      {isOpen && (
        <div
          className="fixed bottom-6 left-6 w-84 sm:w-96 shadow-2xl z-50 bg-card border border-border flex flex-col h-[520px] max-h-[85vh] rounded-3xl overflow-hidden font-sans text-foreground"
          dir="rtl"
        >
          {/* Header */}
          <div className="yalla-gradient-btn text-white px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 text-white flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">المساعد الذكي للعيادة</h3>
                <span className="text-[10px] text-white/80 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  متصل ومتاح للرد فوراً
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
                  جاري صياغة الإجابة...
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
                placeholder="اسألني أي سؤال عن العيادة..."
                className="h-11 pr-3 pl-11 text-xs bg-secondary/60 border-border rounded-xl focus:bg-card text-foreground"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
                className="absolute left-1 top-1 w-9 h-9 yalla-gradient-btn text-white rounded-lg"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
