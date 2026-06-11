import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  BookOpen, 
  Shield, // ✅ Added Shield icon for Admins
  ChevronLeft,
  ChevronRight,
  LogOut
} from 'lucide-react';
import { AlertCircle } from 'lucide-react';

interface SidebarProps {
  onLogout: () => void;
}

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/teachers', icon: Users, label: 'Teachers' },
  { path: '/feedback', icon: MessageSquare, label: 'Feedback' },
  { path: '/issues', icon: AlertCircle, label: 'Issues' },
  { path: '/modules', icon: BookOpen, label: 'Modules' },
  { path: '/admins', icon: Shield, label: 'Admins' }, // ✅ Added Admins page
];

export function Sidebar({ onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside 
      className={`
        fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground
        transition-all duration-300 ease-in-out z-50
        ${collapsed ? 'w-16' : 'w-64'}
        flex flex-col
      `}
    >
      {/* Logo Section */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-3 animate-fade-in">
            <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center">
              <span className="text-sidebar-primary-foreground font-bold text-lg">D</span>
            </div>
            <div>
              <h1 className="font-bold text-lg">DIET Admin</h1>
              <p className="text-xs text-sidebar-foreground/70">Dashboard</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`
                flex items-center gap-3 px-3 py-3 rounded-xl
                transition-all duration-200
                ${isActive 
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground' 
                  : 'hover:bg-sidebar-accent/50 text-sidebar-foreground/80 hover:text-sidebar-foreground'
                }
              `}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={22} className="shrink-0" />
              {!collapsed && (
                <span className="font-medium animate-fade-in">{item.label}</span>
              )}
              {isActive && !collapsed && (
                <div className="ml-auto w-2 h-2 rounded-full bg-sidebar-foreground" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={onLogout}
          className={`
            flex items-center gap-3 px-3 py-3 rounded-xl w-full
            hover:bg-sidebar-accent/50 text-sidebar-foreground/80 hover:text-sidebar-foreground
            transition-all duration-200
          `}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut size={22} className="shrink-0" />
          {!collapsed && <span className="font-medium">Logout</span>}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
