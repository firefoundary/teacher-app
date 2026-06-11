import { ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  onLogout: () => void;
}

export function DashboardLayout({ children, title, subtitle, onLogout }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar onLogout={onLogout} />
      
      {/* Main Content */}
      <div className="pl-16 lg:pl-64 transition-all duration-300">
        <Topbar title={title} subtitle={subtitle} />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
