// Trackino – databázové typy
// Tento soubor je orchestrátor – re-exportuje všechny typy z dílčích souborů.
// Existující importy `import { X } from '@/types/database'` fungují beze změn.

export * from './db/core';
export * from './db/tracking';
export * from './db/vacation';
export * from './db/invoices';
export * from './db/calendar';
export * from './db/requests';
export * from './db/documents';
export * from './db/knowledge';
export * from './db/content';
export * from './db/subscriptions';
export * from './db/domains';
export * from './db/tasks';
export * from './db/ai';
