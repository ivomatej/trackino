import type { Invoice, Profile } from '@/types/database';

export type ViewTab = 'my' | 'approve' | 'billing';

export interface InvoiceWithUser extends Invoice {
  profile?: Profile;
}
