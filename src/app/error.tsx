'use client';

// Globální Next.js Error Boundary – zachytí chyby, které propadnou přes všechny modulové boundaries
// Tato stránka se zobrazí při server-side i client-side chybách v kořenovém layoutu

import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // TODO: napojit na error tracking službu (Sentry/LogRocket)
    console.error('[GlobalError] Neošetřená chyba aplikace:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  return (
    <html lang="cs">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f8fafc' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '32px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)',
              textAlign: 'center',
            }}
          >
            {/* Ikonka */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 64,
                height: 64,
                borderRadius: 20,
                background: '#fef2f2',
                marginBottom: 20,
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#dc2626"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>

            {/* Nadpis */}
            <h1
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#0f172a',
                marginBottom: 8,
              }}
            >
              Aplikace narazila na problém
            </h1>

            {/* Podtext */}
            <p
              style={{
                fontSize: 14,
                color: '#94a3b8',
                marginBottom: 24,
                lineHeight: 1.6,
              }}
            >
              Nastala neočekávaná chyba. Zkuste obnovit stránku nebo se vraťte
              na přehled.
            </p>

            {/* Tlačítka – negativní vlevo, pozitivní vpravo */}
            <div style={{ display: 'flex', gap: 8 }}>
              <a
                href="/"
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  color: '#475569',
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: 'none',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                Přejít na přehled
              </a>
              <button
                onClick={reset}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  background: '#2563eb',
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Zkusit znovu
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
