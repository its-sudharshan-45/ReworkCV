import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, ChevronDown, Settings, LogOut, FileText, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface StitchNavbarProps {
  onOpenHistory: () => void;
  userName?: string;
  userEmail?: string;
}

export function StitchNavbar({ onOpenHistory, userName: propUserName, userEmail: propUserEmail }: StitchNavbarProps) {
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [resolvedUserName, setResolvedUserName] = useState<string>(propUserName || '');
  const [resolvedUserEmail, setResolvedUserEmail] = useState<string>(propUserEmail || '');
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        if (user) {
          const email = user.email ?? '';
          const name =
            (user.user_metadata?.full_name as string | undefined) ||
            (user.user_metadata?.name as string | undefined) ||
            (email.split('@')[0] ? email.split('@')[0] : '') ||
            '';
          setResolvedUserName(name ? name.charAt(0).toUpperCase() + name.slice(1) : 'Sudharshan');
          setResolvedUserEmail(email);
        } else if (!resolvedUserName) {
          setResolvedUserName('Sudharshan');
        }
      } catch {
        if (!resolvedUserName) setResolvedUserName('Sudharshan');
      }
    }
    void loadUser();
  }, [propUserName, propUserEmail, resolvedUserName]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSignOut() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  const displayName = resolvedUserName || 'Sudharshan';
  const avatarInitial = displayName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-100 px-4 sm:px-8 py-3.5 flex items-center justify-between">
      {/* Left: Logo & Subtitle */}
      <div className="flex items-center gap-3">
        {/* Logo Image */}
        <img
          src="/logo.png"
          alt="ReworkCV Logo"
          className="w-8 h-8 object-contain select-none"
        />

        {/* Brand Name */}
        <span className="text-xl font-extrabold tracking-tight text-slate-900 select-none">
          Rework<span className="text-[#7C3AED]">CV</span>
        </span>

        {/* Divider */}
        <span className="h-4 w-px bg-slate-200 mx-1 hidden sm:inline-block" />

        {/* Subtitle */}
        <span className="text-[13.5px] font-medium text-slate-600 hidden sm:inline-block">
          ReworkCV Resume Intelligence
        </span>
      </div>

      {/* Right: Scan History & User Profile */}
      <div className="flex items-center gap-4 sm:gap-6">
        {/* Scan History Button */}
        <button
          type="button"
          onClick={onOpenHistory}
          className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-slate-700 hover:text-[#7C3AED] transition-colors cursor-pointer py-1.5 px-2 rounded-lg hover:bg-slate-50"
        >
          <Archive className="w-4 h-4 text-slate-500" />
          <span>Scan History</span>
        </button>

        {/* Profile Avatar & Menu */}
        <div className="relative" ref={profileMenuRef}>
          <button
            type="button"
            onClick={() => setShowProfileMenu((prev) => !prev)}
            className="flex items-center gap-2 cursor-pointer py-1 px-1.5 rounded-full hover:bg-slate-50 transition-colors"
          >
            {/* Avatar Circle */}
            <div className="w-8 h-8 rounded-full bg-[#7C3AED] text-white flex items-center justify-center text-xs font-bold shadow-xs">
              {avatarInitial}
            </div>

            {/* Display Name */}
            <span className="text-sm font-semibold text-slate-800 hidden md:inline">
              {displayName}
            </span>

            {/* Chevron */}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Dropdown Menu */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white p-1.5 shadow-xl border border-slate-100 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <p className="text-xs font-bold text-slate-900 truncate">{displayName}</p>
                {resolvedUserEmail && (
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{resolvedUserEmail}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  onOpenHistory();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 rounded-lg hover:bg-[#F3E8FF] hover:text-[#7C3AED] transition-colors text-left"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>My Saved Resumes</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  navigate('/cover-letters');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 rounded-lg hover:bg-[#F3E8FF] hover:text-[#7C3AED] transition-colors text-left"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Cover Letters</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  navigate('/settings');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 rounded-lg hover:bg-[#F3E8FF] hover:text-[#7C3AED] transition-colors text-left"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Account Settings</span>
              </button>

              <div className="border-t border-slate-100 my-1" />

              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors text-left"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
