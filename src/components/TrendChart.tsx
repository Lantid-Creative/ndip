import { useState, useMemo } from "react";
import { useTimeSeries, parseTimeSeries } from "@/hooks/useDataCommons";
import { NIGERIA_DCID, STAT_VARIABLES, PEER_COUNTRIES } from "@/lib/datacommons";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const TrendChart = () => {
  const [selectedVar, setSelectedVar] = useState(STAT_VARIABLES.population.dcid);
  const [selectedEntity, setSelectedEntity] = useState(NIGERIA_DCID);

  const { data, isLoading } = useTimeSeries(selectedVar, [selectedEntity]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return parseTimeSeries(data, selectedVar, selectedEntity);
  }, [data, selectedVar, selectedEntity]);

  const selectedLabel = Object.values(STAT_VARIABLES).find(v => v.dcid === selectedVar)?.label || '';

  return (
    <div className="bg-card rounded-xl p-6 shadow-card">
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
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

        <Select value={selectedEntity} onValueChange={setSelectedEntity}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PEER_COUNTRIES).map(([name, dcid]) => (
              <SelectItem key={dcid} value={dcid}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-80 w-full rounded-lg" />
      ) : chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()}
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
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: 'hsl(var(--primary))' }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-80 flex items-center justify-center text-muted-foreground">
          No time series data available for this selection.
        </div>
      )}
    </div>
  );
};

export default TrendChart;
