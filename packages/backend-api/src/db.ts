// TODO : Remove this , not utilized as frequently
import {Pool} from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, '../../..', '.env'),
});
const pool = new Pool({
    connectionString: process.env.DB_URL,
});
export default pool;