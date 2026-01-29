// token-module/src/server.ts
import { logger, createServer } from 'pravatv_services';
import plugin from './plugin.ts';

createServer(plugin);