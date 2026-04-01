import { Router } from 'express';
import pool from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

/**
 * POST /api/conversations/group
 * Create a new group conversation and seed it with initial members.
 */
router.post('/group', async (req, res) => {
    try {
        const { title, memberEmails = [] } = req.body;
        const userId = req.user.userId;

        // Create conversation flagged as group
        const convResult = await pool.query(
            'INSERT INTO conversations (user_id, title, category, is_group) VALUES ($1, $2, $3, TRUE) RETURNING *',
            [userId, title || 'Group Chat', 'General']
        );
        const conversation = convResult.rows[0];

        // Add creator as owner
        await pool.query(
            'INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, $3)',
            [conversation.id, userId, 'owner']
        );

        // Resolve member emails and add them
        const addedMembers = [];
        for (const email of memberEmails) {
            const userResult = await pool.query(
                'SELECT id, username, email FROM users WHERE email = $1',
                [email.trim().toLowerCase()]
            );
            if (userResult.rows.length > 0) {
                const member = userResult.rows[0];
                if (member.id !== userId) {
                    await pool.query(
                        'INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                        [conversation.id, member.id, 'member']
                    );
                    addedMembers.push({ id: member.id, username: member.username, email: member.email, role: 'member' });
                }
            }
        }

        res.status(201).json({
            conversation,
            members: [
                { id: userId, role: 'owner' },
                ...addedMembers,
            ],
        });
    } catch (err) {
        console.error('Create group error:', err);
        res.status(500).json({ error: 'Failed to create group' });
    }
});

/**
 * GET /api/conversations/:id/members
 * List all members of a conversation.
 */
router.get('/:id/members', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        // User must be a member or the owner of this conversation
        const access = await pool.query(
            `SELECT 1 FROM conversations WHERE id = $1 AND (user_id = $2 OR id IN (
                SELECT conversation_id FROM conversation_members WHERE user_id = $2
            ))`,
            [id, userId]
        );
        if (access.rows.length === 0) {
            return res.status(403).json({ error: 'Not a member of this conversation' });
        }

        const result = await pool.query(
            `SELECT u.id, u.username, u.email, cm.role, cm.joined_at
             FROM conversation_members cm
             JOIN users u ON u.id = cm.user_id
             WHERE cm.conversation_id = $1
             ORDER BY cm.role ASC, cm.joined_at ASC`,
            [id]
        );

        res.json({ members: result.rows });
    } catch (err) {
        console.error('List members error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/conversations/:id/members
 * Invite a user by email.
 */
router.post('/:id/members', async (req, res) => {
    try {
        const { id } = req.params;
        const { email } = req.body;
        const userId = req.user.userId;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Only the owner can invite
        const ownerCheck = await pool.query(
            'SELECT 1 FROM conversations WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        if (ownerCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Only the conversation owner can add members' });
        }

        // Make sure we're working with a group
        await pool.query(
            'UPDATE conversations SET is_group = TRUE WHERE id = $1',
            [id]
        );

        // Find user by email
        const userResult = await pool.query(
            'SELECT id, username, email FROM users WHERE email = $1',
            [email.trim().toLowerCase()]
        );
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'No user found with that email' });
        }

        const member = userResult.rows[0];
        if (member.id === userId) {
            return res.status(400).json({ error: 'You are already the owner' });
        }

        await pool.query(
            'INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [id, member.id, 'member']
        );

        res.status(201).json({
            member: { id: member.id, username: member.username, email: member.email, role: 'member' },
        });
    } catch (err) {
        console.error('Add member error:', err);
        res.status(500).json({ error: 'Failed to add member' });
    }
});

/**
 * DELETE /api/conversations/:id/members/:userId
 * Remove a member from a conversation.
 */
router.delete('/:id/members/:memberId', async (req, res) => {
    try {
        const { id, memberId } = req.params;
        const userId = req.user.userId;

        // Only the owner can remove members (or a member can leave)
        const conv = await pool.query(
            'SELECT user_id FROM conversations WHERE id = $1',
            [id]
        );
        if (conv.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const isOwner = conv.rows[0].user_id === userId;
        const isSelf = memberId === userId;

        if (!isOwner && !isSelf) {
            return res.status(403).json({ error: 'Only the owner can remove other members' });
        }

        await pool.query(
            'DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
            [id, memberId]
        );

        res.json({ message: 'Member removed' });
    } catch (err) {
        console.error('Remove member error:', err);
        res.status(500).json({ error: 'Failed to remove member' });
    }
});

export default router;
