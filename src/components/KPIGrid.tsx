import { useNigeriaOverview, parseLatestValue } from "@/hooks/useDataCommons";
import { NIGERIA_DCID, STAT_VARIABLES } from "@/lib/datacommons";
import { Users, Heart, DollarSign, Briefcase, Baby, Flame, Skull } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const kpiConfig = [
  { key: 'population', icon: Users, color: 'text-primary', format: (v: number) => `${(v / 1_000_000).toFixed(1)}M` },
  { key: 'lifeExpectancy', icon: Heart, color: 'text-secondary', format: (v: number) => `${v.toFixed(1)} yrs` },
  { key: 'gdpPerCapita', icon: DollarSign, color: 'text-primary', format: (v: number) => `$${v.toLocaleString()}` },
  { key: 'unemployment', icon: Briefcase, color: 'text-secondary', format: (v: number) => `${v.toFixed(1)}%` },
  { key: 'fertility', icon: Baby, color: 'text-primary', format: (v: number) => `${v.toFixed(1)}` },
  { key: 'co2Emissions', icon: Flame, color: 'text-secondary', format: (v: number) => `${v.toFixed(2)}t` },
  { key: 'infantMortality', icon: Skull, color: 'text-destructive', format: (v: number) => `${v.toFixed(1)}‰` },
] as const;

const KPIGrid = () => {
  const { data, isLoading, error } = useNigeriaOverview();

  if (error) {
    return (
      <section className="container mx-auto px-4 py-8">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm">
          Failed to load data. Please try again later.
        </div>
      </section>
    );
  }

  return (
    <section className="container mx-auto px-4 py-8">
      <h2 className="font-serif text-2xl text-foreground mb-6">Key Indicators</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {kpiConfig.map(({ key, icon: Icon, color, format }) => {
          const stat = STAT_VARIABLES[key as keyof typeof STAT_VARIABLES];
          const parsed = data ? parseLatestValue(data, stat.dcid, NIGERIA_DCID) : null;

          return (
            <div
              key={key}
              className="bg-card rounded-xl p-5 shadow-card hover:shadow-elevated transition-shadow animate-fade-in"
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {stat.label}
                </span>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : parsed ? (
                <>
                  <p className="text-2xl font-bold text-foreground font-sans">
                    {format(parsed.value)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{parsed.date}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No data</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default KPIGrid;
