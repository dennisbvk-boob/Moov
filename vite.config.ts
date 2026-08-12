import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GitHub Pages serves a project site from https://<user>.github.io/<repo>/, so the
 * build needs to know that prefix. The deploy workflow passes it in as VITE_BASE.
 * Local dev, Vercel and a custom domain all sit at the root and need no override.
 */
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: { host: true },
});
