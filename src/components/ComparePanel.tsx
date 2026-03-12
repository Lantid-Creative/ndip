import { useState, useMemo } from "react";
import { useCountryComparison, parseLatestValue } from "@/hooks/useDataCommons";
import { STAT_VARIABLES, PEER_COUNTRIES } from "@/lib/datacommons";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = [
  'hsl(152, 82%, 20%)',
  'hsl(40, 80%, 55%)',
  'hsl(152, 60%, 35%)',
  'hsl(40, 60%, 45%)',
  'hsl(200, 60%, 40%)',
  'hsl(350, 60%, 45%)',
  'hsl(280, 50%, 45%)',
  'hsl(170, 50%, 35%)',
];

const ComparePanel = () => {
  const [selectedVar, setSelectedVar] = useState(STAT_VARIABLES.gdpPerCapita.dcid);
  
  const allDcids = Object.values(PEER_COUNTRIES);
  const { data, isLoading } = useCountryComparison(selectedVar, allDcids);

  const chartData = useMemo(() => {
    if (!data) return [];
    return Object.entries(PEER_COUNTRIES).map(([name, dcid]) => {
      const parsed = parseLatestValue(data, selectedVar, dcid);
      return {
        name,
        value: parsed?.value || 0,
        date: parsed?.date || '',
      };
    }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  }, [data, selectedVar]);

  const selectedLabel = Object.values(STAT_VARIABLES).find(v => v.dcid === selectedVar)?.label || '';

  return (
    <div className="bg-card rounded-xl p-6 shadow-card">
      <div className="mb-6">
        <Select value={selectedVar} onValueChange={setSelectedVar}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Select indicator" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STAT_VARIABLES).map(([key, stat]) => (
              <SelectItem key={key} value={stat.dcid}>{stat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full rounded-lg" />
      ) : chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 13, fill: 'hsl(var(--foreground))', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              width={80}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '13px',
              }}
              formatter={(value: number) => [value.toLocaleString(), selectedLabel]}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
              {chartData.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-96 flex items-center justify-center text-muted-foreground">
          No comparison data available for this indicator.
        </div>
      )}
    </div>
  );
};

export default ComparePanel;
