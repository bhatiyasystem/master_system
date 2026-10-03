import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env first
dotenv.config();

// If missing, also attempt loading Attendance_log/.env
if (!process.env.ESSL_BASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '../Attendance_log/.env') });
}

export const config = {
  get baseUrl() {
    const value = process.env.ESSL_BASE_URL;
    if (!value) throw new Error("Missing required environment variable: ESSL_BASE_URL");
    return value.replace(/\/+$/, '');
  },
  get username() {
    const value = process.env.ESSL_USERNAME;
    if (!value) throw new Error("Missing required environment variable: ESSL_USERNAME");
    return value;
  },
  get password() {
    const value = process.env.ESSL_PASSWORD;
    if (!value) throw new Error("Missing required environment variable: ESSL_PASSWORD");
    return value;
  },
};
