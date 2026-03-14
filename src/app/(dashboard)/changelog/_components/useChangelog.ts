import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { DEFAULT_CHANGELOG } from './default-content';

export interface UseChangelogReturn {
  content: string;
  loading: boolean;
  editing: boolean;
  saving: boolean;
  editorRef: React.RefObject<HTMLDivElement | null>;
  saveContent: () => Promise<void>;
  startEditing: () => void;
  cancelEditing: () => void;
  execCmd: (cmd: string, value?: string) => void;
}

export function useChangelog(): UseChangelogReturn {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const fetchContent = useCallback(async () => {
    const { data } = await supabase
      .from('trackino_changelog_content')
      .select('*')
      .limit(1)
      .single();

    if (data?.content && data.content.trim()) {
      setContent(data.content);
    } else {
      setContent(DEFAULT_CHANGELOG);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchContent(); }, [fetchContent]);

  const saveContent = async () => {
    if (!user) return;
    setSaving(true);
    const newContent = editorRef.current?.innerHTML ?? '';

    const { data: existing } = await supabase
      .from('trackino_changelog_content')
      .select('id')
      .limit(1)
      .single();

    if (existing?.id) {
      await supabase.from('trackino_changelog_content').update({
        content: newContent,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      }).eq('id', existing.id);
    } else {
      await supabase.from('trackino_changelog_content').insert({
        content: newContent,
        updated_by: user.id,
      });
    }

    setContent(newContent);
    setSaving(false);
    setEditing(false);
  };

  const startEditing = () => {
    setEditing(true);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = content;
        editorRef.current.focus();
      }
    }, 0);
  };

  const cancelEditing = () => setEditing(false);

  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  };

  return {
    content,
    loading,
    editing,
    saving,
    editorRef,
    saveContent,
    startEditing,
    cancelEditing,
    execCmd,
  };
}
