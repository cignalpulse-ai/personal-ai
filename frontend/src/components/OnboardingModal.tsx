'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { API_URL } from '@/lib/api';

interface OnboardingModalProps {
  onProfileSaved: (profile: any) => void;
}

export default function OnboardingModal({ onProfileSaved }: OnboardingModalProps) {
  const [userName, setUserName] = useState('');
  const [primaryGoal, setPrimaryGoal] = useState('');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
const res = await fetch(`${API_URL}/api/profile`, {
        method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_name: userName, primary_goal: primaryGoal }),
    });
    const data = await res.json();
    onProfileSaved(data);
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
            <Button type="submit" className="w-full bg-[#a8c7fa] hover:bg-[#8ab4f8] text-[#062e6f] font-medium mt-2">
              Start Using Assistant
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}