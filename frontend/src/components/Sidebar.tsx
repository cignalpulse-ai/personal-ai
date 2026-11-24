'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  MessageSquare,
  Database,
  User,
  History,
  Bell,
  Settings as SettingsIcon,
  Clock,
  LogOut,
  X,
} from 'lucide-react';
import { API_URL } from '@/lib/api';

interface SidebarProps {
  profile: { user_name?: string; user_email?: string; primary_goal?: string };
  activeTab: 'chat' | 'memory' | 'settings' | 'reminders';
  setActiveTab: (tab: 'chat' | 'memory' | 'settings' | 'reminders') => void;
  onNewChat: () => void;
  chatSessions: { session_id: string; created_at: string; title?: string }[];
  currentSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onLogout: () => void | Promise<unknown>;
  isOpen?: boolean;
  onClose?: () => void;
  activeTourTarget?: string | null;
}

export default function Sidebar({
  profile,
  activeTab,
  setActiveTab,
  onNewChat,
  chatSessions,
  currentSessionId,
  onSelectSession,
  onLogout,
  isOpen = false,
  onClose,
  activeTourTarget = null,
}: SidebarProps) {
  const [reminders, setReminders] = useState<{ id: string; task: string; time: string }[]>([]);

  useEffect(() => {
    if (!profile.user_name && !profile.user_email) return;

    const params = new URLSearchParams();
    if (profile.user_email) params.set('user_email', profile.user_email);
    if (profile.user_name) params.set('user_name', profile.user_name);
    const qs = params.toString();

    const checkAll = async () => {
      try {
        const remRes = await fetch(`${API_URL}/api/reminders/due?${qs}`);
        const remData = await remRes.json();

        if (Array.isArray(remData) && remData.length > 0) {
          setReminders((prev) => {
            const newReminders = remData.filter((d: any) => !prev.some((p) => p.id === d.id));
            return [...prev, ...newReminders];
          });

          if ('Notification' in window && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((registration) => {
              remData.forEach((reminder: any) => {
                registration.active?.postMessage({
                  type: 'SHOW_NOTIFICATION',
                  title: 'Life Assistant Reminder',
                  body: reminder.task,
                  tag: reminder.id,
                });
              });
            });
          }
        }

        const notifRes = await fetch(`${API_URL}/api/notifications?${qs}`);
        const notifData = await notifRes.json();

        if (Array.isArray(notifData) && notifData.length > 0) {
          setReminders((prev) => {
            const newNotifs = notifData
              .filter((n: any) => !prev.some((p) => p.id === n.id))
              .map((n: any) => ({ id: n.id, task: `${n.title}\n${n.message}`, time: n.created_at }));
            return [...prev, ...newNotifs];
          });

          if ('Notification' in window && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((registration) => {
              notifData.forEach((notif: any) => {
                registration.active?.postMessage({
                  type: 'SHOW_NOTIFICATION',
                  title: notif.title,
                  body: notif.message,
                  tag: notif.id,
                });
                fetch(`${API_URL}/api/notifications/${notif.id}/read`, { method: 'POST' });
              });
            });
          }
        }
      } catch {
        // Ignore polling errors
      }
    };

    checkAll();
    const interval = setInterval(checkAll, 30000);
    return () => clearInterval(interval);
  }, [profile.user_name, profile.user_email]);

  const dismissReminder = (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const handleNavClick = (tab: 'chat' | 'memory' | 'settings' | 'reminders') => {
    setActiveTab(tab);
    onClose?.();
  };

  const isHighlighted = (target: string) => activeTourTarget === target;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
          aria-hidden="true"
        />
      )}

      {/* Floating Reminder Toasts (visible even when sidebar is closed on mobile) */}
      {reminders.length > 0 && (
        <div className="fixed top-14 right-3 z-50 space-y-2 w-64 max-w-[calc(100vw-1.5rem)]">
          {reminders.map((r) => (
            <div
              key={r.id}
              className="bg-[#004a77] border border-[#c2e7ff] p-3 rounded-lg shadow-lg text-xs text-white animate-slide-in"
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold flex items-center gap-1">
                  <Bell className="w-3 h-3" /> Reminder
                </span>
                <button
                  onClick={() => dismissReminder(r.id)}
                  className="text-[#c2e7ff] hover:text-white transition"
                >
                  X
                </button>
              </div>
              <p className="leading-tight whitespace-pre-wrap">{r.task}</p>
              <p className="text-[10px] text-[#c2e7ff] mt-1 opacity-80">
                {new Date(r.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ))}
        </div>
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 md:w-64 bg-[#1e1f20] flex flex-col justify-between p-3 border-r border-[#333537] select-none h-dvh overflow-hidden transition-transform duration-200 ease-out md:static md:translate-x-0 shrink-0 ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="space-y-4 overflow-y-auto no-scrollbar flex-1 pr-1">
          <div className="flex items-center justify-between px-2 py-2">
            <div className="flex items-center gap-2">
              <div className="bg-[#a8c7fa] text-[#062e6f] p-1.5 rounded-full font-bold text-xs">AI</div>
              <span className="font-medium text-sm text-white tracking-wide">Life Assistant</span>
            </div>
            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg text-[#c4c7c5] hover:text-white hover:bg-[#28292a] transition"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            data-tour-id="new-chat"
            onClick={() => {
              onNewChat();
              onClose?.();
            }}
            className={`flex items-center gap-3 bg-[#28292a] hover:bg-[#333537] text-white w-full px-3 py-2.5 rounded-full text-xs font-medium transition shadow-sm ${
              isHighlighted('new-chat') ? 'ring-2 ring-[#a8c7fa] bg-[#333537]' : ''
            }`}
          >
            <Plus className="w-4 h-4" /> New Chat
          </button>

          <div className="space-y-1 pt-2">
            <p className="px-3 text-[11px] font-semibold text-[#c4c7c5] uppercase tracking-wider">Navigation</p>
            <button
              type="button"
              data-tour-id="nav-chat"
              onClick={() => handleNavClick('chat')}
              className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xs transition ${
                activeTab === 'chat' ? 'bg-[#004a77] text-[#c2e7ff]' : 'hover:bg-[#28292a] text-[#e3e3e3]'
              } ${isHighlighted('nav-chat') ? 'ring-2 ring-[#a8c7fa]' : ''}`}
            >
              <MessageSquare className="w-4 h-4" /> Chat Workspace
            </button>
            <button
              type="button"
              data-tour-id="nav-reminders"
              onClick={() => handleNavClick('reminders')}
              className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xs transition ${
                activeTab === 'reminders' ? 'bg-[#004a77] text-[#c2e7ff]' : 'hover:bg-[#28292a] text-[#e3e3e3]'
              } ${isHighlighted('nav-reminders') ? 'ring-2 ring-[#a8c7fa]' : ''}`}
            >
              <Clock className="w-4 h-4" /> Reminders
            </button>
            <button
              type="button"
              data-tour-id="nav-memory"
              onClick={() => handleNavClick('memory')}
              className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xs transition ${
                activeTab === 'memory' ? 'bg-[#004a77] text-[#c2e7ff]' : 'hover:bg-[#28292a] text-[#e3e3e3]'
              } ${isHighlighted('nav-memory') ? 'ring-2 ring-[#a8c7fa]' : ''}`}
            >
              <Database className="w-4 h-4" /> Memory & Routine
            </button>
            <button
              type="button"
              data-tour-id="nav-settings"
              onClick={() => handleNavClick('settings')}
              className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xs transition ${
                activeTab === 'settings' ? 'bg-[#004a77] text-[#c2e7ff]' : 'hover:bg-[#28292a] text-[#e3e3e3]'
              } ${isHighlighted('nav-settings') ? 'ring-2 ring-[#a8c7fa]' : ''}`}
            >
              <SettingsIcon className="w-4 h-4" /> Settings
            </button>
          </div>

          {/* Past Chat Sessions History List */}
          <div data-tour-id="recent-chats" className={`space-y-1 pt-4 rounded-lg ${isHighlighted('recent-chats') ? 'ring-2 ring-[#a8c7fa] p-1.5 bg-[#28292a]/50' : ''}`}>
            <p className="px-3 text-[11px] font-semibold text-[#c4c7c5] uppercase tracking-wider flex items-center gap-2">
              <History className="w-3 h-3" /> Recent Chats
            </p>
            <div className="space-y-1 mt-1">
              {Array.isArray(chatSessions) &&
                chatSessions.map((session) => (
                  <button
                    key={session.session_id}
                    type="button"
                    onClick={() => {
                      setActiveTab('chat');
                      onSelectSession(session.session_id);
                      onClose?.();
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs truncate transition ${
                      currentSessionId === session.session_id
                        ? 'bg-[#333537] text-white font-medium'
                        : 'text-[#c4c7c5] hover:bg-[#28292a] hover:text-white'
                    }`}
                  >
                    {session.title || `Chat ${session.session_id.slice(0, 6)}`}
                  </button>
                ))}
            </div>
          </div>
        </div>

        <div className="border-t border-[#333537] pt-3 flex items-center justify-between px-2 shrink-0 mt-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-[#004a77] text-[#c2e7ff] p-2 rounded-full text-xs shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{profile.user_name}</p>
              <p className="text-[10px] text-[#c4c7c5] truncate max-w-[130px]">{profile.primary_goal}</p>
            </div>
          </div>
          <button
            type="button"
            data-tour-id="logout-btn"
            onClick={onLogout}
            className={`p-2 rounded-lg text-[#c4c7c5] hover:text-red-400 hover:bg-[#28292a] transition shrink-0 ${
              isHighlighted('logout-btn') ? 'ring-2 ring-[#a8c7fa] text-white bg-[#28292a]' : ''
            }`}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  );
}