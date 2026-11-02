import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // logbook/status.json is served by the repo-root static server.
  server: { proxy: { '/logbook': 'http://localhost:8790' } },
});
