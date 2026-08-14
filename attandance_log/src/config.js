import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

export const config = {
  baseUrl: required('ESSL_BASE_URL').replace(/\/+$/, ''),
  username: required('ESSL_USERNAME'),
  password: required('ESSL_PASSWORD'),
};
