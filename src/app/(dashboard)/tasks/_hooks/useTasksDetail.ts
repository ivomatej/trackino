'use client';

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { TaskItem, TaskSubtask, TaskComment, TaskAttachment, TaskHistory, TaskColumn } from '@/types/database';
import type { Member } from '../types';

interface UseTasksDetailParams {
  selectedTask: TaskItem | null;
  setSelectedTask: React.Dispatch<React.SetStateAction<TaskItem | null>>;
  updateTask: (taskId: string, updates: Partial<TaskItem>, historyAction?: string, oldVal?: string, newVal?: string) => Promise<void>;
  user: User | null;
  wsId: string | undefined;
  sortedColumns: TaskColumn[];
  tasks: TaskItem[];
  subtasks: TaskSubtask[];
  setSubtasks: React.Dispatch<React.SetStateAction<TaskSubtask[]>>;
  comments: TaskComment[];
  setComments: React.Dispatch<React.SetStateAction<TaskComment[]>>;
  attachments: TaskAttachment[];
  setAttachments: React.Dispatch<React.SetStateAction<TaskAttachment[]>>;
  members: Member[];
}

// ──────────────────────────────────────────────
// Detail panel hook – state + operations for task detail
// ──────────────────────────────────────────────
export function useTasksDetail({
  selectedTask, setSelectedTask,
  updateTask,
  user, wsId,
  sortedColumns, tasks,
  subtasks, setSubtasks,
  comments, setComments,
  attachments, setAttachments,
  members,
}: UseTasksDetailParams) {
  // ── State ──
  const [detailSubtasks, setDetailSubtasks] = useState<TaskSubtask[]>([]);
  const [detailComments, setDetailComments] = useState<TaskComment[]>([]);
  const [detailAttachments, setDetailAttachments] = useState<TaskAttachment[]>([]);
  const [detailHistory, setDetailHistory] = useState<TaskHistory[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [savingDesc, setSavingDesc] = useState(false);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [showAllHistory, setShowAllHistory] = useState(false);

  // ── Refs ──
  const descRef = useRef<HTMLDivElement>(null);
  const commentRef = useRef<HTMLDivElement>(null);

  // ── Open detail ──
  const openDetail = useCallback(async (task: TaskItem) => {
    setSelectedTask(task);
    setEditTitle(task.title);
    setEditDesc(task.description);
    setEditingTitle(false);
    setShowAllHistory(false);
    setNewComment('');
    setNewSubtaskText('');
    const [sRes, cRes, aRes, hRes] = await Promise.all([
      supabase.from('trackino_task_subtasks').select('*').eq('task_id', task.id).order('sort_order'),
      supabase.from('trackino_task_comments').select('*').eq('task_id', task.id).order('created_at', { ascending: true }),
      supabase.from('trackino_task_attachments').select('*').eq('task_id', task.id).order('created_at'),
      supabase.from('trackino_task_history').select('*').eq('task_id', task.id).order('created_at', { ascending: false }),
    ]);
    setDetailSubtasks((sRes.data ?? []) as TaskSubtask[]);
    setDetailComments((cRes.data ?? []) as TaskComment[]);
    setDetailAttachments((aRes.data ?? []) as TaskAttachment[]);
    setDetailHistory((hRes.data ?? []) as TaskHistory[]);
  }, [setSelectedTask]);

  // ── Detail actions ──
  const saveTitle = useCallback(async () => {
    if (!selectedTask || !editTitle.trim()) return;
    setEditingTitle(false);
    await updateTask(selectedTask.id, { title: editTitle.trim() }, 'title_changed', selectedTask.title, editTitle.trim());
    setSelectedTask(prev => prev ? { ...prev, title: editTitle.trim() } : null);
  }, [selectedTask, editTitle, updateTask, setSelectedTask]);

  const saveDescription = useCallback(async () => {
    if (!selectedTask) return;
    setSavingDesc(true);
    const html = descRef.current?.innerHTML ?? '';
    await updateTask(selectedTask.id, { description: html }, 'description_changed');
    setSelectedTask(prev => prev ? { ...prev, description: html } : null);
    setSavingDesc(false);
  }, [selectedTask, updateTask, setSelectedTask]);

  const addSubtask = useCallback(async (text: string) => {
    if (!selectedTask || !text.trim()) return;
    const maxOrder = detailSubtasks.length > 0 ? Math.max(...detailSubtasks.map(s => s.sort_order)) + 1 : 0;
    const { data } = await supabase.from('trackino_task_subtasks').insert({ task_id: selectedTask.id, title: text.trim(), sort_order: maxOrder }).select().single();
    if (data) {
      setDetailSubtasks(prev => [...prev, data as TaskSubtask]);
      setSubtasks(prev => [...prev, data as TaskSubtask]);
    }
  }, [selectedTask, detailSubtasks, setSubtasks]);

  const toggleSubtask = useCallback(async (subId: string, done: boolean) => {
    await supabase.from('trackino_task_subtasks').update({ is_done: done }).eq('id', subId);
    setDetailSubtasks(prev => prev.map(s => s.id === subId ? { ...s, is_done: done } : s));
    setSubtasks(prev => prev.map(s => s.id === subId ? { ...s, is_done: done } : s));
  }, [setSubtasks]);

  const deleteSubtask = useCallback(async (subId: string) => {
    await supabase.from('trackino_task_subtasks').delete().eq('id', subId);
    setDetailSubtasks(prev => prev.filter(s => s.id !== subId));
    setSubtasks(prev => prev.filter(s => s.id !== subId));
  }, [setSubtasks]);

  const addComment = useCallback(async () => {
    if (!selectedTask || !user || !newComment.trim()) return;
    const { data } = await supabase.from('trackino_task_comments').insert({ task_id: selectedTask.id, user_id: user.id, content: newComment.trim() }).select().single();
    if (data) {
      setDetailComments(prev => [...prev, data as TaskComment]);
      setComments(prev => [...prev, data as TaskComment]);
      setNewComment('');
      await supabase.from('trackino_task_history').insert({ task_id: selectedTask.id, user_id: user.id, action: 'comment_added' });
    }
  }, [selectedTask, user, newComment, setComments]);

  const deleteComment = useCallback(async (cId: string) => {
    await supabase.from('trackino_task_comments').delete().eq('id', cId);
    setDetailComments(prev => prev.filter(c => c.id !== cId));
    setComments(prev => prev.filter(c => c.id !== cId));
  }, [setComments]);

  const uploadFile = useCallback(async (file: File) => {
    if (!selectedTask || !wsId || !user) return;
    const ext = file.name.split('.').pop() ?? '';
    const path = `${wsId}/${selectedTask.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('trackino-task-attachments').upload(path, file);
    if (error) { alert('Chyba nahrávání: ' + error.message); return; }
    const { data } = await supabase.from('trackino_task_attachments').insert({
      task_id: selectedTask.id, file_path: path, file_name: file.name, file_size: file.size, file_mime: file.type, uploaded_by: user.id,
    }).select().single();
    if (data) {
      setDetailAttachments(prev => [...prev, data as TaskAttachment]);
      setAttachments(prev => [...prev, data as TaskAttachment]);
      await supabase.from('trackino_task_history').insert({ task_id: selectedTask.id, user_id: user.id, action: 'attachment_added', new_value: file.name });
    }
  }, [selectedTask, wsId, user, setAttachments]);

  const deleteAttachment = useCallback(async (att: TaskAttachment) => {
    await supabase.storage.from('trackino-task-attachments').remove([att.file_path]);
    await supabase.from('trackino_task_attachments').delete().eq('id', att.id);
    setDetailAttachments(prev => prev.filter(a => a.id !== att.id));
    setAttachments(prev => prev.filter(a => a.id !== att.id));
    if (user && selectedTask) {
      await supabase.from('trackino_task_history').insert({ task_id: selectedTask.id, user_id: user.id, action: 'attachment_removed', old_value: att.file_name });
    }
  }, [user, selectedTask, setAttachments]);

  const downloadAttachment = useCallback(async (att: TaskAttachment) => {
    const { data } = await supabase.storage.from('trackino-task-attachments').createSignedUrl(att.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }, []);

  const moveTaskTo = useCallback(async (task: TaskItem, colId: string) => {
    const oldCol = sortedColumns.find(c => c.id === task.column_id);
    const newCol = sortedColumns.find(c => c.id === colId);
    const colTasks = tasks.filter(t => t.column_id === colId);
    const maxOrder = colTasks.length > 0 ? Math.max(...colTasks.map(t => t.sort_order)) + 1 : 0;
    await updateTask(task.id, { column_id: colId, sort_order: maxOrder }, 'moved', oldCol?.name, newCol?.name);
    if (selectedTask?.id === task.id) setSelectedTask(prev => prev ? { ...prev, column_id: colId } : null);
  }, [sortedColumns, tasks, updateTask, selectedTask, setSelectedTask]);

  // ── History helper ──
  const historyText = useCallback((h: TaskHistory) => {
    const actor = members.find(m => m.user_id === h.user_id)?.display_name ?? '?';
    switch (h.action) {
      case 'created': return `${actor} vytvořil(a) úkol`;
      case 'moved': return `${actor} přesunul(a) z „${h.old_value}" do „${h.new_value}"`;
      case 'assigned': return `${actor} přiřadil(a) řešitele: ${h.new_value || 'Nepřiřazen'}`;
      case 'priority_changed': return `${actor} změnil(a) prioritu: ${h.new_value}`;
      case 'deadline_changed': return `${actor} změnil(a) termín: ${h.new_value || 'odstraněn'}`;
      case 'comment_added': return `${actor} přidal(a) komentář`;
      case 'attachment_added': return `${actor} přidal(a) soubor: ${h.new_value}`;
      case 'attachment_removed': return `${actor} odebral(a) soubor: ${h.old_value}`;
      case 'title_changed': return `${actor} přejmenoval(a): „${h.old_value}" → „${h.new_value}"`;
      case 'description_changed': return `${actor} upravil(a) popis`;
      case 'completed': return `${actor} dokončil(a) úkol`;
      case 'reopened': return `${actor} znovu otevřel(a) úkol`;
      default: return `${actor}: ${h.action}`;
    }
  }, [members]);

  return {
    // State
    detailSubtasks, setDetailSubtasks,
    detailComments, setDetailComments,
    detailAttachments, setDetailAttachments,
    detailHistory,
    newComment, setNewComment,
    editingTitle, setEditingTitle,
    editTitle, setEditTitle,
    editDesc, setEditDesc,
    savingDesc,
    newSubtaskText, setNewSubtaskText,
    showAllHistory, setShowAllHistory,
    // Refs
    descRef, commentRef,
    // Functions
    openDetail,
    saveTitle,
    saveDescription,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    addComment,
    deleteComment,
    uploadFile,
    deleteAttachment,
    downloadAttachment,
    moveTaskTo,
    historyText,
  };
}
