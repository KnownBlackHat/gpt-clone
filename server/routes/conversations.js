import { Router } from 'express';
import pool from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/conversations
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.id, c.title, c.category, c.is_group, c.created_at, c.updated_at,
              (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
              (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id)::int as message_count
       FROM conversations c
       WHERE c.user_id = $1
          OR c.id IN (SELECT conversation_id FROM conversation_members WHERE user_id = $1)
       ORDER BY c.updated_at DESC`,
            [req.user.userId]
        );
        res.json({ conversations: result.rows });
    } catch (err) {
        console.error('List conversations error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/conversations
router.post('/', async (req, res) => {
    try {
        const { title, category } = req.body;
        const result = await pool.query(
            'INSERT INTO conversations (user_id, title, category) VALUES ($1, $2, $3) RETURNING *',
            [req.user.userId, title || 'New Chat', category || 'General']
        );
        res.status(201).json({ conversation: result.rows[0] });
    } catch (err) {
        console.error('Create conversation error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/conversations/:id
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM conversations WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        res.json({ conversation: result.rows[0] });
    } catch (err) {
        console.error('Get conversation error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/conversations/:id
router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM conversations WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.id, req.user.userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        res.json({ message: 'Conversation deleted' });
    } catch (err) {
        console.error('Delete conversation error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/conversations/:id
router.put('/:id', async (req, res) => {
    try {
        const { title } = req.body;
        const result = await pool.query(
            'UPDATE conversations SET title = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *',
            [title, req.params.id, req.user.userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        res.json({ conversation: result.rows[0] });
    } catch (err) {
        console.error('Rename conversation error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/conversations/:id/share
router.post('/:id/share', async (req, res) => {
    try {
        const { id } = req.params;
        // 1. Ensure conversation exists and belongs to user
        const conv = await pool.query(
            'SELECT share_id FROM conversations WHERE id = $1 AND user_id = $2',
            [id, req.user.userId]
        );
        if (conv.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        let shareId = conv.rows[0].share_id;
        if (!shareId) {
            // Generate a new share_id if not already shared
            const result = await pool.query(
                'UPDATE conversations SET share_id = uuid_generate_v4() WHERE id = $1 RETURNING share_id',
                [id]
            );
            shareId = result.rows[0].share_id;
        }

        res.json({ shareId });
    } catch (err) {
        console.error('Share conversation error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
