'use client';

interface TimerControlsProps {
  isBottomBar: boolean;
  isRunning: boolean;
  elapsed: number;
  validationError: string;
  isOnline: boolean;
  offlinePendingMsg: string;
  formatTime: (seconds: number) => string;
  startTimer: () => void;
  stopTimer: () => void;
  discardTimer: () => void;
}

export function TimerControls({
  isBottomBar,
  isRunning, elapsed,
  validationError, isOnline, offlinePendingMsg,
  formatTime,
  startTimer, stopTimer, discardTimer,
}: TimerControlsProps) {
  return (
    <>
      {/* Validační chyba */}
      {validationError && (
        <span className="text-xs whitespace-nowrap hidden sm:inline" style={{ color: 'var(--danger)' }}>
          {validationError}
        </span>
      )}

      {/* Offline indikátor / čekající stop */}
      {(!isOnline || offlinePendingMsg) && (
        <span
          className="text-xs whitespace-nowrap hidden sm:inline flex items-center gap-1"
          style={{ color: offlinePendingMsg ? '#d97706' : '#6b7280' }}
          title={offlinePendingMsg || 'Jste offline – timer stále běží'}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /></svg>
          {offlinePendingMsg ? 'Čeká na uložení' : 'Offline'}
        </span>
      )}

      {/* Oddělovač */}
      <div className="hidden sm:block w-px h-6" style={{ background: 'var(--border)' }} />

      {/* Čas – JetBrains Mono font */}
      <div
        className="text-lg sm:text-xl font-bold tabular-nums min-w-[85px] sm:min-w-[100px] text-center ml-auto sm:ml-0"
        style={{
          color: isRunning ? 'var(--primary)' : 'var(--text-muted)',
          letterSpacing: '0.02em',
        }}
      >
        {formatTime(elapsed)}
      </div>

      {/* Start/Stop/Discard */}
      {!isRunning ? (
        <button
          onClick={startTimer}
          className={`${isBottomBar ? 'w-11 h-11' : 'w-9 h-9'} rounded-full flex items-center justify-center text-white flex-shrink-0 transition-colors`}
          style={{ background: 'var(--primary)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary)'}
          title="Spustit"
        >
          <svg width={isBottomBar ? 18 : 15} height={isBottomBar ? 18 : 15} viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6 3 20 12 6 21 6 3" />
          </svg>
        </button>
      ) : (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={stopTimer}
            className={`${isBottomBar ? 'w-11 h-11' : 'w-9 h-9'} rounded-full flex items-center justify-center text-white flex-shrink-0 transition-opacity`}
            style={{ background: 'var(--danger)' }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            title="Zastavit"
          >
            <svg width={isBottomBar ? 16 : 13} height={isBottomBar ? 16 : 13} viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
          </button>
          <button
            onClick={discardTimer}
            className={`${isBottomBar ? 'p-2.5' : 'p-2'} rounded-lg transition-colors`}
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            title="Zahodit"
          >
            <svg width={isBottomBar ? 18 : 16} height={isBottomBar ? 18 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
