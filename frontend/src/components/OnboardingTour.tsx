'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowRight, Check, X, Sparkles } from 'lucide-react';

export interface TourStepConfig {
  targetId: string | null;
  title: string;
  description: string;
  isSidebarTarget?: boolean;
}

export const DEFAULT_TOUR_STEPS: TourStepConfig[] = [
  {
    targetId: 'chat-input',
    title: 'Chat & Ask Anything',
    description:
      'Type routines, tasks, general questions, or coding prompts here. You can also set reminders naturally in chat.',
    isSidebarTarget: false,
  },
  {
    targetId: 'mic-btn',
    title: 'Voice Input (Mic)',
    description:
      'Tap the microphone to speak your notes, tasks, or questions hands-free and send them right away.',
    isSidebarTarget: false,
  },
  {
    targetId: 'voice-btn',
    title: 'AI Voice Playback',
    description:
      'Toggle this speaker button to have the assistant read replies out loud while you multitask.',
    isSidebarTarget: false,
  },
  {
    targetId: 'export-btn',
    title: 'Export Chat',
    description:
      'Download your current conversation as a Markdown (.md) file anytime for notes or reference.',
    isSidebarTarget: false,
  },
  {
    targetId: 'new-chat',
    title: 'New Chat',
    description:
      'Start a fresh conversation thread anytime without losing your saved memories or past chats.',
    isSidebarTarget: true,
  },
  {
    targetId: 'nav-chat',
    title: 'Chat Workspace',
    description:
      'Jump back to your main conversational workspace for daily planning, Q&A, and task assistance.',
    isSidebarTarget: true,
  },
  {
    targetId: 'nav-reminders',
    title: 'Reminders',
    description:
      'View upcoming scheduled reminders, mark routine tasks complete, or remove ones you no longer need.',
    isSidebarTarget: true,
  },
  {
    targetId: 'nav-memory',
    title: 'Memory & Routine',
    description:
      'Store important personal notes, preferences, and routines—or upload files—so the assistant remembers context.',
    isSidebarTarget: true,
  },
  {
    targetId: 'nav-settings',
    title: 'Settings',
    description:
      'Customize your AI persona, voice selection, bubble colors, font size, and chat appearance.',
    isSidebarTarget: true,
  },
  {
    targetId: 'recent-chats',
    title: 'Recent Chats',
    description:
      'Switch back to any previous chat session from your history list.',
    isSidebarTarget: true,
  },
  {
    targetId: 'logout-btn',
    title: 'Sign Out',
    description:
      'Safely sign out of your Google account on this device when you are done.',
    isSidebarTarget: true,
  },
];

interface OnboardingTourProps {
  steps?: TourStepConfig[];
  onComplete: () => void;
  onStepChange?: (step: TourStepConfig) => void;
}

export default function OnboardingTour({
  steps = DEFAULT_TOUR_STEPS,
  onComplete,
  onStepChange,
}: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const currentStep = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const updateTargetRect = useCallback(() => {
    if (!currentStep?.targetId) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-tour-id="${currentStep.targetId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [currentStep]);

  useEffect(() => {
    onStepChange?.(currentStep);
    const timer = setTimeout(updateTargetRect, 180);
    window.addEventListener('resize', updateTargetRect);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateTargetRect);
    };
  }, [currentStep, onStepChange, updateTargetRect]);

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setStepIndex((prev) => prev + 1);
    }
  };

  // Compute safe tooltip card position on screen
  const cardWidth = Math.min(320, typeof window !== 'undefined' ? window.innerWidth - 24 : 320);
  let top = 120;
  let left = 12;

  if (typeof window !== 'undefined') {
    if (rect) {
      // On desktop if in sidebar, place to the right of sidebar; otherwise above/below target
      const isDesktop = window.innerWidth >= 768;
      if (isDesktop && currentStep.isSidebarTarget) {
        left = Math.min(rect.right + 16, window.innerWidth - cardWidth - 12);
        top = Math.min(Math.max(rect.top - 12, 16), window.innerHeight - 230);
      } else {
        left = Math.min(Math.max(rect.left, 12), window.innerWidth - cardWidth - 12);
        const spaceBelow = window.innerHeight - rect.bottom;
        top = spaceBelow > 230 ? rect.bottom + 12 : Math.max(rect.top - 220, 16);
      }
    } else {
      left = Math.max((window.innerWidth - cardWidth) / 2, 12);
      top = Math.max((window.innerHeight - 220) / 2, 16);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] pointer-events-auto">
      {/* Subtle Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onComplete}
        aria-hidden="true"
      />

      {/* Spotlight Box Around Target Button */}
      {rect && (
        <div
          className="fixed z-[61] rounded-xl border-2 border-[#a8c7fa] shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] pointer-events-none transition-all duration-200"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
        />
      )}

      {/* Tooltip Popover */}
      <div
        role="dialog"
        aria-modal="true"
        style={{ top, left, width: cardWidth }}
        className="fixed z-[62] rounded-2xl bg-[#1e1f20] border border-[#444746] p-4 text-[#e3e3e3] shadow-2xl space-y-3 transition-all duration-200"
      >
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#a8c7fa]">
            <Sparkles className="w-3.5 h-3.5" />
            Tip {stepIndex + 1} of {steps.length}
          </span>
          <button
            type="button"
            onClick={onComplete}
            className="text-xs text-[#c4c7c5] hover:text-white inline-flex items-center gap-0.5"
          >
            Skip <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-white">{currentStep.title}</h4>
          <p className="text-xs text-[#c4c7c5] leading-relaxed">{currentStep.description}</p>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
            className="px-2.5 py-1.5 rounded-lg text-xs text-[#c4c7c5] hover:bg-[#28292a] disabled:opacity-40 transition"
          >
            Back
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-1 bg-[#a8c7fa] hover:bg-[#8ab4f8] text-[#062e6f] px-3.5 py-1.5 rounded-lg text-xs font-medium transition"
          >
            {isLast ? (
              <>
                Done <Check className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                Next <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}