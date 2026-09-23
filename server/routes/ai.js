const express = require('express');
const router = express.Router();
const https = require('https');

/**
 * POST /api/ai/ask
 * AI Chat Assistant Endpoint
 * Supports Google Gemini API (GEMINI_API_KEY in .env) or OpenAI API (OPENAI_API_KEY)
 */
router.post('/ask', async (req, res) => {
  try {
    const { prompt, conversationHistory = [] } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ success: false, message: 'Prompt is required' });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    // 1. If Google Gemini API Key is configured in .env
    if (geminiKey) {
      try {
        const geminiAnswer = await callGeminiAPI(geminiKey, prompt, conversationHistory);
        if (geminiAnswer) {
          return res.json({ success: true, answer: geminiAnswer, source: 'gemini' });
        }
      } catch (err) {
        console.warn('⚠️ Gemini API error:', err.message);
      }
    }

    // 2. If OpenAI API Key is configured in .env
    if (openaiKey) {
      try {
        const openaiAnswer = await callOpenAIAPI(openaiKey, prompt, conversationHistory);
        if (openaiAnswer) {
          return res.json({ success: true, answer: openaiAnswer, source: 'openai' });
        }
      } catch (err) {
        console.warn('⚠️ OpenAI API error:', err.message);
      }
    }

    // 3. If no external key configured, return success: false to let frontend handle with smart multilingual engine
    return res.json({
      success: false,
      message: 'No cloud AI key configured. Using client-side multilingual AI engine.'
    });

  } catch (error) {
    console.error('❌ AI Ask error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper for Google Gemini API
function callGeminiAPI(apiKey, prompt, history = []) {
  return new Promise((resolve, reject) => {
    const systemInstruction = `You are MKS Munim Ji AI (एमकेएस मुनीम जी एआई), an intelligent, super friendly, and expert AI business, billing, retail, and general assistant for Indian shopkeepers.
IMPORTANT RULES:
1. ALWAYS respond in the EXACT SAME language, dialect, and script as the user:
   - If user asks in Hinglish (Roman Hindi like "kya hota hai", "kaise kare", "i love you"), reply in warm, respectful, fluent Hinglish!
   - If user asks in Hindi Devanagari (हिन्दी), reply in fluent, respectful Devanagari Hindi.
   - If user asks in English, reply in English.
   - If user asks in Rajasthani/Marwari/Gujarati, reply warmly in their dialect.
2. If asked about software features (WhatsApp Bot, POS Billing, Udhar Khata, GST, Inventory, Barcode, etc.), explain:
   - What it is (यह क्या है)
   - 4-5 major benefits for shopkeeper (फायदे)
   - How to use it step-by-step (कैसे इस्तेमाल करें)
3. If asked any general question (science, history, cooking, math, emotions, joke, general knowledge), answer thoroughly, politely, and accurately in their language.
4. Keep the tone respectful, positive, and practical (use emoji like 📲, 🧾, 💡, 🌸).`;

    const contents = [];
    contents.push({
      role: 'user',
      parts: [{ text: `${systemInstruction}\n\nUser Question: ${prompt}` }]
    });

    const payload = JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000
      }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.candidates && parsed.candidates[0]?.content?.parts[0]?.text) {
            resolve(parsed.candidates[0].content.parts[0].text);
          } else {
            reject(new Error(parsed.error?.message || 'Empty Gemini response'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Helper for OpenAI API
function callOpenAIAPI(apiKey, prompt, history = []) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are MKS Munim Ji AI, an expert AI assistant for Indian shopkeepers. ALWAYS answer in the EXACT same language and script (Hinglish, Hindi, English, etc.) as the user asked.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.choices && parsed.choices[0]?.message?.content) {
            resolve(parsed.choices[0].message.content);
          } else {
            reject(new Error(parsed.error?.message || 'Empty OpenAI response'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = router;
