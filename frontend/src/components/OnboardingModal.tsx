'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { API_URL } from '@/lib/api';

interface OnboardingModalProps {
  userEmail?: string;
  initialName?: string;
  onProfileSaved: (profile: any) => void;
}

export default function OnboardingModal({
  userEmail = '',
  initialName = '',
  onProfileSaved,
}: OnboardingModalProps) {
  const [userName, setUserName] = useState(initialName);
  const [primaryGoal, setPrimaryGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (userEmail) {
        await fetch(`${API_URL}/api/auth/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userEmail, name: userName.trim() }),
        });

        const res = await fetch(`${API_URL}/api/auth/goal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail,
            primary_goal: primaryGoal.trim(),
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `Request failed (${res.status})`);
        }

        const data = await res.json();
        onProfileSaved({ ...data, name: userName.trim(), email: userEmail });
      } else {
        const res = await fetch(`${API_URL}/api/profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_name: userName.trim(),
            primary_goal: primaryGoal.trim(),
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `Request failed (${res.status})`);
        }

        const data = await res.json();
        onProfileSaved(data);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not save your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#131314] text-[#e3e3e3] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-[#1e1f20] border-[#333537] text-[#e3e3e3] shadow-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-normal text-white">Welcome to Personal AI</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[#c4c7c5]">Your Name</label>
              <Input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="e.g. Joseph"
                className="bg-[#28292a] border-[#444746] text-white mt-1 focus-visible:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#c4c7c5]">Assistant Primary Goal</label>
              <Input
                type="text"
                value={primaryGoal}
                onChange={(e) => setPrimaryGoal(e.target.value)}
                placeholder="e.g. Life organizer & routine manager"
                className="bg-[#28292a] border-[#444746] text-white mt-1 focus-visible:ring-blue-500"
                required
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded p-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#a8c7fa] hover:bg-[#8ab4f8] text-[#062e6f] font-medium mt-2 disabled:opacity-60"
            >
              {loading ? 'Saving...' : 'Start Using Assistant'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}