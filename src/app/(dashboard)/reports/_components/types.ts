export interface MemberProfile {
  member_id: string; // workspace_member id (pro párování sazeb)
  user_id: string;
  display_name: string;
  email: string;
}

export type DatePreset = 'today' | 'week' | 'month' | 'custom';

export const PRESETS: { label: string; value: DatePreset }[] = [
  { label: 'Dnes', value: 'today' },
  { label: 'Tento týden', value: 'week' },
  { label: 'Tento měsíc', value: 'month' },
  { label: 'Vlastní', value: 'custom' },
];
