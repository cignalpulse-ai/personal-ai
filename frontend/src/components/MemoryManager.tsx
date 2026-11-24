'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trash2, FileText, StickyNote, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { API_URL } from '@/lib/api';

interface MemoryManagerProps {
  userEmail?: string;
}

interface MemoryItem {
  id: string;
  filename: string;
  content_snippet: string;
  uploaded_at: string | null;
}

export default function MemoryManager({ userEmail = '' }: MemoryManagerProps) {
  const [noteText, setNoteText] = useState('');
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusBanner({ type, text });
    setTimeout(() => setStatusBanner(null), 3500);
  };

  const fetchMemories = useCallback(async () => {
    try {
      const query = userEmail ? `?user_email=${encodeURIComponent(userEmail)}` : '';
      const res = await fetch(`${API_URL}/api/notes${query}`);
      const data = await res.json();
      if (Array.isArray(data)) setMemories(data);
    } catch (err) {
      console.error('Failed to load memories:', err);
    } finally {
      setLoadingList(false);
    }
  }, [userEmail]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_id: `note_${Date.now()}`,
          text: noteText,
          user_email: userEmail || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to save note');
      setNoteText('');
      showStatus('success', 'Memory note indexed into vector database!');
      fetchMemories();
    } catch {
      showStatus('error', 'Failed to save memory note.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    if (userEmail) {
      formData.append('user_email', userEmail);
    }

    try {
      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      showStatus('success', `Uploaded ${data.filename} and indexed into RAG!`);
      fetchMemories();
    } catch {
      showStatus('error', 'Failed to upload document.');
    } finally {
      e.target.value = '';
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/notes/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMemories((prev) => prev.filter((m) => m.id !== id));
        showStatus('success', 'Memory item removed.');
      }
    } catch {
      showStatus('error', 'Failed to delete memory item.');
    }
  };

  return (
    <div className="flex-1 p-8 max-w-2xl mx-auto w-full space-y-6 overflow-y-auto no-scrollbar">
      <div>
        <h2 className="text-xl font-normal text-white">Manage Personal Memory</h2>
        <p className="text-xs text-[#c4c7c5] mt-1">Add text routines or upload documents to sync with Neon & vector memory.</p>
      </div>

      {statusBanner && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs border ${
            statusBanner.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {statusBanner.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusBanner.text}</span>
        </div>
      )}

      <Card className="bg-[#1e1f20] border-[#333537] text-white">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Upload Document (.txt / .md)</CardTitle>
        </CardHeader>
        <CardContent>
          <input
            type="file"
            accept=".txt,.md"
            onChange={handleFileUpload}
            className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#004a77] file:text-[#c2e7ff] hover:file:bg-[#005a93] cursor-pointer"
          />
        </CardContent>
      </Card>

      <Card className="bg-[#1e1f20] border-[#333537] text-white">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Add Quick Routine / Note</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddNote} className="space-y-3">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="e.g., Deep work coding is from 9 AM to 12 PM daily..."
              className="bg-[#28292a] border-[#444746] text-white h-32 text-xs resize-none focus-visible:ring-blue-500"
            />
            <Button
              type="submit"
              disabled={submitting || !noteText.trim()}
              className="bg-[#a8c7fa] hover:bg-[#8ab4f8] text-[#062e6f] text-xs font-medium w-full"
            >
              {submitting ? 'Indexing...' : 'Ingest into Vector DB'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Saved Memories List */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-white">Indexed Memories ({memories.length})</h3>
        {loadingList ? (
          <p className="text-xs text-[#c4c7c5] animate-pulse">Loading saved memories...</p>
        ) : memories.length === 0 ? (
          <div className="bg-[#1e1f20] border border-[#333537] rounded-xl p-6 text-center text-xs text-[#c4c7c5]">
            No memories saved yet. Add a note or upload a file above.
          </div>
        ) : (
          <div className="space-y-2.5">
            {memories.map((item) => (
              <div
                key={item.id}
                className="bg-[#1e1f20] border border-[#333537] rounded-xl p-4 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-[#28292a] text-[#a8c7fa] shrink-0 mt-0.5">
                    {item.filename === 'Manual Note' ? (
                      <StickyNote className="w-4 h-4" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{item.filename}</p>
                    <p className="text-xs text-[#c4c7c5] line-clamp-2 mt-1">{item.content_snippet}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteMemory(item.id)}
                  className="p-2 rounded-lg text-[#c4c7c5] hover:bg-[#333537] hover:text-red-400 transition shrink-0"
                  title="Delete memory"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}