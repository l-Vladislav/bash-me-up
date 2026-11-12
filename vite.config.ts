import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Served from https://l-vladislav.github.io/bash-me-up/
export default defineConfig({
  base: '/bash-me-up/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
