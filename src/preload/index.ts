import { contextBridge } from 'electron';

import { createViboApi } from './api';

contextBridge.exposeInMainWorld('viboApp', createViboApi());
