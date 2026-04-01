import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/index.js';

const router = Router();

/**
 * @route   POST /api/auth/signup
 * @desc    Registrations for new users. Using 12 rounds for bcrypt as a balance of speed/security.
 */
router.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // basic validation - nothing fancy for now
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // prevent duplicate registrations
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        // TODO: maybe add a way to choose plan on signup later? for now everyone is 'free'
        const result = await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, plan, created_at',
            [username, email, passwordHash]
        );

        const user = result.rows[0];

        // ensure we have a secret, otherwise jwt.sign will definitely blow up
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT_SECRET is missing in environment variables');
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            secret,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // cookie config - only enforce secure flag when explicitly set
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.COOKIE_SECURE === 'true',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.status(201).json({ user, token });
    } catch (err) {
        // NOTE: adding detailed logging here for now to catch the 500 error user reported
        console.error('[AUTH_SIGNUP_ERROR]:', err.message, err.stack);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const result = await pool.query(
            'SELECT id, username, email, password_hash, plan, avatar_url, created_at FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET not configured');

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            secret,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.COOKIE_SECURE === 'true',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        const { password_hash, ...safeUser } = user;
        res.json({ user: safeUser, token });
    } catch (err) {
        console.error('[AUTH_LOGIN_ERROR]:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/logout', (_req, res) => {
    // clear the auth cookie
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
});

// fetch current user session
router.get('/me', async (req, res) => {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET missing');

        const decoded = jwt.verify(token, secret);
        const result = await pool.query(
            'SELECT id, username, email, plan, avatar_url, created_at FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User session invalid' });
        }

        res.json({ user: result.rows[0] });
    } catch (err) {
        return res.status(401).json({ error: 'Session expired or invalid token' });
    }
});

export default router;
