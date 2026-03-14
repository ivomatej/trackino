'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  moduleName?: string;
  fallback?: React.ReactNode;
  // Speciální fallback pro Timer – zobrazí jen lištu s textem
  timerFallback?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  detailOpen: boolean;
}

class ErrorBoundaryClass extends React.Component<
  Props & { onReset?: () => void },
  State
> {
  constructor(props: Props & { onReset?: () => void }) {
    super(props);
    this.state = { hasError: false, error: null, detailOpen: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, detailOpen: false };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const moduleName = this.props.moduleName ?? 'Neznámý modul';
    console.error(`[ErrorBoundary] Modul: ${moduleName}`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });

    // Odeslat chybu do monitoring systému (fire-and-forget)
    fetch('/api/monitoring/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        moduleName,
        componentStack: errorInfo.componentStack,
        url: typeof window !== 'undefined' ? window.location.pathname : null,
      }),
    }).catch(() => { /* silent fail – monitoring nesmí ovlivnit UX */ });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, detailOpen: false });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Vlastní fallback – pokud byl předán
    if (this.props.fallback) {
      return this.props.fallback;
    }

    // Speciální fallback pro TimerBar – zachovává výšku lišty
    if (this.props.timerFallback) {
      return (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
          style={{
            background: 'var(--bg-hover)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>Timer nedostupný</span>
          <button
            onClick={this.handleReset}
            className="ml-auto text-xs px-2 py-1 rounded"
            style={{ color: 'var(--primary)' }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = 'var(--bg-active)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = 'transparent')
            }
          >
            Zkusit znovu
          </button>
        </div>
      );
    }

    const moduleName = this.props.moduleName ?? 'Stránka';
    const isDev = process.env.NODE_ENV === 'development';
    const error = this.state.error;

    return (
      <div
        className="flex items-center justify-center p-6 min-h-[300px]"
        style={{ width: '100%' }}
      >
        <div
          className="w-full max-w-md rounded-xl border p-6"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border)',
          }}
        >
          {/* Ikonka varování */}
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: '#fef2f2' }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: '#dc2626' }}
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>

          {/* Nadpis */}
          <h2
            className="text-base font-semibold mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            Modul &ldquo;{moduleName}&rdquo; selhal
          </h2>

          {/* Podtext */}
          <p
            className="text-sm mb-5"
            style={{ color: 'var(--text-muted)' }}
          >
            Nastala neočekávaná chyba. Zkuste obnovit stránku nebo přejděte
            jinam.
          </p>

          {/* Dev detail – collapsible */}
          {isDev && error && (
            <div className="mb-5">
              <button
                onClick={() =>
                  this.setState((s) => ({ detailOpen: !s.detailOpen }))
                }
                className="flex items-center gap-1.5 text-xs font-medium mb-2"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = 'var(--text-secondary)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = 'var(--text-muted)')
                }
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transition: 'transform 0.15s',
                    transform: this.state.detailOpen
                      ? 'rotate(90deg)'
                      : 'rotate(0deg)',
                  }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                Detail chyby (dev)
              </button>
              {this.state.detailOpen && (
                <pre
                  className="text-[11px] p-3 rounded-lg overflow-auto max-h-48"
                  style={{
                    background: 'var(--bg-hover)',
                    color: '#dc2626',
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {error.message}
                  {error.stack ? `\n\n${error.stack}` : ''}
                </pre>
              )}
            </div>
          )}

          {/* Tlačítka – negativní vlevo, pozitivní vpravo */}
          <div className="flex gap-2">
            <a
              href="/"
              className="flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium text-center transition-colors"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = 'var(--bg-hover)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = 'transparent')
              }
            >
              Přejít na přehled
            </a>
            <button
              onClick={this.handleReset}
              className="flex-1 px-4 py-2.5 rounded-lg text-white text-sm font-medium transition-colors"
              style={{ background: 'var(--primary)' }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = 'var(--primary-hover)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = 'var(--primary)')
              }
            >
              Zkusit znovu
            </button>
          </div>
        </div>
      </div>
    );
  }
}

// Wrapper – class components nemají přístup k hookům,
// proto router/reset logic řešíme přes href (a tag) v class komponentě.
// Tato funkce je exponována jako public API.
export default function ErrorBoundary({
  children,
  moduleName,
  fallback,
  timerFallback,
}: Props) {
  return (
    <ErrorBoundaryClass
      moduleName={moduleName}
      fallback={fallback}
      timerFallback={timerFallback}
    >
      {children}
    </ErrorBoundaryClass>
  );
}
