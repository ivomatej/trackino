'use client';

import type { Subscription, SubscriptionCategory } from '@/types/database';
import { ICONS } from './constants';

interface CategoriesTabContentProps {
  categories: SubscriptionCategory[];
  rootCategories: SubscriptionCategory[];
  getSubcategories: (parentId: string) => SubscriptionCategory[];
  getCatCountWithSubs: (catId: string) => number;
  subs: Subscription[];
  canManage: boolean;
  openNewCat: (parentId?: string) => void;
  openEditCat: (c: SubscriptionCategory) => void;
  deleteCat: (c: SubscriptionCategory) => void;
}

export function CategoriesTabContent({
  categories, rootCategories, getSubcategories, getCatCountWithSubs,
  subs, canManage, openNewCat, openEditCat, deleteCat,
}: CategoriesTabContentProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {categories.length === 0 && (
        <p className="text-sm col-span-full py-10 text-center" style={{ color: 'var(--text-muted)' }}>
          Zatím žádné kategorie
        </p>
      )}
      {rootCategories.map(c => {
        const subCats = getSubcategories(c.id);
        const totalCount = getCatCountWithSubs(c.id);
        return (
          <div key={c.id} className="col-span-1">
            {/* Nadřazená kategorie */}
            <div
              className="rounded-xl border p-4 flex items-center gap-3 group"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: c.color }} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {totalCount} předplatn{totalCount === 1 ? 'é' : totalCount >= 2 && totalCount <= 4 ? 'á' : 'ých'}
                  {subCats.length > 0 && ` · ${subCats.length} podkategori${subCats.length === 1 ? 'e' : subCats.length >= 2 && subCats.length <= 4 ? 'e' : 'í'}`}
                </p>
              </div>
              {canManage && (
                <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button
                    className="p-1.5 rounded-lg"
                    title="Přidat podkategorii"
                    style={{ color: 'var(--text-muted)' }}
                    onClick={() => openNewCat(c.id)}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >{ICONS.plus}</button>
                  <button
                    className="p-1.5 rounded-lg"
                    style={{ color: 'var(--text-muted)' }}
                    onClick={() => openEditCat(c)}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >{ICONS.edit}</button>
                  <button
                    className="p-1.5 rounded-lg"
                    style={{ color: 'var(--text-muted)' }}
                    onClick={() => deleteCat(c)}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >{ICONS.trash}</button>
                </div>
              )}
            </div>
            {/* Podkategorie */}
            {subCats.length > 0 && (
              <div className="ml-5 mt-1 space-y-1">
                {subCats.map(sc => {
                  const scCount = subs.filter(s => s.category_id === sc.id).length;
                  return (
                    <div
                      key={sc.id}
                      className="rounded-lg border px-3 py-2.5 flex items-center gap-2.5 group/sub"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                    >
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: sc.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{sc.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{scCount} předplatn{scCount === 1 ? 'é' : scCount >= 2 && scCount <= 4 ? 'á' : 'ých'}</p>
                      </div>
                      {canManage && (
                        <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover/sub:opacity-100 transition-opacity">
                          <button
                            className="p-1.5 rounded-lg"
                            style={{ color: 'var(--text-muted)' }}
                            onClick={() => openEditCat(sc)}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                          >{ICONS.edit}</button>
                          <button
                            className="p-1.5 rounded-lg"
                            style={{ color: 'var(--text-muted)' }}
                            onClick={() => deleteCat(sc)}
                            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                          >{ICONS.trash}</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
