export interface PlayData {
  description: string;
  projectId: string;
  categoryId: string;
  taskId: string;
  tagIds: string[];
  ts: number;
}

export interface TimerBarProps {
  onEntryChanged?: () => void;
  playData?: PlayData | null;
  isBottomBar?: boolean;
}
