import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/user
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, email, plan, avatar_url, created_at FROM users WHERE id = $1',
            [req.user.userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user: result.rows[0] });
    } catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/user
router.put('/', async (req, res) => {
    try {
        const { username, email, currentPassword, newPassword } = req.body;

        if (newPassword) {
            const user = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.userId]);
            const valid = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
            if (!valid) {
                return res.status(400).json({ error: 'Current password is incorrect' });
            }
            const hash = await bcrypt.hash(newPassword, 12);
            await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.userId]);
        }

        const updates = [];
        const values = [];
        let idx = 1;

        if (username) {
            updates.push(`username = $${idx++}`);
            values.push(username);
        }
        if (email) {
            updates.push(`email = $${idx++}`);
            values.push(email);
        }

        if (updates.length > 0) {
            updates.push(`updated_at = NOW()`);
            values.push(req.user.userId);
            await pool.query(
                `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`,
                values
            );
        }

        const result = await pool.query(
            'SELECT id, username, email, plan, avatar_url, created_at FROM users WHERE id = $1',
            [req.user.userId]
        );
        res.json({ user: result.rows[0] });
    } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/user
router.delete('/', async (req, res) => {
    try {
        await pool.query('DELETE FROM users WHERE id = $1', [req.user.userId]);
        res.clearCookie('token');
        res.json({ message: 'Account deleted' });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
