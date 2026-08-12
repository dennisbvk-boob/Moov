import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GitHub Pages serves a project site from https://<user>.github.io/<repo>/, so the
 * build needs to know that prefix. The deploy workflow passes it in as VITE_BASE.
 * Local dev, Vercel and a custom domain all sit at the root and need no override.
 *
 * The trailing slash is forced because actions/configure-pages reports base_path
 * as "/Moov" while index.html and the sw.js registration both concatenate onto
 * BASE_URL — without it those become "/Moovmanifest.webmanifest" and "/Moovsw.js".
 * Vite normalises its own asset URLs either way, so the breakage is silent.
 */
const raw = process.env.VITE_BASE || '/';
const base = raw.endsWith('/') ? raw : `${raw}/`;

export default defineConfig({
  base,
  plugins: [react()],
  server: { host: true },
});
