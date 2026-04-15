import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  internalAuthToken: (process.env.INTERNAL_AUTH_TOKEN || '').trim()
};
