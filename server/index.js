import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/auth.js';
import conversationRoutes from './routes/conversations.js';
import messageRoutes from './routes/messages.js';
import userRoutes from './routes/user.js';
import quizRoutes from './routes/quiz.js';
import groupChatRoutes from './routes/groupchat.js';
import pool from './db/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));
app.use(cookieParser());

// Routes
// Public Share Route (MUST be before auth-guarded routes)
app.get('/api/public/share/:shareId', async (req, res) => {
    try {
        const { shareId } = req.params;
        const convResult = await pool.query(
            'SELECT id, title, created_at FROM conversations WHERE share_id = $1',
            [shareId]
        );
        if (convResult.rows.length === 0) {
            return res.status(404).json({ error: 'Shared conversation not found' });
        }
        const conversation = convResult.rows[0];
        const messagesResult = await pool.query(
            'SELECT role, content, image_url, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
            [conversation.id]
        );
        res.json({ conversation, messages: messagesResult.rows });
    } catch (err) {
        console.error('Public share error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/conversations', messageRoutes);
app.use('/api/conversations', groupChatRoutes);
app.use('/api/user', userRoutes);
app.use('/api/quiz', quizRoutes);

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', name: 'Niva API', version: '1.0.0' });
});

// Auto-migrate database schema on startup
async function runMigrations() {
    try {
        // Ensure uuid-ossp extension exists
        await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

        // Add missing columns to conversations
        await pool.query(`
            ALTER TABLE conversations ADD COLUMN IF NOT EXISTS share_id UUID DEFAULT NULL;
            ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT FALSE;
        `);

        // Create conversation_members table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS conversation_members (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'member')),
                joined_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(conversation_id, user_id)
            );
        `);

        // Create indexes
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_conv_members_conv ON conversation_members(conversation_id);
            CREATE INDEX IF NOT EXISTS idx_conv_members_user ON conversation_members(user_id);
        `);

        console.log('✦ [DB] Migrations applied successfully');
    } catch (err) {
        console.error('✦ [DB] Migration warning:', err.message);
    }
}

// Start the server after migrations
runMigrations().then(() => {
    app.listen(PORT, () => {
        console.log(`✦ Niva API running on http://localhost:${PORT}`);
    });
});
