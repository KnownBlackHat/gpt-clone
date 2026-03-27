import pool from './index.js';

async function migrate() {
    try {
        console.log('Running migration: Add memory column to users...');
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS memory TEXT DEFAULT '';
        `);
        console.log('Migration successful.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
