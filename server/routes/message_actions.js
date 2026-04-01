import { Router } from 'express';
import pool from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// PUT /api/messages/:messageId (Edit User Message)
router.put('/:messageId', async (req, res) => {
    try {
        const { content } = req.body;
        const { messageId } = req.params;

        // 1. Get current message and ensure it belongs to the user
        const msgRes = await pool.query(
            'SELECT m.*, c.user_id FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE m.id = $1',
            [messageId]
        );

        if (msgRes.rows.length === 0) return res.status(404).json({ error: 'Message not found' });
        const message = msgRes.rows[0];
        if (message.user_id !== req.user.userId) return res.status(403).json({ error: 'Unauthorized' });
        if (message.role !== 'user') return res.status(400).json({ error: 'Only user messages can be edited' });

        // 2. Delete all messages in the conversation created AFTER this one
        await pool.query(
            'DELETE FROM messages WHERE conversation_id = $1 AND created_at > $2',
            [message.conversation_id, message.created_at]
        );

        // 3. Update this message's content
        const updatedMsgRes = await pool.query(
            'UPDATE messages SET content = $1, created_at = NOW() WHERE id = $2 RETURNING *',
            [content, messageId]
        );

        res.json({ message: updatedMsgRes.rows[0], needsResend: true });
    } catch (err) {
        console.error('Edit message error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/messages/:messageId/retry (Retry Assistant Message)
router.post('/:messageId/retry', async (req, res) => {
    try {
        const { messageId } = req.params;

        // 1. Get current message and its conversation
        const msgRes = await pool.query(
            'SELECT m.*, c.user_id FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE m.id = $1',
            [messageId]
        );

        if (msgRes.rows.length === 0) return res.status(404).json({ error: 'Message not found' });
        const message = msgRes.rows[0];
        if (message.user_id !== req.user.userId) return res.status(403).json({ error: 'Unauthorized' });
        if (message.role !== 'assistant') return res.status(400).json({ error: 'Only assistant messages can be retried' });

        // 2. Find the user message immediately before this one
        const prevMsgRes = await pool.query(
            'SELECT * FROM messages WHERE conversation_id = $1 AND role = \'user\' AND created_at < $2 ORDER BY created_at DESC LIMIT 1; ',
            [message.conversation_id, message.created_at]
        );

        if (prevMsgRes.rows.length === 0) return res.status(400).json({ error: 'No user message found to retry' });
        const userMessage = prevMsgRes.rows[0];

        // 3. Delete this assistant message and any subsequent ones
        await pool.query(
            'DELETE FROM messages WHERE conversation_id = $1 AND created_at >= $2',
            [message.conversation_id, message.created_at]
        );

        res.json({ userMessage, needsResend: true });
    } catch (err) {
        console.error('Retry message error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
