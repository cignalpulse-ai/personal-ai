'use client';

import { SessionProvider, useSession, signOut } from "next-auth/react";
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Menu, Plus } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import ChatWorkspace from '@/components/ChatWorkspace';
import type { ChatSettings } from '@/components/Settings';
import { DEFAULT_SETTINGS } from '@/components/Settings';
import LoginCard from '@/components/LoginCard';
import type { TourStepConfig } from '@/components/OnboardingTour';
import { API_URL } from "@/lib/api";

const MemoryManager = dynamic(() => import('@/components/MemoryManager'));
const Settings = dynamic(() => import('@/components/Settings'));
const Reminders = dynamic(() => import('@/components/Reminders'));
const OnboardingTour = dynamic(() => import('@/components/OnboardingTour'), { ssr: false });

function AppContent() {
  const { data: session, status } = useSession();

  const [hasGoal, setHasGoal] = useState(false);
  const [primaryGoal, setPrimaryGoal] = useState("Assistant");
  const [goalInput, setGoalInput] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [activeTourTarget, setActiveTourTarget] = useState<string | null>(null);
  const [starterPrompt, setStarterPrompt] = useState("");

  const [activeTab, setActiveTab] = useState<'chat' | 'memory' | 'settings' | 'reminders'>('chat');
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [chatSessions, setChatSessions] = useState<{ session_id: string; created_at: string; title?: string }[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [chatSettings, setChatSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);

  const syncedEmailRef = useRef<string | null>(null);
  const userEmail = session?.user?.email || '';
  const userName = session?.user?.name || 'User';

  // Sync user with backend on login
  useEffect(() => {
    if (status === 'loading') return;

    if (!userEmail) {
      syncedEmailRef.current = null;
      setHasGoal(false);
      setShowTour(false);
      setActiveTourTarget(null);
      setIsSyncing(false);
      return;
    }

    if (syncedEmailRef.current === userEmail) return;
    syncedEmailRef.current = userEmail;
    setIsSyncing(true);

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail,
            name: userName,
          }),
        });

        if (!res.ok) {
          throw new Error(`Sync failed with status ${res.status}`);
        }

        const data = await res.json();
        if (cancelled) return;

        setHasGoal(Boolean(data.has_goal));
        if (data.primary_goal) {
          setPrimaryGoal(data.primary_goal);
        }

        if (data.has_goal) {
          const chatsRes = await fetch(
            `${API_URL}/api/chats?user_email=${encodeURIComponent(userEmail)}`
          );
          if (chatsRes.ok) {
            const chatsData = await chatsRes.json();
            if (!cancelled) {
              setChatSessions(Array.isArray(chatsData) ? chatsData : []);
            }
          }
        }
      } catch (err) {
        console.error('Auth sync error:', err);
        syncedEmailRef.current = null;
      } finally {
        if (!cancelled) {
          setIsSyncing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userEmail, userName, status]);

  // Show guided tour once per user after goal setup
  useEffect(() => {
    if (!userEmail || !hasGoal || isSyncing) return;
    const tourKey = `life_assistant_tour_seen_${userEmail}`;
    if (!localStorage.getItem(tourKey)) {
      setShowTour(true);
    }
  }, [userEmail, hasGoal, isSyncing]);

  const handleCompleteTour = () => {
    if (userEmail) {
      localStorage.setItem(`life_assistant_tour_seen_${userEmail}`, 'true');
    }
    setActiveTourTarget(null);
    setMobileMenuOpen(false);
    setShowTour(false);
  };

  const handleTourStepChange = (step: TourStepConfig) => {
    setActiveTourTarget(step.targetId);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileMenuOpen(Boolean(step.isSidebarTarget));
    }
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail || !goalInput.trim()) return;

    const res = await fetch(`${API_URL}/api/auth/goal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userEmail,
        primary_goal: goalInput.trim(),
      }),
    });

    if (res.ok) {
      setPrimaryGoal(goalInput.trim());
      setHasGoal(true);
    }
  };

  // Register Service Worker
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => console.error('SW registration failed', err));
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  // Load saved theme
  useEffect(() => {
    const saved = localStorage.getItem('chatSettings');
    if (saved) {
      try {
        setChatSettings((prev) => ({ ...prev, ...JSON.parse(saved) }));
      } catch {}
    }
  }, []);

  const handleSelectSession = async (sessionId: string) => {
    if (sessionId === currentSessionId) return;
    setCurrentSessionId(sessionId);
    setChatHistory([]);
    try {
      const query = userEmail ? `?user_email=${encodeURIComponent(userEmail)}` : '';
      const res = await fetch(`${API_URL}/api/chats/${sessionId}${query}`);
      const data = await res.json();
      setChatHistory(Array.isArray(data) ? data : []);
    } catch {
      setChatHistory([]);
    }
  };

  const handleNewChat = () => {
    setChatHistory([]);
    setCurrentSessionId('');
    setStarterPrompt('');
    setActiveTab('chat');
  };

  if (status === "loading" || (status === "authenticated" && isSyncing)) {
    return (
      <main className="h-dvh bg-[#131314] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#a8c7fa] text-[#062e6f] flex items-center justify-center font-bold">AI</div>
          <p className="text-sm text-[#c4c7c5]">Loading Assistant...</p>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="h-dvh w-full bg-[#131314]">
        <LoginCard />
      </main>
    );
  }

  if (!hasGoal) {
    return (
      <main className="h-dvh bg-[#131314] flex items-center justify-center p-4">
        <form onSubmit={handleSaveGoal} className="bg-[#1e1f20] p-6 sm:p-8 rounded-xl w-full max-w-md space-y-4 border border-[#333537]">
          <h2 className="text-white text-xl font-medium">Welcome, {userName}</h2>
          <p className="text-sm text-[#c4c7c5]">What is your primary goal for this assistant?</p>
          <input
            type="text"
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            placeholder="e.g. Life organizer & routine manager"
            className="w-full bg-[#28292a] text-white p-3 rounded-lg outline-none border border-[#444746] focus:border-[#a8c7fa]"
            required
          />
          <button type="submit" className="w-full bg-[#a8c7fa] text-[#062e6f] py-2.5 rounded-lg font-medium hover:bg-[#8ab4f8] transition">
            Start Using Assistant
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="h-dvh w-full bg-[#131314] text-[#e3e3e3] flex overflow-hidden">
      <Sidebar
        profile={{ user_name: userName, user_email: userEmail, primary_goal: primaryGoal }}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onNewChat={handleNewChat}
        chatSessions={chatSessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onLogout={() => signOut()}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        activeTourTarget={activeTourTarget}
      />
      <section className="flex-1 min-w-0 flex flex-col h-full bg-[#131314] relative overflow-hidden">
        {/* Mobile Header */}
        <header className="flex items-center justify-between px-3 py-2.5 border-b border-[#333537] bg-[#1e1f20] md:hidden shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg text-[#e3e3e3] hover:bg-[#28292a] transition"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="bg-[#a8c7fa] text-[#062e6f] px-1.5 py-0.5 rounded-full font-bold text-[10px]">AI</span>
            <span className="text-sm font-medium text-white">Life Assistant</span>
          </div>
          <button
            type="button"
            onClick={handleNewChat}
            className="p-2 rounded-lg text-[#e3e3e3] hover:bg-[#28292a] transition"
            aria-label="New chat"
            title="New chat"
          >
            <Plus className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {activeTab === 'memory' && <MemoryManager userEmail={userEmail} />}
          {activeTab === 'reminders' && <Reminders userName={userName} userEmail={userEmail} />}
          {activeTab === 'settings' && <Settings settings={chatSettings} setSettings={setChatSettings} />}
          {activeTab === 'chat' && (
            <ChatWorkspace
              userName={userName}
              userEmail={userEmail}
              chatHistory={chatHistory}
              setChatHistory={setChatHistory}
              sessionId={currentSessionId}
              setSessionId={setCurrentSessionId}
              initialPrompt={starterPrompt}
              onClearInitialPrompt={() => setStarterPrompt('')}
              onMessageSent={async () => {
                const query = userEmail ? `?user_email=${encodeURIComponent(userEmail)}` : '';
                const res = await fetch(`${API_URL}/api/chats${query}`);
                const data = await res.json();
                if (Array.isArray(data)) setChatSessions(data);
              }}
              settings={chatSettings}
            />
          )}
        </div>
      </section>

      {showTour && (
        <OnboardingTour
          onComplete={handleCompleteTour}
          onStepChange={handleTourStepChange}
        />
      )}
    </main>
  );
}

export default function Home() {
  return (
    <SessionProvider>
      <AppContent />
    </SessionProvider>
  );
}