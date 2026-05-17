import { Leaf, ChevronDown, ArrowRight, Search, MessageCircle, Bell } from 'lucide-react';

interface TopNavBarProps {
  userName: string;
  userHandle: string;
  avatarUrl?: string;
}

export function TopNavBar({ userName, userHandle, avatarUrl }: TopNavBarProps) {
  return (
    <nav className="w-full h-[60px] bg-white border-b border-gray-100 px-6 flex items-center justify-between">
      {/* Left Cluster */}
      <div className="flex items-center gap-3">
        {/* Logo */}
        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
          <Leaf size={16} className="text-white" />
        </div>
        
        {/* Account Selector */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-sm">Personal account</span>
          <ChevronDown size={14} className="text-gray-400" />
          <ArrowRight size={14} className="text-gray-400" />
          <span className="text-green-600 font-medium text-sm">Dashboard</span>
        </div>
      </div>

      {/* Center - Search Bar */}
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-72">
        <Search size={14} className="text-gray-400" />
        <input
          type="text"
          placeholder="Search"
          className="bg-transparent border-none outline-none text-sm text-gray-400 placeholder-gray-400 flex-1"
        />
        <kbd className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">
          ⌘F
        </kbd>
      </div>

      {/* Right Cluster */}
      <div className="flex items-center gap-4">
        {/* Message Circle Button */}
        <button className="text-gray-500 hover:text-gray-700 transition-colors">
          <MessageCircle size={20} />
        </button>

        {/* Bell Button with Notification Dot */}
        <button className="text-gray-500 hover:text-gray-700 transition-colors relative">
          <Bell size={20} />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full"></span>
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-3">
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
              <span className="text-gray-600 text-xs font-medium">
                {userName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </span>
            </div>
          )}

          {/* User Info */}
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-800">{userName}</span>
            <span className="text-xs text-gray-400">{userHandle}</span>
          </div>

          {/* Chevron Down */}
          <ChevronDown size={14} className="text-gray-400" />
        </div>
      </div>
    </nav>
  );
}
