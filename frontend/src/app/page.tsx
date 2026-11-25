'use client';

import { SessionProvider, useSession, signOut } from "next-auth/react";
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Menu, Plus, Sparkles, X } from 'lucide-react';
import type { ChatSettings } from '@/components/Settings';
import { DEFAULT_SETTINGS } from '@/components/Settings';
import LoginCard from '@/components/LoginCard';
import type { TourStepConfig } from '@/components/OnboardingTour';
import { API_URL } from "@/lib/api";

const Sidebar = dynamic(() => import('@/components/Sidebar'));
const ChatWorkspace = dynamic(() => import('@/components/ChatWorkspace'));
const MemoryManager = dynamic(() => import('@/components/MemoryManager'));
const Settings = dynamic(() => import('@/components/Settings'));
const Reminders = dynamic(() => import('@/components/Reminders'));
const OnboardingTour = dynamic(() => import('@/components/OnboardingTour'), { ssr: false });

const GUEST_STORAGE_KEY = 'life_assistant_guest_email';

function getOrCreateGuestEmail(): string {
  if (typeof window === 'undefined') return '';
  let existing = localStorage.getItem(GUEST_STORAGE_KEY);
  if (!existing) {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    existing = `guest_${id}@guest.cignalpulse.local`;
    localStorage.setItem(GUEST_STORAGE_KEY, existing);
  }
  return existing;
}

function AppContent() {
  const { data: session, status } = useSession();

  const [guestEmail, setGuestEmail] = useState<string>('');
  const [hasGoal, setHasGoal] = useState(false);
  const [primaryGoal, setPrimaryGoal] = useState("Personal & Everyday Assistant");
  const [goalInput, setGoalInput] = useState("");
  const [isSyncing, setIsSyncing] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [activeTourTarget, setActiveTourTarget] = useState<string | null>(null);
  const [starterPrompt, setStarterPrompt] = useState("");
  const [authModalReason, setAuthModalReason] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'chat' | 'memory' | 'settings' | 'reminders'>('chat');
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [chatSessions, setChatSessions] = useState<{ session_id: string; created_at: string; title?: string }[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [chatSettings, setChatSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);

  const syncedIdentityRef = useRef<string | null>(null);

  const isAuthenticated = status === 'authenticated' && Boolean(session?.user?.email);
  const isGuest = !isAuthenticated;
  const activeEmail = isAuthenticated ? session!.user!.email! : guestEmail;
  const activeName = isAuthenticated ? (session!.user!.name || 'User') : 'Guest';

  // Initialize guest email on client when unauthenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      setGuestEmail(getOrCreateGuestEmail());
    }
  }, [status]);

  // Sync guest or authenticated user (and claim guest history on sign-in)
  useEffect(() => {
    if (status === 'loading') return;
    if (!activeEmail) return;

    if (syncedIdentityRef.current === activeEmail) return;
    syncedIdentityRef.current = activeEmail;
    setIsSyncing(true);

    let cancelled = false;

    (async () => {
      try {
        // 1. If user just signed in with Google and had a guest session, claim it first
        if (isAuthenticated && typeof window !== 'undefined') {
          const pendingGuestEmail = localStorage.getItem(GUEST_STORAGE_KEY);
          if (pendingGuestEmail && pendingGuestEmail !== activeEmail) {
            await fetch(`${API_URL}/api/auth/claim-guest`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                guest_email: pendingGuestEmail,
                email: activeEmail,
                name: activeName,
              }),
            });
            localStorage.removeItem(GUEST_STORAGE_KEY);
            setGuestEmail('');
            setAuthModalReason(null);
          }
        }

        // 2. Sync active profile (guest or real user)
        const res = await fetch(`${API_URL}/api/auth/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: activeEmail,
            name: activeName,
          }),
        });

        if (!res.ok) throw new Error(`Sync failed with status ${res.status}`);

        const data = await res.json();
        if (cancelled) return;

        // Guests skip the goal onboarding wall so they can test immediately
        if (isGuest) {
          setHasGoal(true);
          if (data.primary_goal) setPrimaryGoal(data.primary_goal);
        } else {
          setHasGoal(Boolean(data.has_goal));
          if (data.primary_goal) setPrimaryGoal(data.primary_goal);
        }

        // 3. Load chat history sessions
        const chatsRes = await fetch(
          `${API_URL}/api/chats?user_email=${encodeURIComponent(activeEmail)}`
        );
        if (chatsRes.ok) {
          const chatsData = await chatsRes.json();
          if (!cancelled) {
            setChatSessions(Array.isArray(chatsData) ? chatsData : []);
          }
        }
      } catch (err) {
        console.error('Auth/Guest sync error:', err);
        syncedIdentityRef.current = null;
        if (isGuest) setHasGoal(true);
      } finally {
        if (!cancelled) {
          setIsSyncing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeEmail, activeName, isAuthenticated, isGuest, status]);

  // Show guided tour once per user
  useEffect(() => {
    if (!activeEmail || !hasGoal || isSyncing) return;
    const tourKey = `life_assistant_tour_seen_${activeEmail}`;
    if (!localStorage.getItem(tourKey)) {
      setShowTour(true);
    }
  }, [activeEmail, hasGoal, isSyncing]);

  const handleCompleteTour = () => {
    if (activeEmail) {
      localStorage.setItem(`life_assistant_tour_seen_${activeEmail}`, 'true');
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

  const handleTabChange = (tab: 'chat' | 'memory' | 'settings' | 'reminders') => {
    if (isGuest && (tab === 'reminders' || tab === 'memory')) {
      setAuthModalReason(
        tab === 'reminders'
          ? 'Sign in with Google to schedule persistent reminders and notifications across devices.'
          : 'Sign in with Google to save permanent personal notes, routines, and uploaded files.'
      );
      return;
    }
    setActiveTab(tab);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEmail || !goalInput.trim()) return;

    const res = await fetch(`${API_URL}/api/auth/goal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: activeEmail,
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
      const query = activeEmail ? `?user_email=${encodeURIComponent(activeEmail)}` : '';
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

  if (status === "loading" || isSyncing) {
    return (
      <main className="h-dvh bg-[#131314] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#a8c7fa] text-[#062e6f] flex items-center justify-center font-bold">AI</div>
          <p className="text-sm text-[#c4c7c5]">Loading Assistant...</p>
        </div>
      </main>
    );
  }

  if (isAuthenticated && !hasGoal) {
    return (
      <main className="h-dvh bg-[#131314] flex items-center justify-center p-4">
        <form onSubmit={handleSaveGoal} className="bg-[#1e1f20] p-6 sm:p-8 rounded-xl w-full max-w-md space-y-4 border border-[#333537]">
          <h2 className="text-white text-xl font-medium">Welcome, {activeName}</h2>
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
        profile={{ user_name: activeName, user_email: activeEmail, primary_goal: primaryGoal }}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onNewChat={handleNewChat}
        chatSessions={chatSessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onLogout={() => {
          if (isGuest) {
            setAuthModalReason('Sign in with Google to save your chats and unlock reminders & personal memory.');
          } else {
            signOut();
          }
        }}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        activeTourTarget={activeTourTarget}
      />
      <section className="flex-1 min-w-0 flex flex-col h-full bg-[#131314] relative overflow-hidden">
        {/* Guest Mode Top Banner */}
        {isGuest && (
          <div className="bg-[#1e1f20] border-b border-[#333537] px-3 py-1.5 flex items-center justify-between gap-2 text-xs shrink-0">
            <span className="text-[#c4c7c5] truncate flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#a8c7fa] shrink-0" />
              <span>Guest preview mode — sign in to keep your history permanently.</span>
            </span>
            <button
              type="button"
              onClick={() =>
                setAuthModalReason('Sign in with Google to keep your guest chat history and unlock reminders & memory.')
              }
              className="shrink-0 px-2.5 py-1 rounded-full bg-[#a8c7fa] hover:bg-[#8ab4f8] text-[#062e6f] font-medium transition"
            >
              Sign in
            </button>
          </div>
        )}

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
            <img src="/image.png" alt="Life Assistant" className="w-5 h-5 rounded-full object-cover" />
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
          {activeTab === 'memory' && <MemoryManager userEmail={activeEmail} />}
          {activeTab === 'reminders' && <Reminders userName={activeName} userEmail={activeEmail} />}
          {activeTab === 'settings' && <Settings settings={chatSettings} setSettings={setChatSettings} />}
          {activeTab === 'chat' && (
            <ChatWorkspace
              userName={activeName}
              userEmail={activeEmail}
              chatHistory={chatHistory}
              setChatHistory={setChatHistory}
              sessionId={currentSessionId}
              setSessionId={setCurrentSessionId}
              initialPrompt={starterPrompt}
              onClearInitialPrompt={() => setStarterPrompt('')}
              onGuestLimitReached={() =>
                setAuthModalReason('You have used your free guest messages. Sign in with Google to continue and keep your conversation!')
              }
              onMessageSent={async () => {
                const query = activeEmail ? `?user_email=${encodeURIComponent(activeEmail)}` : '';
                const res = await fetch(`${API_URL}/api/chats${query}`);
                const data = await res.json();
                if (Array.isArray(data)) setChatSessions(data);
              }}
              settings={chatSettings}
            />
          )}
        </div>
      </section>

      {/* Soft Sign-In Modal for Gated Features / Guest Limit */}
      {authModalReason && (
        <div
          className="fixed inset-0 z-[70] bg-black/75 flex items-center justify-center p-4"
          onClick={() => setAuthModalReason(null)}
        >
          <div
            className="relative w-full max-w-md space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 rounded-xl bg-[#1e1f20] border border-[#3b424c] px-4 py-2.5 text-xs text-[#c2e7ff]">
              <span>{authModalReason}</span>
              <button
                type="button"
                onClick={() => setAuthModalReason(null)}
                className="p-1.5 rounded-lg bg-[#28292a] text-[#e3e3e3] hover:text-white hover:bg-[#333537] transition shrink-0"
                aria-label="Close sign-in prompt"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <LoginCard compact />
          </div>
        </div>
      )}

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