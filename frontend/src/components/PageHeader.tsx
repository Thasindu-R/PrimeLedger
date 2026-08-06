import { NavLink } from 'react-router-dom';
import { SECTIONS } from '../navigation';

interface PageHeaderProps {
  userName: string;
  rightSlot?: React.ReactNode;
}

function TabNav() {
  return (
    <nav
      aria-label="Sections"
      className="flex gap-4 sm:gap-6 overflow-x-auto whitespace-nowrap pb-1"
    >
      {SECTIONS.map((section) => (
        <NavLink
          key={section.path}
          to={section.path}
          className={({ isActive }) =>
            `text-sm ${
              isActive
                ? 'text-green-600 font-medium border-b-2 border-green-500 pb-1'
                : 'text-gray-500 hover:text-gray-700'
            }`
          }
        >
          {section.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function PageHeader({ userName, rightSlot }: PageHeaderProps) {
  return (
    <header className="w-full bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Left Side - Greeting */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Good morning, {userName}
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          This is your finance report
        </p>
      </div>

      {/* Right Side */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        {rightSlot}
        <TabNav />
      </div>
    </header>
  );
}
