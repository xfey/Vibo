import React from 'react';
import ReactDOM from 'react-dom/client';

import { AppRoot } from '@renderer/app/AppRoot';

import '@renderer/theme/global.css';

window.addEventListener('error', (event) => {
  console.error('[renderer] uncaught error', event.error ?? event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[renderer] unhandled rejection', event.reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>,
);
