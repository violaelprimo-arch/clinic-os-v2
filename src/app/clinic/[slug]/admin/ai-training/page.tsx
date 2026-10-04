'use client'

import { use, useEffect, useState, useRef } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Bot, User, Send, Loader2, Info } from 'lucide-react'
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
        // If there's an existing knowledge base, load it. Otherwise, start fresh.
        if (data.aiKnowledge && data.aiKnowledge.length > 0) {
          setMessages(data.aiKnowledge)
        } else {
          setMessages([{
            role: 'model',
            text: 'مرحباً دكتور. أنا المساعد الذكي الخاص بعيادتك. يمكنك هنا تزويدي بأي معلومات ترغب أن أتعلمها لأرد بها على استفسارات المرضى (مثل أسعار الكشف، المواعيد، الإجازات، أو أي تعليمات خاصة).'
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
      // Save instantly so if they close, it's not lost
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
      toast.error('حدث خطأ في الاتصال بالذكاء الاصطناعي')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearMemory = async () => {
    if (!clinicId) return
    if (!confirm('هل أنت متأكد من مسح ذاكرة الذكاء الاصطناعي؟ سينسى كل التعليمات السابقة.')) return

    const initial = [{
      role: 'model' as const,
      text: 'تم مسح ذاكرتي بنجاح. أنا جاهز لتلقي معلومات جديدة.'
    }]
    setMessages(initial)
    await updateDoc(doc(db, 'clinics', clinicId), { aiKnowledge: initial })
    toast.success('تم مسح الذاكرة')
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
          <Bot className="w-8 h-8" /> تدريب المساعد الذكي
        </h1>
        <p className="text-slate-500 mt-2">
          تحدث معي كما تتحدث مع السكرتير الخاص بك. أخبرني بتعليماتك، وسأقوم بالرد على أسئلة المرضى نيابة عنك.
        </p>
      </div>

      {!hasApiKey && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-amber-800">
          <Info className="w-6 h-6 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold">تنبيه: مفتاح التشغيل غير متوفر</h4>
            <p className="text-sm">لم يقم مالك المنصة بتكوين مفتاح Gemini API لهذه العيادة. لن يتمكن المساعد من العمل بشكل حي حتى يتم ربط المفتاح من لوحة تحكم المالك.</p>
          </div>
        </div>
      )}

      <Card className="shadow-2xl border-t-4 border-t-primary h-[600px] flex flex-col">
        <CardHeader className="border-b bg-slate-50/50 flex flex-row justify-between items-center py-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" /> عقل الذكاء الاصطناعي للعيادة
          </CardTitle>
          <Button variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs font-bold h-8" onClick={handleClearMemory}>
            مسح الذاكرة
          </Button>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/30">
          {messages.map((m, idx) => (
            <div key={idx} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm flex items-start gap-3 ${
                m.role === 'user' 
                  ? 'bg-primary text-white rounded-tr-none' 
                  : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
              }`}>
                {m.role === 'model' && <Bot className="w-5 h-5 mt-0.5 text-primary shrink-0" />}
                {m.role === 'user' && <User className="w-5 h-5 mt-0.5 opacity-70 shrink-0" />}
                <div>{m.text}</div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-end">
              <div className="bg-white border rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm text-slate-500 font-bold">جاري استيعاب المعلومات...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        <CardFooter className="p-4 bg-white border-t">
          <form onSubmit={handleSend} className="flex w-full gap-3 relative">
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب معلومة جديدة للذكاء الاصطناعي (مثال: سعر الكشف العادي 300 جنيه)..."
              className="pr-4 pl-12 h-14 bg-slate-50 border-slate-200 focus:border-primary text-base rounded-xl"
              disabled={isLoading || !hasApiKey}
            />
            <Button 
              type="submit" 
              size="icon" 
              disabled={!input.trim() || isLoading || !hasApiKey}
              className="absolute left-2 top-2 w-10 h-10 bg-primary hover:bg-primary/90 rounded-lg text-white transition-transform active:scale-95"
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  )
}
