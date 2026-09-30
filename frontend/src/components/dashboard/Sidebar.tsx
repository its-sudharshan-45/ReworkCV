import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FileText,
  History,
  Mail,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onMobileClose?: () => void;
}

export function Sidebar({ isCollapsed, onToggleCollapse, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  }

  const navItems = [
    { label: 'Resume Analysis', href: '/analysis', icon: Sparkles },
    { label: 'History', href: '/history', icon: History },
    { label: 'Cover Letters', href: '/cover-letters', icon: Mail },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <aside
      className={`flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 transition-all duration-300 select-none ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-slate-100 dark:border-slate-800/80">
        <Link
          to="/analysis"
          onClick={onMobileClose}
          className="flex items-center gap-2.5 overflow-hidden"
        >
          <img src="/logo.png" alt="ReworkCV Logo" className="w-8 h-8 object-contain flex-shrink-0" />
          {!isCollapsed && (
            <span className="font-extrabold text-lg text-slate-900 dark:text-slate-100 tracking-tight leading-none">
              Rework<span className="text-[#7C3AED]">CV</span>
            </span>
          )}
        </Link>

        {/* Desktop Collapse Toggle Button */}
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 py-5 px-3 space-y-1.5 overflow-y-auto">
        {!isCollapsed && (
          <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600">
            Navigation
          </p>
        )}
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === '/analysis' && (pathname === '/profile/resumes' || pathname === '/resume'));
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              to={item.href}
              onClick={onMobileClose}
              className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                isActive
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-[#16A36A] dark:text-emerald-300 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon
                className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-105 ${
                  isActive ? 'text-[#16A36A] dark:text-emerald-300' : 'text-slate-400 group-hover:text-slate-600'
                }`}
              />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </div>

      {/* User / Sign Out Footer */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={handleSignOut}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all ${
            isCollapsed ? 'justify-center' : ''
          }`}
          title="Sign out of account"
        >
          <LogOut className="w-4 h-4 text-slate-400 hover:text-rose-500" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
