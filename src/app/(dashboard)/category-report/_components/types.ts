export type Preset = 'today' | 'week' | 'month' | 'custom';

export interface CategoryStats {
  categoryId: string | null;
  name: string;
  totalSeconds: number;
  count: number;
  color: string;
}
