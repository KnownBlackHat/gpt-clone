import { Router } from 'express';
import Groq from 'groq-sdk';
import path from 'path';
import { createRequire } from 'module';
import { authMiddleware } from '../middleware/auth.js';
import dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);
const pdfModule = require('pdf-parse');
const PDFParse = pdfModule.PDFParse || pdfModule.default?.PDFParse;

const router = Router();
router.use(authMiddleware);

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

async function parsePdf(base64Data) {
    try {
        const buffer = Buffer.from(base64Data.split(',')[1], 'base64');
        const uint8Array = new Uint8Array(buffer);
        const fontPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'standard_fonts', '/');
        const instance = new PDFParse({
            data: uint8Array,
            standardFontDataUrl: fontPath
        });

        try {
            const data = await instance.getText();
            return data.text || 'Empty PDF content.';
        } finally {
            await instance.destroy();
        }
    } catch (err) {
        console.error('PDF parse error:', err);
        return 'Failed to read PDF content.';
    }
}

const DEFAULT_MODEL = process.env.QUIZ_MODEL || process.env.VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

router.post('/generate', async (req, res) => {
    try {
        let {
            topic,
            amount = 5,
            difficulty = 'medium',
            pdfData,
            pyqData,
            syllabus,
            marks = 1
        } = req.body;

        let contextText = '';
        if (pdfData) {
            const pdfText = await parsePdf(pdfData);
            contextText += `### STUDY MATERIAL\n${pdfText}\n\n`;
        }
        if (pyqData) {
            const pyqText = await parsePdf(pyqData);
            contextText += `### PREVIOUS YEAR QUESTIONS (PYQ) GUIDE\nUse the following questions as a reference for the STYLE, DEPTH, and TYPE of questions to generate:\n${pyqText}\n\n`;
        }
        if (syllabus) {
            contextText += `### SYLLABUS SCOPE\nOnly generate questions within this scope:\n${syllabus}\n\n`;
        }

        if (!topic && !contextText) {
            return res.status(400).json({ error: 'Topic, PDF, or Syllabus is required' });
        }

        const systemPrompt = `
You are a professional educational exam generator. Your task is to generate a high-quality test.
${contextText ? 'CRITICAL: Use the provided CONTEXT (Study Material/PYQ/Syllabus) as the primary source.' : `Theme: ${topic}`}
Difficulty level: ${(difficulty || 'medium').toUpperCase()}
Marks per question: ${marks}

### QUESTION FORMATS
You can generate a mix of:
1. **MCQ**: Multiple choice questions.
2. **SHORT**: Short answer questions (2-3 sentences).
3. **LONG**: Long-form/Essay questions (Step-by-step explanation).

### PYQ STYLE MATCHING
If PYQ context is provided, carefully analyze the phrasing and complexity. Generate new, original questions that match that professional standard.

### RESPONSE STRUCTURE
You must return ONLY a JSON object:
{
  "title": "A catchy title for the exam",
  "questions": [
    {
      "type": "mcq", 
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correctIndex": 0,
      "explanation": "...",
      "marks": ${marks}
    },
    {
      "type": "short",
      "question": "...",
      "solution": "Sample correct answer...",
      "explanation": "...",
      "marks": ${marks}
    },
    {
      "type": "long",
      "question": "...",
      "solution": "Detailed step-by-step solution...",
      "explanation": "...",
      "marks": ${marks}
    }
  ]
}
Ensure there are exactly ${amount} questions in total.`;

        const userPrompt = contextText ? `CONTEXT:\n${contextText}\n\nTOPIC/QUERY: ${topic || 'Generate based on context'}` : `Generate a ${difficulty} difficulty exam about: ${topic}`;

        const response = await groq.chat.completions.create({
            model: DEFAULT_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' }
        });

        const examData = JSON.parse(response.choices[0].message.content);
        res.json(examData);
    } catch (err) {
        console.error('Quiz generation error:', err);
        res.status(500).json({ error: 'Failed to generate quiz' });
    }
});

export default router;
