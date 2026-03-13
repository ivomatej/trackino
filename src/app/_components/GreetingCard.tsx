'use client';

import { getCzechDay } from './utils';

interface GreetingCardProps {
  greetingPrefix: string;
  nickname: string;
  today: Date;
  nameDay: string | null;
  todayHoliday: { isHoliday: boolean; name: string };
}

export function GreetingCard({ greetingPrefix, nickname, today, nameDay, todayHoliday }: GreetingCardProps) {
  return (
    <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            {greetingPrefix}, {nickname}!
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Tady máš přehled aktivit. Ať ti jde práce od ruky!
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {getCzechDay(today)}
          </div>
          {(nameDay || todayHoliday.isHoliday) && (
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {todayHoliday.isHoliday
                ? <span style={{ color: 'var(--primary)' }}>🎉 {todayHoliday.name}</span>
                : <>Dnes slaví svátek: <strong style={{ color: 'var(--text-secondary)' }}>{nameDay}</strong></>
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
