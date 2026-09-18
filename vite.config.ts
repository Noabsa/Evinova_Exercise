import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // The dashboard talks to the API on the same origin, so there is no CORS to configure.
    proxy: { '/api': 'http://localhost:3000' },
  },
});
