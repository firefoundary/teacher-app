import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
}

export function StatCard({ 
  title, 
  value, 
  icon: Icon,
  iconColor = 'text-primary',
  iconBgColor = 'bg-primary/10'
}: StatCardProps) {
  
  return (
    <div className="dashboard-card group cursor-default">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          
        </div>
        
        <div className={`p-3 rounded-2xl ${iconBgColor} transition-transform group-hover:scale-110`}>
          <Icon size={24} className={iconColor} />
        </div>
      </div>
    </div>
  );
}

export default StatCard;
