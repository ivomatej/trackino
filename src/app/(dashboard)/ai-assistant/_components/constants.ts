// Konstanty pro AI asistent

export const FIRECRAWL_CREDIT_LIMIT = 500;
export const CREDITS_PER_SCRAPE = 1;
export const CREDITS_PER_SEARCH = 7;
export const FIRECRAWL_CREDITS_KEY = 'trackino_firecrawl_credits_used';

// ─── CSS styly pro AI zprávy ──────────────────────────────────────────────
export const AI_MSG_STYLES = `
  .ai-msg h1.ai-h1 { font-size: 1.1rem; font-weight: 700; margin: 0.5rem 0 0.25rem; }
  .ai-msg h2.ai-h2 { font-size: 1rem; font-weight: 700; margin: 0.5rem 0 0.25rem; }
  .ai-msg h3.ai-h3 { font-size: 0.9rem; font-weight: 600; margin: 0.4rem 0 0.2rem; }
  .ai-msg ul.ai-ul { padding-left: 1.2rem; margin: 0.3rem 0; }
  .ai-msg ul.ai-ul li { margin: 0.15rem 0; }
  .ai-msg pre.ai-code-block { background: rgba(0,0,0,0.15); border-radius: 8px; padding: 10px 12px; overflow-x: auto; margin: 0.5rem 0; font-size: 0.8rem; position: relative; }
  .ai-msg pre.ai-code-block::before { content: attr(data-lang); position: absolute; top: 4px; right: 8px; font-size: 0.65rem; opacity: 0.5; text-transform: uppercase; }
  .ai-msg code.ai-inline-code { background: rgba(0,0,0,0.12); border-radius: 4px; padding: 1px 5px; font-size: 0.85em; }
  .ai-msg p:first-child { margin-top: 0; }
  .ai-msg p:last-child { margin-bottom: 0; }
  .ai-stream h1.ai-h1 { font-size: 1.1rem; font-weight: 700; margin: 0.5rem 0 0.25rem; }
  .ai-stream h2.ai-h2 { font-size: 1rem; font-weight: 700; margin: 0.5rem 0 0.25rem; }
  .ai-stream h3.ai-h3 { font-size: 0.9rem; font-weight: 600; margin: 0.4rem 0 0.2rem; }
  .ai-stream ul.ai-ul { padding-left: 1.2rem; margin: 0.3rem 0; }
  .ai-stream pre.ai-code-block { background: rgba(0,0,0,0.15); border-radius: 8px; padding: 10px 12px; overflow-x: auto; margin: 0.5rem 0; font-size: 0.8rem; }
  .ai-stream code.ai-inline-code { background: rgba(0,0,0,0.12); border-radius: 4px; padding: 1px 5px; font-size: 0.85em; }
`;
