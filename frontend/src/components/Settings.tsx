'use client';

import { useState, useEffect } from 'react';

export interface ChatSettings {
  userBubbleColor: string;
  aiBubbleColor: string;
  aiBubbleBorder: string;
  chatBackground: string;
  fontScale: number;
  bubbleRadius: number;
  voiceName: string;
  persona: string; // NEW
}

export const DEFAULT_SETTINGS: ChatSettings = {
  userBubbleColor: '#28292a',
  aiBubbleColor: '#1e1f20',
  aiBubbleBorder: '#333537',
  chatBackground: '#131314',
  fontScale: 14,
  bubbleRadius: 16,
  voiceName: '',
  persona: 'default', // NEW
};

const PERSONAS = [
  { id: 'default', name: 'Default', description: 'Helpful and concise.' },
  { id: 'professional', name: 'Professional', description: 'Formal, structured, and business-like.' },
  { id: 'friendly', name: 'Friendly', description: 'Warm, encouraging, and casual.' },
  { id: 'sarcastic', name: 'Sarcastic', description: 'Witty, slightly humorous, and blunt.' },
  { id: 'zen', name: 'Zen Master', description: 'Calm, mindful, and philosophical.' },
];

const COLOR_PRESETS = [
  { name: 'Slate', userBubbleColor: '#28292a', aiBubbleColor: '#1e1f20', aiBubbleBorder: '#333537' },
  { name: 'Blue', userBubbleColor: '#004a77', aiBubbleColor: '#1a2a3a', aiBubbleBorder: '#0a3a5a' },
  { name: 'Purple', userBubbleColor: '#4a2c6f', aiBubbleColor: '#251a3a', aiBubbleBorder: '#4a2c6f' },
  { name: 'Green', userBubbleColor: '#1f4a3a', aiBubbleColor: '#1a2a24', aiBubbleBorder: '#1f4a3a' },
  { name: 'Rose', userBubbleColor: '#6f2c3a', aiBubbleColor: '#3a1a24', aiBubbleBorder: '#6f2c3a' },
];

interface SettingsProps {
  settings: ChatSettings;
  setSettings: (s: ChatSettings) => void;
}

export default function Settings({ settings, setSettings }: SettingsProps) {
  const [local, setLocal] = useState<ChatSettings>(settings);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis?.getVoices() || [];
      setVoices(availableVoices.filter(v => v.lang.startsWith('en')));
    };
    
    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  useEffect(() => {
    setSettings(local);
    localStorage.setItem('chatSettings', JSON.stringify(local));
  }, [local, setSettings]);

  const update = (patch: Partial<ChatSettings>) => {
    setLocal((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="flex-1 p-8 max-w-2xl mx-auto w-full space-y-6 overflow-y-auto no-scrollbar">
      <div>
        <h2 className="text-xl font-normal text-white">Settings</h2>
        <p className="text-xs text-[#c4c7c5] mt-1">Customize how your assistant looks, sounds, and behaves.</p>
      </div>

      {/* NEW: AI Persona */}
      <div className="bg-[#1e1f20] border border-[#333537] rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-white">AI Persona</h3>
        <select
          value={local.persona}
          onChange={(e) => update({ persona: e.target.value })}
          className="w-full bg-[#28292a] border border-[#444746] text-white text-sm rounded-lg p-2 outline-none focus:border-[#a8c7fa]"
        >
          {PERSONAS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} - {p.description}
            </option>
          ))}
        </select>
      </div>

      {/* Voice Selection */}
      <div className="bg-[#1e1f20] border border-[#333537] rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-white">AI Voice</h3>
        <select
          value={local.voiceName}
          onChange={(e) => update({ voiceName: e.target.value })}
          className="w-full bg-[#28292a] border border-[#444746] text-white text-sm rounded-lg p-2 outline-none focus:border-[#a8c7fa]"
        >
          <option value="">System Default</option>
          {voices.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      </div>

      {/* Preset Themes */}
      <div className="bg-[#1e1f20] border border-[#333537] rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-white">Preset Themes</h3>
        <div className="grid grid-cols-5 gap-2">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => update(preset)}
              className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-[#28292a] transition"
            >
              <div className="flex gap-1">
                <div className="w-4 h-4 rounded-full" style={{ background: preset.userBubbleColor }} />
                <div className="w-4 h-4 rounded-full border" style={{ background: preset.aiBubbleColor, borderColor: preset.aiBubbleBorder }} />
              </div>
              <span className="text-[10px] text-[#c4c7c5]">{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Colors ... (Keep existing) */}
      <div className="bg-[#1e1f20] border border-[#333537] rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-medium text-white">Custom Colors</h3>
        {[
          { label: 'Your Bubble Color', key: 'userBubbleColor' },
          { label: 'AI Bubble Color', key: 'aiBubbleColor' },
          { label: 'AI Bubble Border', key: 'aiBubbleBorder' },
          { label: 'Chat Background', key: 'chatBackground' },
        ].map(({ label, key }) => (
          <div key={key} className="flex items-center justify-between">
            <label className="text-xs text-[#c4c7c5]">{label}</label>
            <input
              type="color"
              value={(local as any)[key]}
              onChange={(e) => update({ [key]: e.target.value } as any)}
              className="w-10 h-8 rounded cursor-pointer bg-transparent border border-[#444746]"
            />
          </div>
        ))}
      </div>

      {/* Sliders ... (Keep existing) */}
      <div className="bg-[#1e1f20] border border-[#333537] rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-medium text-white">Text & Shape</h3>
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-[#c4c7c5]">Font Size</label>
            <span className="text-xs text-white">{local.fontScale}px</span>
          </div>
          <input
            type="range" min={12} max={20} step={1}
            value={local.fontScale}
            onChange={(e) => update({ fontScale: Number(e.target.value) })}
            className="w-full accent-[#a8c7fa]"
          />
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-[#c4c7c5]">Bubble Roundness</label>
            <span className="text-xs text-white">{local.bubbleRadius}px</span>
          </div>
          <input
            type="range" min={4} max={28} step={1}
            value={local.bubbleRadius}
            onChange={(e) => update({ bubbleRadius: Number(e.target.value) })}
            className="w-full accent-[#a8c7fa]"
          />
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={() => setLocal(DEFAULT_SETTINGS)}
        className="w-full py-2 rounded-lg bg-[#28292a] text-[#c4c7c5] hover:bg-[#333537] hover:text-white text-xs transition"
      >
        Reset to Defaults
      </button>
    </div>
  );
}