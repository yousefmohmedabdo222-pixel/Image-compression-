import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  // CORS handling if needed
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Gemini-Api-Key'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const customHeaderKey = req.headers['x-gemini-api-key'];
    const apiKey = (typeof customHeaderKey === 'string' && customHeaderKey.trim()) 
      ? customHeaderKey.trim() 
      : process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'لم يتم العثور على مفتاح GEMINI_API_KEY في متغيّرات البيئة على Vercel.',
      });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const image = body?.image;

    if (!image) {
      return res.status(400).json({ success: false, error: 'الصورة مطلوبة.' });
    }

    let base64Data = image;
    let mimeType = 'image/png';
    if (typeof image === 'string' && image.includes(';base64,')) {
      const parts = image.split(';base64,');
      mimeType = parts[0].replace('data:', '');
      base64Data = parts[1];
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = `أنت خبير متقدم جداً في التعرف الضوئي على المعادلات والرموز الرياضية والفيزيائية (Math OCR).
قم بقراءة واستخراج كافة المعادلات، الصيغ، والرموز الرياضية والملاحظات المكتوبة أو المطبوعة في هذه الصورة بدقة متناهية.

التعليمات المطلوبة للإخراج:
1. استخرج المعادلة/المعادلات بصيغة LaTeX واضحة ونظيفة (استخدم $...$ للمعادلات المدمجة و $$...$$ للمعادلات المنفصلة).
2. استخرج التكاملات، المصفوفات، الكسور، الجذور، النهايات، والرموز الإغريقية (مثل \\alpha, \\beta, \\pi, \\sum, \\int, \\frac{a}{b}) بدقة كاملة.
3. إذا كانت الصورة تحتوي على نص تشريحي أو خطوات حل باللغة العربية أو الإنجليزية، اذكر النص كما هو بجانب المعادلات.
4. قدم الصيغة النهائية بنسخة LaTeX جاهزة للنسخ والاستخدام مباشرةً.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          },
          { text: prompt },
        ],
      },
    });

    const extractedText = response.text || 'لم يتم العثور على رموز رياضية في هذه الصورة.';
    return res.status(200).json({ success: true, text: extractedText });
  } catch (error: any) {
    console.error('Math OCR Gemini API Error (Vercel):', error);
    const errStr = String(error?.message || error || '');
    const isQuotaExceeded = errStr.includes('429') || 
                            errStr.toLowerCase().includes('quota') || 
                            errStr.toLowerCase().includes('resource_exhausted') || 
                            errStr.toLowerCase().includes('rate limit');

    return res.status(isQuotaExceeded ? 429 : 500).json({
      success: false,
      quotaExceeded: isQuotaExceeded,
      error: isQuotaExceeded 
        ? 'وصلنا للحد المجاني اليوم 😅 جرّب الوضع المحلي أو عد غداً' 
        : (error?.message || 'حدث خطأ أثناء معالجة معادلات الرياضيات عبر Gemini API.')
    });
  }
}
