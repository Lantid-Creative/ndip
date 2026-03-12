import { useState } from "react";
import { Search, TrendingUp, BarChart3, Globe2, MessageCircle } from "lucide-react";
import HeroSection from "@/components/HeroSection";
import KPIGrid from "@/components/KPIGrid";
import TrendChart from "@/components/TrendChart";
import ComparePanel from "@/components/ComparePanel";
import NLSearchPanel from "@/components/NLSearchPanel";
import AppNavbar from "@/components/AppNavbar";

const Index = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'compare' | 'ask'>('overview');

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {activeTab === 'overview' && (
        <>
          <HeroSection />
          <KPIGrid />
        </>
      )}
      
      {activeTab === 'trends' && (
        <main className="container mx-auto px-4 pt-24 pb-12">
          <h2 className="font-serif text-3xl text-foreground mb-2">Trend Explorer</h2>
          <p className="text-muted-foreground mb-8">Track Nigeria's key indicators over time</p>
          <TrendChart />
        </main>
      )}
      
      {activeTab === 'compare' && (
        <main className="container mx-auto px-4 pt-24 pb-12">
          <h2 className="font-serif text-3xl text-foreground mb-2">Country Comparison</h2>
          <p className="text-muted-foreground mb-8">Benchmark Nigeria against peer nations</p>
          <ComparePanel />
        </main>
      )}
      
      {activeTab === 'ask' && (
        <main className="container mx-auto px-4 pt-24 pb-12">
          <h2 className="font-serif text-3xl text-foreground mb-2">Ask About Nigeria</h2>
          <p className="text-muted-foreground mb-8">Ask natural language questions about Nigeria's data</p>
          <NLSearchPanel />
        </main>
      )}
    </div>
  );
};

export default Index;
