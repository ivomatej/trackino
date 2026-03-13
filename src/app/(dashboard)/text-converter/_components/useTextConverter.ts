'use client';

import { useState, useRef, useCallback } from 'react';
import { htmlToPlainText, htmlToMarkdown, markdownToHtml } from './utils';
import type { ConversionMode, ForwardOutputTab, ReverseOutputTab } from './types';

export function useTextConverter() {
  // Mód: forward = Formátovaný → Text/Markdown, reverse = Markdown → Formátovaný/Prostý
  const [mode, setMode] = useState<ConversionMode>('forward');

  // Stav pro mód forward
  const [outputTab, setOutputTab] = useState<ForwardOutputTab>('plain');
  const [plainOutput, setPlainOutput] = useState('');
  const [markdownOutput, setMarkdownOutput] = useState('');
  const [hasForwardInput, setHasForwardInput] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);

  // Stav pro mód reverse
  const [markdownInput, setMarkdownInput] = useState('');
  const [reverseHtml, setReverseHtml] = useState('');
  const [reversePlain, setReversePlain] = useState('');
  const [reverseTab, setReverseTab] = useState<ReverseOutputTab>('formatted');

  // Konverze forward (HTML → plain/markdown)
  const convertForward = useCallback(() => {
    const html = inputRef.current?.innerHTML ?? '';
    const hasText = (inputRef.current?.innerText ?? '').trim().length > 0;
    setHasForwardInput(hasText);
    if (hasText) {
      setPlainOutput(htmlToPlainText(html));
      setMarkdownOutput(htmlToMarkdown(html));
    } else {
      setPlainOutput('');
      setMarkdownOutput('');
    }
  }, []);

  // Konverze reverse (Markdown → HTML/plain)
  const convertReverse = useCallback((md: string) => {
    if (!md.trim()) {
      setReverseHtml('');
      setReversePlain('');
      return;
    }
    const html = markdownToHtml(md);
    setReverseHtml(html);
    setReversePlain(htmlToPlainText(html));
  }, []);

  const clearAll = () => {
    if (mode === 'forward') {
      if (inputRef.current) inputRef.current.innerHTML = '';
      setPlainOutput('');
      setMarkdownOutput('');
      setHasForwardInput(false);
    } else {
      setMarkdownInput('');
      setReverseHtml('');
      setReversePlain('');
    }
  };

  const hasAnyInput = mode === 'forward' ? hasForwardInput : markdownInput.trim().length > 0;
  const forwardOutput = outputTab === 'plain' ? plainOutput : markdownOutput;

  return {
    mode, setMode,
    outputTab, setOutputTab,
    plainOutput, markdownOutput, hasForwardInput,
    inputRef,
    markdownInput, setMarkdownInput,
    reverseHtml, reversePlain,
    reverseTab, setReverseTab,
    convertForward, convertReverse, clearAll,
    hasAnyInput, forwardOutput,
  };
}
