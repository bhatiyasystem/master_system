import 'dotenv/config';

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
