/// <reference types="vite/client" />

import type { ViboApi } from '@preload/api';

declare global {
  interface Window {
    viboApp: ViboApi;
  }
}

export {};
