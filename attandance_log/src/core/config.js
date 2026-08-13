import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

export const config = {
  get baseUrl() {
    return required('ESSL_BASE_URL').replace(/\/+$/, '');
  },
  get username() {
    return required('ESSL_USERNAME');
  },
  get password() {
    return required('ESSL_PASSWORD');
  },
};
