import { TrendingUp, BarChart3, Globe2, MessageCircle, LayoutDashboard } from "lucide-react";

interface AppNavbarProps {
  activeTab: 'overview' | 'trends' | 'compare' | 'ask';
  setActiveTab: (tab: 'overview' | 'trends' | 'compare' | 'ask') => void;
}

const tabs = [
  { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
  { id: 'trends' as const, label: 'Trends', icon: TrendingUp },
  { id: 'compare' as const, label: 'Compare', icon: Globe2 },
  { id: 'ask' as const, label: 'Ask', icon: MessageCircle },
];

const AppNavbar = ({ activeTab, setActiveTab }: AppNavbarProps) => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 flex items-center justify-between h-16">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">ND</span>
          </div>
          <span className="font-serif text-xl text-foreground">NaijaData</span>
        </div>
        
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default AppNavbar;
