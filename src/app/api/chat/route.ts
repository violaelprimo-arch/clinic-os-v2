import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { message, aiApiKey, aiInstructions } = await request.json()

    if (!aiApiKey) {
      // Fallback response if Doctor didn't provide a key
      return NextResponse.json({
        reply: "عذراً، طبيب العيادة لم يقم بتفعيل مفتاح الذكاء الاصطناعي بعد. ولكن نحن في خدمتك دائماً عبر الهاتف أو في مقر العيادة."
      })
    }

    // Prepare system instructions + user message for Gemini REST API
    const prompt = `
System Instructions (You are a medical clinic assistant acting on behalf of the clinic):
${aiInstructions}

User Question: ${message}

Important: Answer concisely, politely, and in Arabic.
`

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${aiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 250,
        }
      })
    })

    const data = await res.json()

    if (data.error) {
      console.error('Gemini API Error:', data.error)
      return NextResponse.json({ reply: 'عذراً، حدث خطأ في النظام. يرجى التأكد من صحة مفتاح الذكاء الاصطناعي.' })
    }

    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'لم أتمكن من الإجابة في الوقت الحالي.'
    
    return NextResponse.json({ reply: replyText })

  } catch (error) {
    console.error('Chat API Error:', error)
    return NextResponse.json({ reply: 'عذراً، حدث خطأ في الاتصال بالذكاء الاصطناعي.' }, { status: 500 })
  }
}
