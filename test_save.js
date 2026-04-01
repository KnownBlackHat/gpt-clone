import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

const token = jwt.sign({ userId: '00000000-0000-0000-0000-000000000000', email: 'test@example.com' }, process.env.JWT_SECRET);

console.log(token);
