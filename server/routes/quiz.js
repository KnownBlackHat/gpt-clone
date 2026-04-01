import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
router.use(authMiddleware);

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

const DEFAULT_MODEL = 'llama3-70b-8192'; // Using a reliable large model for JSON generation

router.post('/generate', async (req, res) => {
    try {
        const { topic, amount = 5, difficulty = 'medium' } = req.body;

        if (!topic) {
            return res.status(400).json({ error: 'Topic is required' });
        }

        const difficultyGuide = {
            easy: 'Generate straightforward questions suitable for beginners. Focus on fundamental concepts and basic recall.',
            medium: 'Generate moderately challenging questions that require good understanding of the subject. Include some application-based questions.',
            hard: 'Generate advanced, expert-level questions. Include nuanced scenarios, edge cases, and questions that require deep analytical thinking.',
        };

        const systemPrompt = `
You are a professional quiz generator. Your task is to generate a high-quality multiple choice quiz based on the user's topic.
Difficulty level: ${(difficulty || 'medium').toUpperCase()}
${difficultyGuide[difficulty] || difficultyGuide.medium}

You must return ONLY a JSON object with the following structure:
{
  "title": "A catchy title for the quiz",
  "questions": [
    {
      "question": "The question text",
      "options": ["Option 0", "Option 1", "Option 2", "Option 3"],
      "correctIndex": 0,
      "explanation": "Brief explanation of why the answer is correct"
    }
  ]
}
Ensure there are exactly ${amount} questions. Each question must have exactly 4 options.
The JSON must be valid and contain no other text before or after it.
`;

        const response = await groq.chat.completions.create({
            model: DEFAULT_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Generate a ${difficulty} difficulty quiz about: ${topic}` }
            ],
            response_format: { type: 'json_object' }
        });

        const quizData = JSON.parse(response.choices[0].message.content);
        res.json(quizData);
    } catch (err) {
        console.error('Quiz generation error:', err);
        res.status(500).json({ error: 'Failed to generate quiz' });
    }
});

export default router;
