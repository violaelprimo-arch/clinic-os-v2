'use client'

import { use, useEffect, useState, useRef } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Bot, User, Send, Loader2, Info, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export default function AITrainingPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug

  const [clinicId, setClinicId] = useState<string | null>(null)
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchClinic = async () => {
      const q = query(collection(db, 'clinics'), where('slug', '==', slug))
      const snapshot = await getDocs(q)
      if (!snapshot.empty) {
        const cDoc = snapshot.docs[0]
        setClinicId(cDoc.id)
        const data = cDoc.data()
        setHasApiKey(!!data.aiApiKey)
        setApiKey(data.aiApiKey || '')
        if (data.aiKnowledge && data.aiKnowledge.length > 0) {
          setMessages(data.aiKnowledge)
        } else {
          setMessages([{
            role: 'model',
            text: 'مرحباً دكتور. أنا المساعد الذكي الخاص بعيادتك. يمكنك تزويدي هنا بأي معلومات أو تعليمات ترغب أن أتعلمها للرد على استفسارات المرضى (مثل أوقات الكشف، الأسعار، الإجازات، أو تعليمات الزيارة).'
          }])
        }
      }
    }
    fetchClinic()
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
      toast.error('حدث خطأ أثناء التواصل مع نموذج الذكاء الاصطناعي')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearMemory = async () => {
    if (!clinicId) return
    if (!confirm('هل أنت متأكد من رغبتك في مسح ذاكرة المساعد الذكي؟')) return

    const initial = [{
      role: 'model' as const,
      text: 'تم مسح ذاكرتي بنجاح. أنا جاهز لاستقبال معلومات وتوجيهات جديدة.'
    }]
    setMessages(initial)
    await updateDoc(doc(db, 'clinics', clinicId), { aiKnowledge: initial })
    toast.success('تم مسح ذاكرة المساعد الذكي')
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#182230] flex items-center gap-2">
            <Bot className="w-6 h-6 text-[#15B8A6]" />
            تدريب المساعد الذكي للعيادة
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            تحدث مع المساعد كما تتحدث مع سكرتير العيادة، وسيتعلم الرد على استفسارات المرضى تلقائياً
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleClearMemory}
          className="h-9 text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 rounded-xl"
        >
          <Trash2 className="w-3.5 h-3.5 ml-1" />
          مسح الذاكرة
        </Button>
      </div>

      {!hasApiKey && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block mb-0.5">ملاحظة بشأن مفتاح الذكاء الاصطناعي:</span>
            <span>لم يتم تعيين مفتاح API مباشر لهذه العيادة. يمكنك تدريب وحفظ الذاكرة، ولكن لردود حية للمرضى تأكد من ضبط المفتاح من لوحة المالك.</span>
          </div>
        </div>
      )}

      {/* Chat Container */}
      <div className="medical-card overflow-hidden h-[580px] flex flex-col bg-white">
        
        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#F8FAFC]">
          {messages.map((m, idx) => (
            <div key={idx} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-xs flex items-start gap-3 ${
                  m.role === 'user'
                    ? 'bg-[#15B8A6] text-white rounded-tr-none'
                    : 'bg-white text-slate-800 border border-[#E5EAF0] rounded-tl-none'
                }`}
              >
                {m.role === 'model' && (
                  <div className="w-7 h-7 rounded-lg bg-teal-50 text-[#15B8A6] flex items-center justify-center shrink-0">
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
              <div className="bg-white border border-[#E5EAF0] rounded-2xl rounded-tl-none p-3 shadow-xs flex items-center gap-2 text-xs text-slate-500 font-bold">
                <Loader2 className="w-4 h-4 animate-spin text-[#15B8A6]" />
                جاري استيعاب وتطبيق التعليمات...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <div className="p-4 bg-white border-t border-[#E5EAF0]">
          <form onSubmit={handleSend} className="flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="اكتب تعليمات جديدة للذكاء الاصطناعي (مثال: مواعيد العيادة تبدأ يومياً من الساعة 5 مساءً)..."
              className="h-12 text-xs sm:text-sm rounded-xl bg-[#F6F8FB] border-[#E5EAF0] focus:bg-white"
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="h-12 px-6 font-bold bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-md shadow-[#15B8A6]/20"
            >
              <Send className="w-4 h-4 ml-1.5" />
              إرسال
            </Button>
          </form>
        </div>

      </div>
    </div>
  )
}
