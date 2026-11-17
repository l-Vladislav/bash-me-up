import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Served from https://l-vladislav.github.io/bash-me-up/
export default defineConfig({
  base: '/bash-me-up/',
  plugins: [react()],
  build: {
    rolldownOptions: {
      // The terminal, and the admin page at /bash-me-up/admin/ (password, stats/).
      input: { main: 'index.html', admin: 'admin/index.html' },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'stats/**/*.test.ts'],
  },
});
