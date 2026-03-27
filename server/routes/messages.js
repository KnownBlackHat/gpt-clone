import { Router } from 'express';
import pool from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import Groq from 'groq-sdk';
import axios from 'axios';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
router.use(authMiddleware);

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

const VISION_MODEL = process.env.VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct'; // Default for 2026, or use 'pixtral-12b'

function generateTitle(content) {
    const words = content.split(' ').slice(0, 6).join(' ');
    return words.length > 40 ? words.substring(0, 40) + '...' : words;
}

async function searchSerper(query) {
    if (!process.env.SERPER_API_KEY) return null;
    try {
        const response = await axios.post(
            'https://google.serper.dev/search',
            { q: query, num: 5 },
            {
                headers: {
                    'X-API-KEY': process.env.SERPER_API_KEY,
                    'Content-Type': 'application/json',
                },
            }
        );
        return response.data;
    } catch (err) {
        console.error('Serper search error:', err);
        return null;
    }
}

async function parsePdf(base64Data) {
    try {
        const buffer = Buffer.from(base64Data.split(',')[1], 'base64');
        const data = await pdf(buffer);
        return data.text;
    } catch (err) {
        console.error('PDF parse error:', err);
        return 'Failed to read PDF content.';
    }
}

// GET /api/conversations/:conversationId/messages
router.get('/:conversationId/messages', async (req, res) => {
    try {
        const conv = await pool.query(
            'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
            [req.params.conversationId, req.user.userId]
        );
        if (conv.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const result = await pool.query(
            'SELECT id, role, content, image_url, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
            [req.params.conversationId]
        );
        res.json({ messages: result.rows });
    } catch (err) {
        console.error('Get messages error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/conversations/:conversationId/messages
router.post('/:conversationId/messages', async (req, res) => {
    try {
        const { content, imageUrl, pdfData } = req.body;

        if (!content && !imageUrl && !pdfData) {
            return res.status(400).json({ error: 'Message content, image, or PDF is required' });
        }

        // 1. Verify ownership and fetch user memory
        const userRes = await pool.query('SELECT memory FROM users WHERE id = $1', [req.user.userId]);
        const userMemory = userRes.rows[0]?.memory || '';

        const conv = await pool.query(
            'SELECT id, title FROM conversations WHERE id = $1 AND user_id = $2',
            [req.params.conversationId, req.user.userId]
        );
        if (conv.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // 2. Fetch recent short-term history (last 10 messages)
        const historyRes = await pool.query(
            'SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 10',
            [req.params.conversationId]
        );
        const history = historyRes.rows.reverse();

        // 3. Handle PDF and Search
        let pdfText = '';
        if (pdfData) {
            pdfText = await parsePdf(pdfData);
        }

        let searchResults = null;
        const lowercaseContent = (content || '').toLowerCase();
        if (lowercaseContent.includes('search') || lowercaseContent.includes('latest') || lowercaseContent.includes('who is')) {
            searchResults = await searchSerper(content);
        }

        // 4. Build message array for Groq
        const systemPrompt = {
            role: 'system',
            content: `You are Niva, a premium AI assistant built by Cybergentix. You must not disclose your origin as an OpenAI or Groq model. If asked who created you, say 'I am Niva, built by Cybergentix.' maintain a professional, helpful, and concise persona.\n\n` +
                `LONG-TERM MEMORY ABOUT USER: ${userMemory || 'No personal details known yet.'}\n\n` +
                `INSTRUCTIONS: Use the memory above to personalize your responses. Be subtle about it. If you learn something new and important about the user (name, preferences, job, etc.), acknowledge it. To save something to long-term memory, start your internal response with "MEMORY_UPDATE: [fact to remember]" (this will be hidden from the user).`
        };

        let modelMessages = [systemPrompt];

        // Add history
        history.forEach(msg => {
            // Groq requires historical messages content to be strings
            const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            modelMessages.push({ role: msg.role, content });
        });

        // Add additional context (PDF/Search)
        let contextText = '';
        if (pdfText) {
            contextText += `\n\n--- PDF CONTENT ---\n${pdfText}\n--- END PDF ---\n`;
        }
        if (searchResults) {
            contextText += `\n\n--- SEARCH RESULTS ---\n${JSON.stringify(searchResults.organic, null, 2)}\n--- END SEARCH ---\n`;
        }

        if (contextText) {
            modelMessages.push({
                role: 'system',
                content: `Here is additional context found from searching or reading files provided by the user. Use this to help answer: ${contextText}`
            });
        }

        // Add current user message
        if (imageUrl) {
            modelMessages.push({
                role: 'user',
                content: [
                    { type: 'text', text: content || 'Analyze this image.' },
                    { type: 'image_url', image_url: { url: imageUrl } },
                ],
            });
        } else {
            modelMessages.push({
                role: 'user',
                content: content || (pdfData ? 'Summarize the PDF provided.' : ''),
            });
        }

        // 5. Call Groq
        const chatCompletion = await groq.chat.completions.create({
            messages: modelMessages,
            model: VISION_MODEL,
        });

        let aiContentRaw = chatCompletion.choices[0]?.message?.content || "I'm sorry, I couldn't process that.";

        // 6. Extract Memory Update if present
        let aiContent = aiContentRaw;
        if (aiContentRaw.includes('MEMORY_UPDATE:')) {
            const parts = aiContentRaw.split('MEMORY_UPDATE:');
            const memoryToSave = parts[1].split('\n')[0].trim();
            aiContent = (parts[0] + (parts[1].split('\n').slice(1).join('\n'))).trim();

            // Save to DB (background/async)
            if (memoryToSave) {
                const newMemory = userMemory ? `${userMemory}\n- ${memoryToSave}` : `- ${memoryToSave}`;
                pool.query('UPDATE users SET memory = $1 WHERE id = $2', [newMemory, req.user.userId])
                    .catch(err => console.error('Failed to update user memory:', err));
            }
        }

        // 7. Save in DB
        const userMsg = await pool.query(
            'INSERT INTO messages (conversation_id, role, content, image_url) VALUES ($1, $2, $3, $4) RETURNING id, role, content, image_url, created_at',
            [req.params.conversationId, 'user', content || (pdfData ? 'Uploaded a PDF' : 'Sent an image'), imageUrl || null]
        );

        const aiMsg = await pool.query(
            'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING id, role, content, created_at',
            [req.params.conversationId, 'assistant', aiContent]
        );

        // Update titles
        if (conv.rows[0].title === 'New Chat') {
            await pool.query(
                'UPDATE conversations SET title = $1, updated_at = NOW() WHERE id = $2',
                [generateTitle(content || 'Analysis'), req.params.conversationId]
            );
        } else {
            await pool.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [req.params.conversationId]);
        }

        res.status(201).json({
            userMessage: userMsg.rows[0],
            assistantMessage: aiMsg.rows[0],
            wasSearched: !!searchResults,
        });
    } catch (err) {
        console.error('Groq API error:', err);
        res.status(500).json({ error: 'Failed to get AI response' });
    }
});

export default router;
