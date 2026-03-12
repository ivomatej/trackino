'use client';

// Next.js Error Boundary pro (dashboard) route segment
// Zachytí server-side i client-side chyby v rámci dashboard layoutu
// Sidebar zůstane funkční – tato stránka se renderuje místo obsahu, ne místo layoutu

import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // TODO: napojit na error tracking službu (Sentry/LogRocket)
    console.error('[DashboardError] Chyba v dashboard segmentu:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  return (
    <div
      className="flex items-center justify-center p-6 min-h-[400px]"
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
          Stránka se nepodařila načíst
        </h2>

        {/* Podtext */}
        <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
          Nastala neočekávaná chyba. Zkuste obnovit stránku nebo přejděte jinam.
        </p>

        {/* Tlačítka */}
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
            onClick={reset}
            className="flex-1 px-4 py-2.5 rounded-lg text-white text-sm font-medium"
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
