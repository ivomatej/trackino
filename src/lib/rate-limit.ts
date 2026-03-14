// Trackino – Rate Limiting pomocí Upstash Redis
// Sliding window algoritmus pro ochranu API endpoints.
// Vyžaduje UPSTASH_REDIS_REST_URL a UPSTASH_REDIS_REST_TOKEN v .env.local

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Registrace: max 3 pokusy za 1 hodinu na IP
export const rateLimitRegister = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  prefix: 'trackino:register',
});

// AI asistent: max 20 požadavků za 1 minutu na IP / uživatele
export const rateLimitAI = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  prefix: 'trackino:ai',
});

// Firecrawl (scrape + search): max 10 požadavků za 1 minutu na IP / uživatele
export const rateLimitFirecrawl = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'trackino:firecrawl',
});

// Openprovider API proxy: max 30 požadavků za 1 minutu na IP / uživatele
export const rateLimitOpenprovider = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  prefix: 'trackino:openprovider',
});

// Subreg.cz SOAP API proxy: max 30 požadavků za 1 minutu na IP / uživatele
export const rateLimitSubreg = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  prefix: 'trackino:subreg',
});
