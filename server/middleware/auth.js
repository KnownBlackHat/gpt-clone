import jwt from 'jsonwebtoken';
import pool from '../db/index.js';

export async function authMiddleware(req, res, next) {
    const token =
        req.cookies?.token ||
        req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Verify user still exists in DB
        const result = await pool.query('SELECT id FROM users WHERE id = $1', [decoded.userId]);
        if (result.rows.length === 0) {
            res.clearCookie('token');
            return res.status(401).json({ error: 'User no longer exists' });
        }

        req.user = decoded;
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}
