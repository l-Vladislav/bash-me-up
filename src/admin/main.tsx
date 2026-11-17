import '@fontsource/vt323/latin-400.css';
import './admin.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Admin } from './Admin';

// The admin page reports nothing to the visit counter: it is not the site.
const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <Admin />
  </StrictMode>,
);
