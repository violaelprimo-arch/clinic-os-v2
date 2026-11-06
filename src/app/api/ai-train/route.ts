import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import OpenAI from 'openai'
import { getClinicDoctorAccount } from '@/lib/server/clinic-credential-access'
import { writeDocument } from '@/lib/server/firebase-rest'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { slug, newMessages, action } = body

    if (!slug) {
      return NextResponse.json({ error: 'معرف العيادة مطلوب' }, { status: 400 })
    }

    // Authenticate clinic staff
    const account = await getClinicDoctorAccount(req, slug)
    if (!account.ok) {
      return NextResponse.json({ error: account.error }, { status: account.status })
    }

    const clinicId = account.clinicId

    // Handle clear memory action
    if (action === 'clear') {
      const initial = [
        {
          role: 'model',
          text: 'تم مسح ذاكرة المساعد وتصفير كافة المحادثات والتعليمات السابقة بنجاح. أنا جاهز لتلقي تدريب وتعليمات جديدة.'
        }
      ]
      await writeDocument(`clinics/${clinicId}`, { aiKnowledge: initial }, true)
      return NextResponse.json({ success: true, cleared: true, messages: initial })
    }

    if (!Array.isArray(newMessages) || newMessages.length === 0) {
      return NextResponse.json({ error: 'قائمة الرسائل مطلوبة' }, { status: 400 })
    }

    // Fetch Global AI API Key or environment secret
    let aiApiKey = ''
    try {
      const configSnap = await getDoc(doc(db, 'system', 'config'))
      if (configSnap.exists()) {
        aiApiKey = configSnap.data().globalAiKey || ''
      }
    } catch (e) {
      console.warn('Could not read global AI key from Firestore config:', e)
    }

    if (!aiApiKey) {
      aiApiKey = process.env.OPENAI_API_KEY || ''
    }

    if (!aiApiKey) {
      const fallbackReply = 'تم حفظ تعليماتك الطبية بنجاح في ذاكرة العيادة. (تنبيه: مفتاح OpenAI المركزي يحتاج تفعيل من مالك المنصة لبدء المحادثة الذكية التفاعلية).'
      const finalMessages = [...newMessages, { role: 'model', text: fallbackReply }]
      await writeDocument(`clinics/${clinicId}`, { aiKnowledge: finalMessages }, true)
      return NextResponse.json({ success: true, reply: fallbackReply, finalMessages })
    }

    const systemInstruction = `
أنت الآن "عقل العيادة الذكي"، مساعد ذكاء اصطناعي طبي متقدم.
تتحدث الآن مع (الطبيب أو المساعد في العيادة).
مهمتك:
1. الرد على أي أسئلة طبية أو علمية بشكل دقيق واحترافي.
2. إذا قام الطبيب بإدخال بيانات (مثل سعر كشف أو مواعيد)، قم بتأكيد استلامك لها بأسلوب ذكي وممتع (لأنك تحفظها لترد بها على المرضى لاحقاً).
3. تحدث كزميل طبيب وذكاء اصطناعي متطور، لا تطلب أذونات، فقط أجب وناقش في المجال الطبي أو إداريات العيادة.
4. إجاباتك يجب أن تكون منسقة وواضحة.
`

    const openai = new OpenAI({ apiKey: aiApiKey })

    const formattedMessages: { role: 'user' | 'assistant'; content: string }[] = newMessages.map((msg: any) => ({
      role: msg.role === 'model' || msg.role === 'bot' || msg.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: String(msg.text || msg.content || '')
    }))

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemInstruction },
        ...formattedMessages
      ],
      temperature: 0.5,
      max_tokens: 500
    })

    const replyText = completion.choices[0]?.message?.content || 'عفواً، لم أتمكن من الرد.'
    const finalMessages = [...newMessages, { role: 'model', text: replyText }]

    // Save trained knowledge on the server
    await writeDocument(`clinics/${clinicId}`, { aiKnowledge: finalMessages }, true)

    return NextResponse.json({ success: true, reply: replyText, finalMessages })
  } catch (error: any) {
    console.error('Train API Error:', error)
    return NextResponse.json({
      error: 'خطأ في معالجة طلب الذكاء الاصطناعي: ' + (error.message || 'حدث خطأ أثناء الاتصال.')
    }, { status: 500 })
  }
}
