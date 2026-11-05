import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), // Share local R2 state with the ingest worker.
    cloudflare({ persistState: { path: '../ingest/.wrangler/state' } }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
