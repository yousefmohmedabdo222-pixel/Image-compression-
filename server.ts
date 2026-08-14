import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Contact API Endpoint
  app.post('/api/contact', (req, res) => {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, error: 'يرجى ملء جميع الحقول المطلوبة' });
    }
    console.log('Received contact submission:', { name, email, subject, message });
    return res.json({
      success: true,
      message: 'شكرًا لتواصلك معنا! تم إرسال رسالتك بنجاح إلى yousefmohmedabdo222@gmail.com وسنقوم بالرد عليك في أقرب وقت.'
    });
  });

  // Math OCR AI Endpoint using Gemini API
  app.post('/api/ocr/math', async (req, res) => {
    try {
      const apiKey = (req.headers['x-gemini-api-key'] as string) || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: 'لم يتم العثور على مفتاح GEMINI_API_KEY. يرجى التأكد من ضبط متغير البيئة GEMINI_API_KEY في إعدادات الخادم أو Vercel.'
        });
      }

      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ success: false, error: 'يرجى تزويد صورة صالحة للتحليل.' });
      }

      let mimeType = 'image/png';
      let base64Data = image;

      if (image.includes(';base64,')) {
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
        model: 'gemini-2.5-flash',
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
      return res.json({ success: true, text: extractedText });
    } catch (error: any) {
      console.error('Math OCR Gemini API Error:', error);
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
  });

  // Serve static public folder if it exists
  const publicDir = path.join(__dirname, 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  // Development mode: Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });

    // Handle HTML routes cleanly in dev
    app.use(async (req, res, next) => {
      const url = req.path;

      // Handle direct file extensions or clean routes
      let htmlFile = '';
      if (url === '/' || url === '/index' || url === '/index.html') {
        htmlFile = 'index.html';
      } else if (url === '/about' || url === '/about.html') {
        htmlFile = 'about.html';
      } else if (url === '/contact' || url === '/contact.html') {
        htmlFile = 'contact.html';
      } else if (url === '/privacy-policy' || url === '/privacy-policy.html') {
        htmlFile = 'privacy-policy.html';
      } else if (url === '/terms' || url === '/terms.html') {
        htmlFile = 'terms.html';
      } else if (url === '/blog' || url === '/blog.html') {
        htmlFile = 'blog.html';
      }

      if (htmlFile) {
        try {
          const filePath = path.join(__dirname, htmlFile);
          if (fs.existsSync(filePath)) {
            let template = fs.readFileSync(filePath, 'utf-8');
            template = await vite.transformIndexHtml(req.originalUrl, template);
            return res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
          }
        } catch (e) {
          vite.ssrFixStacktrace(e as Error);
          return next(e);
        }
      }

      // Delegate asset files & HMR to Vite middleware
      vite.middlewares(req, res, next);
    });
  } else {
    // Production mode
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));

    app.get('*all', (req, res, next) => {
      const url = req.path;
      let htmlFile = 'index.html';
      if (url.includes('about')) htmlFile = 'about.html';
      else if (url.includes('contact')) htmlFile = 'contact.html';
      else if (url.includes('privacy')) htmlFile = 'privacy-policy.html';
      else if (url.includes('terms')) htmlFile = 'terms.html';
      else if (url.includes('blog')) htmlFile = 'blog.html';

      const targetPath = path.join(distPath, htmlFile);
      if (fs.existsSync(targetPath)) {
        res.sendFile(targetPath);
      } else {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
