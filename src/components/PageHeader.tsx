
interface PageHeaderProps {
  userName: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = ['Overview', 'Analytics', 'Transactions', 'Settings'];

function TabNav({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
  return (
    <div className="flex gap-6">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`text-sm ${
            activeTab === tab
              ? 'text-green-600 font-medium border-b-2 border-green-500 pb-1'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ userName, activeTab, onTabChange }: PageHeaderProps) {
  return (
    <header className="w-full bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
      {/* Left Side - Greeting */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Good morning, {userName}
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          This is your finance report
        </p>
      </div>

      {/* Right Side - Tab Navigation */}
      <TabNav activeTab={activeTab} onTabChange={onTabChange} />
    </header>
  );
}
