'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trash2, Calendar, Clock, CheckCircle } from 'lucide-react';
import { API_URL } from '@/lib/api';

interface Reminder {
  id: string;
  task: string;
  time: string;
  is_sent: boolean;
}

interface RemindersProps {
  userName: string;
  userEmail?: string;
}

export default function Reminders({ userName, userEmail = '' }: RemindersProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReminders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (userEmail) params.set('user_email', userEmail);
      if (userName) params.set('user_name', userName);

      const res = await fetch(`${API_URL}/api/reminders?${params.toString()}`);
      const data = await res.json();
      if (Array.isArray(data)) setReminders(data);
    } catch (err) {
      console.error('Failed to load reminders', err);
    } finally {
      setLoading(false);
    }
  }, [userEmail, userName]);

  useEffect(() => {
    if (userName || userEmail) fetchReminders();
  }, [userName, userEmail, fetchReminders]);

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/reminders/${id}`, {
        method: 'DELETE',
      });
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Failed to delete reminder', err);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/reminders/${id}/complete`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.status === 'success') {
        setReminders((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (err) {
      console.error('Failed to complete reminder', err);
    }
  };

  return (
    <div className="flex-1 p-8 max-w-2xl mx-auto w-full space-y-6 overflow-y-auto no-scrollbar">
      <div>
        <h2 className="text-xl font-normal text-white">Your Reminders</h2>
        <p className="text-xs text-[#c4c7c5] mt-1">Manage your upcoming schedules and tasks.</p>
      </div>

      {loading ? (
        <div className="text-sm text-[#c4c7c5] animate-pulse">Loading reminders...</div>
      ) : reminders.length === 0 ? (
        <div className="bg-[#1e1f20] border border-[#333537] rounded-xl p-8 text-center text-[#c4c7c5] text-sm">
          No upcoming reminders. Try asking the AI: "Remind me to call mom tomorrow at 3pm."
        </div>
      ) : (
        <div className="space-y-3">
          {reminders.map((r) => {
            const dateObj = new Date(r.time);
            const isPast = dateObj < new Date();
            return (
              <div
                key={r.id}
                className={`bg-[#1e1f20] border rounded-xl p-4 flex items-center justify-between transition group ${
                  isPast ? 'border-[#6f2c3a] opacity-70' : 'border-[#333537]'
                }`}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-white">{r.task}</span>
                  <div className="flex items-center gap-3 text-[11px] text-[#c4c7c5]">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isPast && <span className="text-[#ff8a8a]">(Passed)</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleComplete(r.id)}
                    className="p-2 rounded-lg text-[#c4c7c5] hover:bg-[#333537] hover:text-green-400 transition"
                    title="Mark as completed"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(r.id)}
                    className="p-2 rounded-lg text-[#c4c7c5] hover:bg-[#333537] hover:text-red-400 transition"
                    title="Delete reminder"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}