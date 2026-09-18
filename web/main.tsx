import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CssBaseline from '@mui/material/CssBaseline';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('No #root element to mount the dashboard on.');

createRoot(root).render(
  <StrictMode>
    <CssBaseline />
    <App />
  </StrictMode>,
);
