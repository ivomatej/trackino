import type { PromptFolder } from './types';

export function getDepth(folder: PromptFolder, all: PromptFolder[]): number {
  let d = 0; let cur: PromptFolder | undefined = folder;
  while (cur?.parent_id) { cur = all.find(f => f.id === cur!.parent_id); d++; }
  return d;
}

export function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function extractCodeBlocks(html: string): string[] {
  const re = /<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi;
  const results: string[] = [];
  let m; while ((m = re.exec(html)) !== null) {
    results.push(m[1].replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"'));
  }
  return results;
}
