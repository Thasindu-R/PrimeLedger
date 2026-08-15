import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Leaf, ChevronDown, Search, MessageCircle, Bell, Settings, HelpCircle, LogOut, Menu, X } from 'lucide-react';
import type { Account, Notification } from '../types';
import { SECTIONS } from '../navigation';
import { AccountSelector } from './AccountSelector';
import { NotificationsMenu } from './NotificationsMenu';

interface TopNavBarProps {
  userName: string;
  userHandle: string;
  avatarUrl?: string;
  /** Which ledger the app is showing, and how to change it (F-01). */
  accounts: Account[];
  selectedAccountId?: string;
  onSelectAccount: (accountId: string | undefined) => void;
  /** Budget alerts, behind the bell (F-02). */
  notifications: Notification[];
  unreadCount: number;
  notificationsLoading: boolean;
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onSignOut: () => void;
}

export function TopNavBar({
  userName,
  userHandle,
  avatarUrl,
  accounts,
  selectedAccountId,
  onSelectAccount,
  notifications,
  unreadCount,
  notificationsLoading,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onSignOut,
}: TopNavBarProps) {
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfile(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <nav className="w-full bg-white border-b border-gray-100 px-4 sm:px-6">
      <div className="flex items-center justify-between gap-3 py-3 sm:py-0 sm:h-[60px]">
        {/* Left Cluster */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMobileMenu((prev) => !prev)}
            className="sm:hidden p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
            aria-label="Toggle menu"
          >
            {showMobileMenu ? <X size={18} /> : <Menu size={18} />}
          </button>

          {/* Logo */}
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
            <Leaf size={16} className="text-white" />
          </div>

          {/* Account Selector */}
          <div className="hidden md:block">
            <AccountSelector
              accounts={accounts}
              selectedId={selectedAccountId}
              onSelect={onSelectAccount}
            />
          </div>
        </div>

        {/* Center - Search Bar */}
        <div className="hidden lg:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-72">
          <Search size={14} className="text-gray-400" />
          <input
            type="text"
            aria-label="Search"
            placeholder="Search"
            className="bg-transparent border-none outline-none text-sm text-gray-400 placeholder-gray-400 flex-1"
          />
          <kbd className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">
            ⌘F
          </kbd>
        </div>

        {/* Right Cluster */}
        <div className="flex items-center gap-3 sm:gap-4">
        {/* Message Circle Button */}
        <button className="hidden sm:inline-flex text-gray-500 hover:text-gray-700 transition-colors">
          <MessageCircle size={20} />
        </button>

        {/* Bell Button with Notification Dot */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label={
              unreadCount > 0 ? `Alerts, ${unreadCount} unread` : 'Alerts'
            }
            className="text-gray-500 hover:text-gray-700 transition-colors relative"
          >
            <Bell size={20} />
            {/* Only when there is something to see. A dot that is always lit
                says nothing, which is what it did before Phase 5. */}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[1rem] h-4 px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-semibold rounded-full">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <NotificationsMenu
              notifications={notifications}
              isLoading={notificationsLoading}
              onMarkRead={onMarkNotificationRead}
              onMarkAllRead={onMarkAllNotificationsRead}
            />
          )}
        </div>

        {/* User Profile */}
        <div className="relative" ref={profileRef}>
          <div
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 sm:gap-3 cursor-pointer"
          >
            {/* Avatar */}
            {avatarUrl ? (
              <div className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden">
                <img
                  src={avatarUrl}
                  alt={userName}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-600 text-xs font-medium">{getInitials(userName)}</span>
              </div>
            )}

            {/* User Info */}
            <div className="hidden sm:flex flex-col">
              <span className="text-sm font-medium text-gray-800">{userName}</span>
              <span className="text-xs text-gray-400">{userHandle}</span>
            </div>

            {/* Chevron Down */}
            <ChevronDown size={14} className="text-gray-400" />
          </div>

          {/* Profile Dropdown */}
          {showProfile && (
            <div className="absolute right-0 sm:right-6 top-14 bg-white rounded-2xl shadow-lg border border-gray-100 w-56 max-w-[calc(100vw-2rem)] py-2 z-50">
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-2">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-600 text-xs font-medium">{getInitials(userName)}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{userName}</p>
                  <p className="text-xs text-gray-400">{userHandle}</p>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100 my-1" />

              {/* Menu Items */}
              <Link
                to="/settings"
                onClick={() => setShowProfile(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                <Settings size={16} />
                <span>Settings</span>
              </Link>

              <button
                type="button"
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                <HelpCircle size={16} />
                <span>Help</span>
              </button>

              {/* Divider */}
              <div className="border-t border-gray-100 my-1" />

              <button
                type="button"
                onClick={() => {
                  onSignOut();
                  setShowProfile(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                <LogOut size={16} />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
        </div>
      </div>

      {showMobileMenu && (
        <div className="sm:hidden pb-4">
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 space-y-3">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
              <Search size={14} className="text-gray-400" />
              <input
                type="text"
                aria-label="Search (mobile)"
                placeholder="Search"
                className="bg-transparent border-none outline-none text-sm text-gray-500 placeholder-gray-400 flex-1"
              />
            </div>

            <div className="bg-white border border-gray-200 rounded-lg px-1 py-0.5">
              <AccountSelector
                accounts={accounts}
                selectedId={selectedAccountId}
                onSelect={onSelectAccount}
              />
            </div>

            <nav aria-label="Sections (mobile)" className="grid grid-cols-2 gap-2">
              {SECTIONS.map((section) => (
                <Link
                  key={section.path}
                  to={section.path}
                  onClick={() => setShowMobileMenu(false)}
                  className="text-sm text-center text-gray-600 bg-white border border-gray-200 rounded-lg py-2.5 hover:bg-gray-100"
                >
                  {section.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <button className="flex-1 flex items-center justify-center gap-2 border border-gray-200 rounded-lg py-2.5 text-sm text-gray-600 bg-white">
                <MessageCircle size={16} />
                Messages
              </button>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="flex-1 flex items-center justify-center gap-2 border border-gray-200 rounded-lg py-2.5 text-sm text-gray-600 bg-white"
              >
                <Bell size={16} />
                Alerts
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
