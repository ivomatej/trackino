'use client';

import { useState } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import WorkspaceSelector from '@/components/WorkspaceSelector';

import TabGeneral from './tabs/TabGeneral';
import TabSociety from './tabs/TabSociety';
import TabSubscription from './tabs/TabSubscription';
import TabBilling from './tabs/TabBilling';
import TabFields from './tabs/TabFields';
import TabVacation from './tabs/TabVacation';
import TabCooperation from './tabs/TabCooperation';
import TabModules from './tabs/TabModules';
import TabAI from './tabs/TabAI';
import TabAutomation from './tabs/TabAutomation';

type SettingsTab =
  | 'general' | 'society' | 'subscription' | 'billing'
  | 'fields' | 'vacation' | 'cooperation' | 'modules'
  | 'ai' | 'automation';

export default function SettingsContent() {
  const { currentWorkspace, currentMembership, loading, refreshWorkspace, hasModule } = useWorkspace();
  const { canAccessSettings, isMasterAdmin } = usePermissions();

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [message, setMessage] = useState('');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentWorkspace) return <WorkspaceSelector />;

  if (!canAccessSettings) {
    return (
      <DashboardLayout>
        <div>
          <h1 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Nastavení</h1>
          <p style={{ color: 'var(--text-muted)' }}>Nemáte oprávnění k nastavení workspace.</p>
        </div>
      </DashboardLayout>
    );
  }

  const tabs = [
    { id: 'general' as const, label: 'Obecné' },
    { id: 'society' as const, label: 'Společnost' },
    { id: 'subscription' as const, label: 'Předplatné' },
    { id: 'billing' as const, label: 'Fakturace' },
    { id: 'fields' as const, label: 'Povinná pole' },
    { id: 'vacation' as const, label: 'Dovolená' },
    { id: 'cooperation' as const, label: 'Spolupráce' },
    { id: 'modules' as const, label: 'Moduly' },
    { id: 'ai' as const, label: 'AI asistent' },
    ...(hasModule('automation') ? [{ id: 'automation' as const, label: 'Automatizace' }] : []),
  ];

  return (
    <DashboardLayout>
      <div className="max-w-5xl">
        <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Nastavení workspace</h1>

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
          {/* Navigační menu – horizontální scroll na mobilu, vertikální na desktopu */}
          <div className="relative w-full sm:w-44 flex-shrink-0">
            <nav
              className="flex flex-row sm:flex-col gap-0.5 p-1 rounded-xl overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ background: 'var(--bg-hover)' }}
            >
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setMessage(''); }}
                  className="flex-shrink-0 sm:w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                  style={{
                    background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
                    color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                    boxShadow: activeTab === tab.id ? 'var(--shadow-sm)' : 'none',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
            {/* Gradient indikátor scrollu – zobrazí se jen na mobilu */}
            <div
              className="sm:hidden absolute right-1 top-1 bottom-1 w-8 pointer-events-none rounded-r-xl"
              style={{ background: 'linear-gradient(to right, transparent, var(--bg-hover))' }}
            />
          </div>

          {/* Pravý obsah */}
          <div className="flex-1 min-w-0">
            {/* Zpráva */}
            {message && (
              <div
                className="mb-4 px-4 py-2 rounded-lg text-sm"
                style={{
                  background: message.startsWith('Chyba') ? 'var(--danger-light)' : 'var(--success-light)',
                  color: message.startsWith('Chyba') ? 'var(--danger)' : 'var(--success)',
                }}
              >
                {message}
              </div>
            )}

            {activeTab === 'general' && (
              <TabGeneral
                currentWorkspace={currentWorkspace}
                isMasterAdmin={isMasterAdmin}
                onMessage={setMessage}
                refreshWorkspace={refreshWorkspace}
              />
            )}

            {activeTab === 'society' && (
              <TabSociety
                currentWorkspace={currentWorkspace}
                onMessage={setMessage}
                refreshWorkspace={refreshWorkspace}
              />
            )}

            {activeTab === 'subscription' && (
              <TabSubscription
                currentWorkspace={currentWorkspace}
                isMasterAdmin={isMasterAdmin}
                currentMembership={currentMembership}
                onMessage={setMessage}
                refreshWorkspace={refreshWorkspace}
              />
            )}

            {activeTab === 'billing' && (
              <TabBilling
                workspaceId={currentWorkspace.id}
                onMessage={setMessage}
              />
            )}

            {activeTab === 'fields' && (
              <TabFields
                currentWorkspace={currentWorkspace}
                onMessage={setMessage}
                refreshWorkspace={refreshWorkspace}
              />
            )}

            {activeTab === 'vacation' && (
              <TabVacation workspaceId={currentWorkspace.id} />
            )}

            {activeTab === 'cooperation' && (
              <TabCooperation workspaceId={currentWorkspace.id} />
            )}

            {activeTab === 'modules' && (
              <TabModules
                workspaceId={currentWorkspace.id}
                tariff={currentWorkspace.tariff}
              />
            )}

            {activeTab === 'ai' && (
              <TabAI
                workspaceId={currentWorkspace.id}
                onMessage={setMessage}
              />
            )}

            {activeTab === 'automation' && (
              <TabAutomation
                workspaceId={currentWorkspace.id}
                onMessage={setMessage}
              />
            )}
          </div>{/* /Pravý obsah */}
        </div>{/* /flex gap-6 */}
      </div>
    </DashboardLayout>
  );
}
