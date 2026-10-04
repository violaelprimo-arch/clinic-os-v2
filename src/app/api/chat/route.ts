import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import OpenAI from 'openai'

export async function POST(request: Request) {
  try {
    const { message, aiKnowledge } = await request.json()

    // Securely fetch Global API Key from Firestore on the server
    const configSnap = await getDoc(doc(db, 'system', 'config'));
    let aiApiKey = '';
    if (configSnap.exists()) {
      aiApiKey = configSnap.data().globalAiKey || '';
    }

    if (!aiApiKey) {
      aiApiKey = process.env.OPENAI_API_KEY || '';
    }

    if (!aiApiKey) {
      return NextResponse.json({ reply: 'يجب على مالك المنصة إعداد مفتاح الذكاء الاصطناعي (OpenAI) المركزي من لوحة التحكم.' })
    }

    const systemPrompt = `
أنت المساعد الذكي الرسمي للعيادة.
سترد على استفسارات المرضى بأسلوب احترافي وودود جداً.
هذه هي معلومات العيادة وتعليمات الطبيب (Knowledge Base):
${JSON.stringify(aiKnowledge || [])}

قواعد صارمة:
1. أجب فقط بناءً على المعلومات المتوفرة في سجل التعليمات أعلاه.
2. إذا سأل المريض عن شيء غير موجود في السجل، اعتذر بلطف واطلب منه التواصل مع العيادة.
3. لا تخترع أي أسعار أو مواعيد غير موجودة.
4. إجابتك يجب أن تكون قصيرة ومباشرة ومفيدة للمريض.
`

    const openai = new OpenAI({ apiKey: aiApiKey });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      temperature: 0.3,
      max_tokens: 250
    });

    const replyText = completion.choices[0].message.content || 'لم أتمكن من الرد.';
    return NextResponse.json({ reply: replyText });

  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ reply: 'خطأ من الذكاء الاصطناعي (OpenAI): ' + (error.message || 'حدث خطأ في الخادم.') });
  }
}
