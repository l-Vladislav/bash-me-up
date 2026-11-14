import '@fontsource/vt323/latin-400.css';
import './styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { trackView } from './analytics';
import { isSoftwareRendering } from './crt/renderer';

// Without a GPU the CRT effects cost most of the frame rate; the styles drop
// the heaviest of them under this flag.
if (isSoftwareRendering()) document.documentElement.setAttribute('data-lite', '');

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

trackView();
