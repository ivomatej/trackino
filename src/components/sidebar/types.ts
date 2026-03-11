import { ReactNode } from 'react';

export interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed?: boolean;
  onCollapseDesktop?: () => void;
}

export interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export interface BadgeCounts {
  pendingVacation: number;
  returnedInvoice: number;
  pendingInvoiceApproval: number;
  pendingRequest: number;
  unresolvedFeedback: number;
}
