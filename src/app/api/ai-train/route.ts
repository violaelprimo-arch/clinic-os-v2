import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import OpenAI from 'openai'

export async function POST(request: Request) {
  try {
    const { newMessages } = await request.json()

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

    const systemInstruction = `
أنت الآن "عقل العيادة الذكي"، مساعد ذكاء اصطناعي طبي متقدم.
تتحدث الآن مع (الطبيب أو المساعد في العيادة).
مهمتك:
1. الرد على أي أسئلة طبية أو علمية بشكل دقيق واحترافي.
2. إذا قام الطبيب بإدخال بيانات (مثل سعر كشف أو مواعيد)، قم بتأكيد استلامك لها بأسلوب ذكي وممتع (لأنك تحفظها لترد بها على المرضى لاحقاً).
3. تحدث كزميل طبيب وذكاء اصطناعي متطور، لا تطلب أذونات، فقط أجب وناقش في المجال الطبي أو إداريات العيادة.
4. إجاباتك يجب أن تكون منسقة وواضحة.
`;

    const openai = new OpenAI({ apiKey: aiApiKey });
    
    const formattedMessages = newMessages.map((msg: any) => ({
      role: msg.role === 'model' || msg.role === 'bot' || msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.text
    }));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemInstruction },
        ...formattedMessages
      ],
      temperature: 0.5,
      max_tokens: 500
    });

    const replyText = completion.choices[0].message.content || 'عفواً، لم أتمكن من الرد.';
    return NextResponse.json({ reply: replyText });

  } catch (error: any) {
    console.error('Train API Error:', error);
    return NextResponse.json({ reply: 'خطأ من الذكاء الاصطناعي (OpenAI): ' + (error.message || 'حدث خطأ أثناء الاتصال.') });
  }
}
