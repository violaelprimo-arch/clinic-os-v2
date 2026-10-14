import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore'
import OpenAI from 'openai'
import { createClinicNotification } from '@/lib/notificationService'

export async function POST(request: Request) {
  try {
    const { message, aiKnowledge, clinicId, clinicPhone } = await request.json()

    // 1. Quota & Limit Enforcement
    if (clinicId) {
      const clinicRef = doc(db, 'clinics', clinicId)
      const clinicSnap = await getDoc(clinicRef)
      if (clinicSnap.exists()) {
        const cData = clinicSnap.data()
        
        // If AI is disabled by owner
        if (cData.aiEnabled === false) {
          return NextResponse.json({
            reply: 'خدمة المساعد الذكي معطلة لهذه العيادة حالياً. يرجى التواصل مع العيادة هاتفياً أو عبر واتساب مباشرة.'
          })
        }

        const limit = Number(cData.aiResponsesLimit ?? 100)
        const count = Number(cData.aiResponsesCount ?? 0)

        // If limit is reached: bot is disabled, instruct patient, and notify doctor!
        if (count >= limit) {
          try {
            await createClinicNotification({
              clinicId,
              recipientType: 'staff',
              recipientTarget: clinicId,
              type: 'system',
              title: '⚠️ تنبيه: انتهاء رصيد ردود المساعد الذكي (AI Bot)',
              body: `لقد تم استهلاك كامل رصيد الردود المخصص لعيادتكم (${limit} رد). تم إيقاف المساعد الذكي تلقائياً لحين تجديد الباقة أو زيادة الرصيد من مالك المنصة.`,
              eventId: `ai_quota_${clinicId}_${Math.floor(Date.now() / (1000 * 60 * 60 * 12))}`
            })
          } catch (notifErr) {
            console.warn('Failed to send quota notification:', notifErr)
          }

          const contactPhone = clinicPhone || cData.clinicPhone || cData.clinicPhones?.[0] || cData.doctorPhone || ''
          return NextResponse.json({
            reply: `عذراً، تم الوصول للحد الأقصى لخدمة المساعد الذكي مؤقتاً. يرجى التواصل مع العيادة هاتفياً أو عبر واتساب مباشرة${contactPhone ? ` على الرقم: ${contactPhone}` : ''} وسيسعدنا خدمتكم.`
          })
        }
      }
    }

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

    // Increment response counter if clinicId is provided
    if (clinicId) {
      try {
        await updateDoc(doc(db, 'clinics', clinicId), {
          aiResponsesCount: increment(1)
        })
      } catch (incErr) {
        console.warn('Failed to increment AI count:', incErr)
      }
    }

    return NextResponse.json({ reply: replyText });

  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ reply: 'خطأ من الذكاء الاصطناعي (OpenAI): ' + (error.message || 'حدث خطأ في الخادم.') });
  }
}

