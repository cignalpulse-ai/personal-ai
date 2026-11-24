'use client';

import { useState } from 'react';
import {
  MessageSquare,
  Clock,
  Database,
  Mic,
  ArrowRight,
  Check,
  X,
  Sparkles,
} from 'lucide-react';

interface OnboardingTourProps {
  userName: string;
  primaryGoal: string;
  onComplete: () => void;
  onSelectPrompt?: (prompt: string) => void;
}

const TOUR_STEPS = [
  {
    icon: Sparkles,
    badge: 'Step 1 of 4 · Focused Purpose',
    title: 'Built for Your Daily Life, Not Random Trivia',
    description:
      'Unlike a general chatbot, Life Assistant is tailored around your personal routine, tasks, and goals—keeping everything organized in one private workspace.',
    tip: 'Try asking: "Plan my morning routine around my goal."',
    samplePrompt: 'Help me build a simple daily routine around my primary goal.',
  },
  {
    icon: Clock,
    badge: 'Step 2 of 4 · Smart Reminders',
    title: 'Set Time-Aware Reminders Naturally',
    description:
      'Tell the assistant to remind you about anything in plain language, or manage upcoming alerts directly inside the Reminders tab.',
    tip: 'Try saying: "Remind me to review my notes at 7:00 PM."',
    samplePrompt: 'Remind me to review my tasks today at 7:00 PM.',
  },
  {
    icon: Database,
    badge: 'Step 3 of 4 · Personal Memory',
    title: 'Long-Term Memory & Routine Context',
    description:
      'Save key preferences, schedules, and personal notes in Memory & Routine so the assistant remembers your context across every new chat.',
    tip: 'Open "Memory & Routine" anytime to view or add facts.',
    samplePrompt: 'What should I save in my Memory & Routine so you can assist me better?',
  },
  {
    icon: Mic,
    badge: 'Step 4 of 4 · Voice & Hands-Free',
    title: 'Speak or Listen on the Go',
    description:
      'Use the microphone button to dictate tasks quickly and toggle voice responses when you want hands-free updates.',
    tip: 'You are all set—pick a starter prompt or type below!',
    samplePrompt: '',
  },
];

export default function OnboardingTour({
  userName,
  primaryGoal,
  onComplete,
  onSelectPrompt,
}: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);

  const step = TOUR_STEPS[stepIndex];
  const Icon = step.icon;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setStepIndex((prev) => prev + 1);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#1e1f20] border border-[#333537] p-6 text-[#e3e3e3] shadow-2xl space-y-5">
        {/* Top Row: Step Pill + Skip */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#004a77] px-3 py-1 text-[11px] font-medium text-[#c2e7ff]">
            {step.badge}
          </span>
          <button
            type="button"
            onClick={onComplete}
            className="inline-flex items-center gap-1 text-xs text-[#c4c7c5] hover:text-white transition"
          >
            Skip <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Icon + Title + Copy */}
        <div className="space-y-2.5">
          <div className="w-11 h-11 rounded-xl bg-[#28292a] border border-[#333537] flex items-center justify-center text-[#a8c7fa]">
            <Icon className="w-5 h-5" />
          </div>

          {stepIndex === 0 && (
            <p className="text-xs text-[#a8c7fa]">
              Welcome, <span className="font-medium">{userName}</span> · Goal:{' '}
              <span className="italic">{primaryGoal}</span>
            </p>
          )}

          <h3 id="tour-title" className="text-lg font-medium text-white leading-snug">
            {step.title}
          </h3>

          <p className="text-sm text-[#c4c7c5] leading-relaxed">{step.description}</p>
        </div>

        {/* Actionable Tip Box */}
        <div className="rounded-xl bg-[#28292a] border border-[#333537] p-3 text-xs text-[#e3e3e3] flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <MessageSquare className="w-4 h-4 text-[#a8c7fa] shrink-0 mt-0.5" />
            <span>{step.tip}</span>
          </div>
          {step.samplePrompt && onSelectPrompt && (
            <button
              type="button"
              onClick={() => {
                onSelectPrompt(step.samplePrompt);
                onComplete();
              }}
              className="shrink-0 text-[11px] font-medium text-[#a8c7fa] hover:underline"
            >
              Try it →
            </button>
          )}
        </div>

        {/* Progress Dots + Back / Next Buttons */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx === stepIndex ? 'w-5 bg-[#a8c7fa]' : 'w-1.5 bg-[#444746]'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => setStepIndex((prev) => prev - 1)}
                className="px-3 py-2 rounded-lg text-xs text-[#c4c7c5] hover:bg-[#28292a] hover:text-white transition"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 bg-[#a8c7fa] hover:bg-[#8ab4f8] text-[#062e6f] px-4 py-2 rounded-lg text-xs font-medium transition"
            >
              {isLast ? (
                <>
                  Got it <Check className="w-3.5 h-3.5" />
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
    </div>
  );
}