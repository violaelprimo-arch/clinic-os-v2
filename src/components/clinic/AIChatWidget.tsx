'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Bot, X, Send, User, Loader2 } from 'lucide-react'

export function AIChatWidget({ clinic }: { clinic: any }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([
    { role: 'bot', text: `مرحباً بك في عيادة ${clinic?.clinicName || 'الطبيب'}! أنا المساعد الذكي، كيف يمكنني مساعدتك اليوم؟` }
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
          aiApiKey: clinic?.aiApiKey || '',
          aiInstructions: clinic?.aiInstructions || ''
        })
      })
      
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'bot', text: data.reply }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: 'عذراً، لم أتمكن من الرد. يرجى المحاولة لاحقاً.' }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <Button 
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-2xl bg-teal-600 hover:bg-teal-700 text-white z-50 flex items-center justify-center animate-bounce hover:animate-none"
        >
          <Bot className="w-8 h-8" />
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-80 md:w-96 shadow-2xl z-50 border-t-4 border-t-teal-600 flex flex-col h-[500px] max-h-[80vh] overflow-hidden rounded-2xl" dir="rtl">
          <CardHeader className="bg-teal-50 border-b pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-teal-800 flex items-center gap-2 text-lg">
              <Bot className="w-5 h-5 text-teal-600" />
              المساعد الذكي للعيادة
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8 text-slate-500 hover:bg-teal-100">
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed shadow-sm ${
                  m.role === 'user' 
                    ? 'bg-primary text-white rounded-tr-none' 
                    : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-end">
                <div className="bg-white border rounded-2xl rounded-tl-none p-3 shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                  <span className="text-xs text-slate-500">جاري التفكير...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </CardContent>

          <CardFooter className="p-3 bg-white border-t">
            <form onSubmit={handleSend} className="flex w-full gap-2 relative">
              <Input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="اسألني أي سؤال عن العيادة..."
                className="pr-4 pl-10 h-12 bg-slate-50 border-slate-200 focus:border-teal-500 focus:ring-teal-500/20"
                disabled={isLoading}
              />
              <Button 
                type="submit" 
                size="icon" 
                disabled={!input.trim() || isLoading}
                className="absolute left-1 top-1 w-10 h-10 bg-teal-600 hover:bg-teal-700 rounded-lg text-white transition-transform active:scale-95"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}
    </>
  )
}
