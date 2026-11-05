import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: '../../packages/ais/src/schema.ts',
  out: './migrations',
});
