import { useState, useMemo, useCallback, useEffect } from "react";
import { Loader2, Sparkles, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Info, XCircle, ChevronRight, Table, BarChart3, Download, ZoomIn, ArrowUpRight, ArrowDownRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNLQuery } from "@/hooks/useDataCommons";
import { getTimeSeries, getObservation } from "@/lib/datacommons";
import { parseTimeSeries, parseLatestValue } from "@/hooks/useDataCommons";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell, Area, AreaChart, ReferenceLine, Brush } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

const CHART_COLORS = ['#c5221f', '#1a73e8', '#34a853', '#f9ab00', '#9334e6'];

// ─── Data extraction ────────────────────────────────────────────────

function extractBlocks(data: any) {
  if (!data?.config?.categories) return [];
  const blocks: any[] = [];
  const category = data.config.categories[0];
  if (!category?.blocks) return [];
  const statVarSpec = category.statVarSpec || {};
  const placeDcids = data.config?.metadata?.placeDcid || [];
  const mainPlace = placeDcids[0] || 'country/NGA';

  for (const block of category.blocks) {
    if (blocks.length >= 8) break;
    const tiles: any[] = [];
    for (const col of block.columns || []) {
      for (const tile of col.tiles || []) {
        const statVars = (tile.statVarKey || []).map((key: string) => {
          const spec = statVarSpec[key];
          return spec ? { key, dcid: spec.statVar, name: spec.name } : { key, dcid: key, name: key };
        });
        tiles.push({ type: tile.type, title: tile.title || block.title, description: tile.description, statVars });
      }
    }
    blocks.push({ title: block.title, description: block.description, footnote: block.footnote, tiles, mainPlace });
  }
  return blocks;
}

function buildDataSummary(blocks: any[], collectedData: Record<string, any>): string {
  const lines: string[] = [];
  for (const block of blocks) {
    lines.push(`\n## ${block.title}`);
    if (block.description) lines.push(block.description);
    for (const tile of block.tiles) {
      for (const sv of tile.statVars) {
        const key = `${tile.type}-${sv.dcid}-${block.mainPlace}`;
        const d = collectedData[key];
        if (!d) continue;
        if (tile.type === 'HIGHLIGHT') {
          const parsed = parseLatestValue(d, sv.dcid, block.mainPlace);
          if (parsed) lines.push(`- ${sv.name}: ${parsed.value} (${parsed.date})`);
        } else {
          const series = parseTimeSeries(d, sv.dcid, block.mainPlace);
          if (series.length > 0) {
            const first = series[0]; const last = series[series.length - 1];
            lines.push(`- ${sv.name}: from ${first.value} (${first.date}) to ${last.value} (${last.date}), ${series.length} data points`);
          }
        }
      }
    }
  }
  return lines.join('\n');
}

// ─── Percentage change helper ───────────────────────────────────────

function calcChange(series: { date: string; value: number }[]): { pct: number; direction: 'up' | 'down' | 'stable'; prevValue: number; prevDate: string } | null {
  if (series.length < 2) return null;
  const latest = series[series.length - 1];
  const prev = series[series.length - 2];
  if (prev.value === 0) return null;
  const pct = ((latest.value - prev.value) / Math.abs(prev.value)) * 100;
  return {
    pct,
    direction: Math.abs(pct) < 0.5 ? 'stable' : pct > 0 ? 'up' : 'down',
    prevValue: prev.value,
    prevDate: prev.date,
  };
}

// ─── Data Table component ───────────────────────────────────────────

function DataTable({ series, title }: { series: { date: string; value: number }[]; title: string }) {
  const handleDownload = () => {
    const csv = ['Date,Value', ...series.map(r => `${r.date},${r.value}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{series.length} data points</span>
        <Button variant="ghost" size="sm" onClick={handleDownload} className="text-xs gap-1.5 h-7">
          <Download className="w-3 h-3" /> CSV
        </Button>
      </div>
      <div className="max-h-60 overflow-y-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Date</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Value</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Change</th>
            </tr>
          </thead>
          <tbody>
            {[...series].reverse().map((row, i, arr) => {
              const prev = arr[i + 1];
              const change = prev ? ((row.value - prev.value) / Math.abs(prev.value)) * 100 : null;
              return (
                <tr key={row.date} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="py-1.5 px-3 text-foreground">{row.date}</td>
                  <td className="py-1.5 px-3 text-right font-mono text-foreground">{formatValue(row.value)}</td>
                  <td className="py-1.5 px-3 text-right">
                    {change !== null && (
                      <span className={`text-xs font-medium ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {change > 0 ? '+' : ''}{change.toFixed(1)}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

// ─── Chart tiles ────────────────────────────────────────────────────

function ChartTile({ tile, mainPlace, onDataLoaded }: { tile: any; mainPlace: string; onDataLoaded?: (key: string, data: any) => void }) {
  const dcids = tile.statVars.map((sv: any) => sv.dcid);
  const { data, isLoading } = useQuery({
    queryKey: ['nl-chart', tile.type, dcids, mainPlace],
    queryFn: async () => {
      const result = tile.type === 'HIGHLIGHT' ? await getObservation(dcids, [mainPlace]) : await getTimeSeries(dcids, [mainPlace]);
      if (onDataLoaded) { for (const sv of tile.statVars) { onDataLoaded(`${tile.type}-${sv.dcid}-${mainPlace}`, result); } }
      return result;
    },
    staleTime: 1000 * 60 * 30,
  });

  if (isLoading) return <Skeleton className="h-52 w-full rounded-lg" />;
  if (tile.type === 'HIGHLIGHT') return <HighlightTile tile={tile} data={data} mainPlace={mainPlace} />;
  if (tile.type === 'LINE') return <LineTile tile={tile} data={data} mainPlace={mainPlace} />;
  if (tile.type === 'BAR') return <BarTile tile={tile} data={data} mainPlace={mainPlace} />;
  return null;
}

function getSourceInfo(data: any, dcid: string, mainPlace: string) {
  try {
    const facets = data?.byVariable?.[dcid]?.byEntity?.[mainPlace]?.orderedFacets;
    if (!facets?.length) return null;
    const facetMeta = data?.facets?.[facets[0].facetId];
    if (!facetMeta) return null;
    const url = facetMeta.provenanceUrl || '';
    const domain = url ? new URL(url).hostname.replace('www.', '') : '';
    return { url, domain };
  } catch { return null; }
}

function SourceAttribution({ data, dcid, mainPlace }: { data: any; dcid: string; mainPlace: string }) {
  const source = getSourceInfo(data, dcid, mainPlace);
  if (!source?.domain) return null;
  return (
    <p className="text-[11px] text-muted-foreground mt-1 truncate">
      Source: <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{source.domain}</a>
    </p>
  );
}

function HighlightTile({ tile, data, mainPlace }: { tile: any; data: any; mainPlace: string }) {
  const values = tile.statVars.map((sv: any) => {
    const parsed = parseLatestValue(data, sv.dcid, mainPlace);
    return { name: sv.name, dcid: sv.dcid, ...parsed };
  }).filter((v: any) => v?.value != null);
  if (values.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-primary/5 rounded-xl p-6 flex flex-col justify-center border border-primary/10"
    >
      {values.map((v: any, i: number) => (
        <div key={i}>
          <p className="text-4xl font-bold text-foreground tracking-tight">{formatHighlightValue(v.value)}</p>
          {getUnit(v.name) && <p className="text-sm text-muted-foreground mt-1">{getUnit(v.name)}</p>}
          <p className="text-sm font-medium text-foreground mt-2">{tile.title || v.name} ({v.date})</p>
          <SourceAttribution data={data} dcid={v.dcid} mainPlace={mainPlace} />
        </div>
      ))}
    </motion.div>
  );
}

function ChartSummary({ tile, data, mainPlace }: { tile: any; data: any; mainPlace: string }) {
  const summary = useMemo(() => {
    if (!data || tile.statVars.length === 0) return null;
    const sv = tile.statVars[0];
    const series = parseTimeSeries(data, sv.dcid, mainPlace);
    if (series.length === 0) return null;
    const latest = series[series.length - 1];
    const source = getSourceInfo(data, sv.dcid, mainPlace);
    const change = calcChange(series);
    return { value: latest.value, date: latest.date, name: sv.name, dcid: sv.dcid, source, change };
  }, [data, tile, mainPlace]);

  if (!summary) return null;

  const ChangeIcon = summary.change?.direction === 'up' ? ArrowUpRight : summary.change?.direction === 'down' ? ArrowDownRight : Minus;
  const changeColor = summary.change?.direction === 'up' ? 'text-green-600' : summary.change?.direction === 'down' ? 'text-red-600' : 'text-muted-foreground';

  return (
    <div className="flex flex-col justify-center p-5">
      <p className="text-4xl font-bold text-foreground tracking-tight">{formatHighlightValue(summary.value)}</p>
      {summary.change && (
        <div className={`flex items-center gap-1 mt-1.5 ${changeColor}`}>
          <ChangeIcon className="w-3.5 h-3.5" />
          <span className="text-sm font-semibold">{summary.change.pct > 0 ? '+' : ''}{summary.change.pct.toFixed(1)}%</span>
          <span className="text-xs text-muted-foreground ml-1">from {summary.change.prevDate}</span>
        </div>
      )}
      {getUnit(summary.name) && <p className="text-sm text-muted-foreground mt-1">{getUnit(summary.name)}</p>}
      <p className="text-sm font-medium text-foreground mt-3">{tile.title || summary.name} in Nigeria ({summary.date})</p>
      {summary.source?.domain && (
        <p className="text-[11px] text-muted-foreground mt-2 truncate">
          Source: <a href={summary.source.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{summary.source.domain}</a>
        </p>
      )}
    </div>
  );
}

function LineTile({ tile, data, mainPlace }: { tile: any; data: any; mainPlace: string }) {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  const chartData = useMemo(() => {
    if (!data) return [];
    if (tile.statVars.length === 1) return parseTimeSeries(data, tile.statVars[0].dcid, mainPlace);
    const dateMap: Record<string, any> = {};
    tile.statVars.forEach((sv: any) => {
      parseTimeSeries(data, sv.dcid, mainPlace).forEach((pt: any) => {
        if (!dateMap[pt.date]) dateMap[pt.date] = { date: pt.date };
        dateMap[pt.date][sv.dcid] = pt.value;
      });
    });
    return Object.values(dateMap).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [data, tile.statVars, mainPlace]);

  if (chartData.length === 0) return <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data available</div>;

  // Calculate average for reference line
  const avg = tile.statVars.length === 1
    ? chartData.reduce((s: number, d: any) => s + d.value, 0) / chartData.length
    : null;

  return (
    <>
      <div className="bg-card rounded-xl p-5 border border-border">
        <div className="flex items-center justify-between mb-1">
          <h5 className="text-sm font-semibold text-foreground">{tile.title}</h5>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('chart')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'chart' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              title="Chart view"
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              title="Table view"
            >
              <Table className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <SourceAttribution data={data} dcid={tile.statVars[0]?.dcid} mainPlace={mainPlace} />

        <AnimatePresence mode="wait">
          {viewMode === 'chart' ? (
            <motion.div key="chart" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3">
              <ResponsiveContainer width="100%" height={240}>
                {tile.statVars.length === 1 ? (
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id={`grad-${tile.statVars[0]?.dcid}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={formatAxisValue} width={55} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(value: number) => [formatValue(value), tile.statVars[0]?.name]} />
                    {avg !== null && <ReferenceLine y={avg} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: `avg: ${formatAxisValue(avg)}`, position: 'right', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />}
                    <Area type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2} fill={`url(#grad-${tile.statVars[0]?.dcid})`} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
                    {chartData.length > 20 && <Brush dataKey="date" height={20} stroke="hsl(var(--border))" travellerWidth={8} />}
                  </AreaChart>
                ) : (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={formatAxisValue} width={55} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(value: number, name: string) => {
                        const svName = tile.statVars.find((sv: any) => sv.dcid === name)?.name || name;
                        return [formatValue(value), svName];
                      }} />
                    {tile.statVars.map((sv: any, i: number) => (
                      <Line key={sv.dcid} type="monotone" dataKey={sv.dcid} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} name={sv.dcid} activeDot={{ r: 4 }} />
                    ))}
                    {chartData.length > 20 && <Brush dataKey="date" height={20} stroke="hsl(var(--border))" travellerWidth={8} />}
                  </LineChart>
                )}
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 px-2">
                {tile.statVars.map((sv: any, i: number) => (
                  <div key={sv.dcid} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    {sv.name}
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3">
              <DataTable
                series={tile.statVars.length === 1
                  ? chartData
                  : chartData.map((d: any) => ({ date: d.date, value: d[tile.statVars[0]?.dcid] || 0 }))
                }
                title={tile.title}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <ChartSummary tile={tile} data={data} mainPlace={mainPlace} />
    </>
  );
}

function BarTile({ tile, data, mainPlace }: { tile: any; data: any; mainPlace: string }) {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  const chartData = useMemo(() => {
    if (!data) return [];
    return tile.statVars.map((sv: any) => {
      const parsed = parseLatestValue(data, sv.dcid, mainPlace);
      return { name: sv.name, value: parsed?.value || 0 };
    }).filter((d: any) => d.value > 0);
  }, [data, tile.statVars, mainPlace]);

  if (chartData.length === 0) return null;
  return (
    <>
      <div className="bg-card rounded-xl p-5 border border-border">
        <div className="flex items-center justify-between mb-1">
          <h5 className="text-sm font-semibold text-foreground">{tile.title}</h5>
          <div className="flex items-center gap-1">
            <button onClick={() => setViewMode('chart')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'chart' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`} title="Chart view">
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`} title="Table view">
              <Table className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <SourceAttribution data={data} dcid={tile.statVars[0]?.dcid} mainPlace={mainPlace} />

        <AnimatePresence mode="wait">
          {viewMode === 'chart' ? (
            <motion.div key="chart" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={formatAxisValue} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => [formatValue(v), '']} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={36}>
                    {chartData.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          ) : (
            <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3">
              <DataTable series={chartData.map(d => ({ date: d.name, value: d.value }))} title={tile.title} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <ChartSummary tile={tile} data={data} mainPlace={mainPlace} />
    </>
  );
}

// ─── AI Dynamic Analysis ────────────────────────────────────────────

interface AIAnalysis {
  headline: string;
  keyMetrics: { label: string; value: string; context: string; trend: 'up' | 'down' | 'stable' }[];
  insights: { title: string; text: string; sentiment: 'positive' | 'negative' | 'neutral' | 'warning' }[];
  comparisons: { metric: string; nigeria: string; other: string; otherName: string; nigeriaPercent: number; otherPercent: number }[];
  policyNote: string;
  nextQuestions: string[];
}

const sentimentConfig = {
  positive: { icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-200 dark:border-green-900/40' },
  negative: { icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-900/40' },
  warning: { icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-900/40' },
  neutral: { icon: Info, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-900/40' },
};

const trendIcons = { up: TrendingUp, down: TrendingDown, stable: Minus };

function AIInsightsPanel({ query, blocks, collectedData, onQueryClick }: {
  query: string; blocks: any[]; collectedData: Record<string, any>; onQueryClick: (q: string) => void;
}) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [hasTriggered, setHasTriggered] = useState('');

  const generateInsights = useCallback(async (extraContext?: string) => {
    const dataSummary = buildDataSummary(blocks, collectedData);
    if (!dataSummary.trim()) return;

    setIsLoading(true);
    setError('');
    setAnalysis(null);

    const fullQuery = extraContext ? `${query}\n\nFollow-up: ${extraContext}` : query;

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ query: fullQuery, dataSummary }),
      });

      if (!resp.ok) throw new Error('Analysis failed');
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setAnalysis(data);
    } catch (err) {
      console.error('AI analysis error:', err);
      setError('Unable to generate analysis. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [query, blocks, collectedData]);

  // Auto-trigger when data is ready
  const dataReady = Object.keys(collectedData).length > 0;
  useEffect(() => {
    if (dataReady && query && query !== hasTriggered) {
      setHasTriggered(query);
      generateInsights();
    }
  }, [dataReady, query, hasTriggered, generateInsights]);

  const handleFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (followUp.trim()) {
      generateInsights(followUp.trim());
      setFollowUp('');
    }
  };

  return (
    <div className="space-y-1">

      {/* Loading */}
      {isLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Analyzing data and generating insights...
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-32 rounded-xl" />
        </motion.div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm flex items-center justify-between">
          {error}
          <Button onClick={() => generateInsights()} size="sm" variant="outline">Retry</Button>
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {analysis && !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-5"
          >
            {/* Headline */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5 shrink-0">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h4 className="font-serif text-xl text-foreground leading-snug">{analysis.headline}</h4>
                <button onClick={() => generateInsights()} className="text-xs text-muted-foreground hover:text-primary mt-1 transition-colors">
                  Regenerate analysis
                </button>
              </div>
            </motion.div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {analysis.keyMetrics.map((m, i) => {
                const TrendIcon = trendIcons[m.trend] || Minus;
                const trendColor = m.trend === 'up' ? 'text-green-600' : m.trend === 'down' ? 'text-red-600' : 'text-muted-foreground';
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.15 + i * 0.08 }}
                    className="bg-card rounded-xl p-4 border border-border hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{m.label}</span>
                      <TrendIcon className={`w-3.5 h-3.5 ${trendColor}`} />
                    </div>
                    <p className="text-2xl font-bold text-foreground tracking-tight">{m.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{m.context}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* Insights */}
            <div className="space-y-3">
              {analysis.insights.map((insight, i) => {
                const config = sentimentConfig[insight.sentiment] || sentimentConfig.neutral;
                const Icon = config.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className={`rounded-xl p-4 border ${config.bg} ${config.border}`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`w-4.5 h-4.5 mt-0.5 shrink-0 ${config.color}`} />
                      <div>
                        <h5 className="text-sm font-semibold text-foreground">{insight.title}</h5>
                        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{insight.text}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Comparisons */}
            {analysis.comparisons.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="bg-card rounded-xl p-5 border border-border"
              >
                <h5 className="text-sm font-semibold text-foreground mb-4">How Nigeria Compares</h5>
                <div className="space-y-5">
                  {analysis.comparisons.map((comp, i) => (
                    <div key={i} className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{comp.metric}</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-foreground w-24 shrink-0">🇳🇬 Nigeria</span>
                          <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(comp.nigeriaPercent, 100)}%` }}
                              transition={{ delay: 0.8 + i * 0.15, duration: 0.6, ease: "easeOut" }}
                              className="h-full rounded-full bg-primary"
                            />
                          </div>
                          <span className="text-xs font-bold text-foreground w-16 text-right">{comp.nigeria}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-muted-foreground w-24 shrink-0">{comp.otherName}</span>
                          <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(comp.otherPercent, 100)}%` }}
                              transition={{ delay: 0.9 + i * 0.15, duration: 0.6, ease: "easeOut" }}
                              className="h-full rounded-full bg-muted-foreground/30"
                            />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground w-16 text-right">{comp.other}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Policy Note */}
            {analysis.policyNote && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl p-4 border border-primary/10"
              >
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center mt-0.5 shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-1">Policy Implication</h5>
                    <p className="text-sm text-muted-foreground leading-relaxed">{analysis.policyNote}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Next Questions */}
            {analysis.nextQuestions?.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0 }}
                className="space-y-2"
              >
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dig Deeper</h5>
                <div className="flex flex-col gap-1.5">
                  {analysis.nextQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => onQueryClick(q)}
                      className="flex items-center gap-2 text-sm text-left text-muted-foreground hover:text-foreground p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <ChevronRight className="w-3.5 h-3.5 text-primary shrink-0 group-hover:translate-x-0.5 transition-transform" />
                      {q}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Follow-up question */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1 }}
            >
              <form onSubmit={handleFollowUp} className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    placeholder="Ask a follow-up question about this data..."
                    className="w-full pl-9 pr-4 h-10 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <Button type="submit" size="sm" disabled={!followUp.trim() || isLoading} className="gap-1.5 shrink-0">
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  Ask
                </Button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Formatting helpers ─────────────────────────────────────────────

function formatHighlightValue(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `${(v / 1_000).toFixed(0)}K`;
  if (Number.isInteger(v)) return v.toLocaleString();
  return v.toFixed(1);
}

function formatValue(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  if (Number.isInteger(v)) return v.toLocaleString();
  return v.toFixed(2);
}

function formatAxisValue(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toString();
}

function getUnit(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.includes('rate') && lower.includes('mortality')) return '/1k live births';
  if (lower.includes('per capita')) return 'per capita';
  if (lower.includes('fertility')) return 'births per woman';
  if (lower.includes('life expectancy')) return 'years';
  if (lower.includes('growth rate')) return '%';
  return null;
}

// ─── Empty state with AI-powered suggestions ───────────────────────

const FALLBACK_QUERIES = [
  "What is the GDP of Nigeria?",
  "Population growth in Nigeria",
  "Life expectancy in Nigeria",
  "Unemployment rate in Nigeria",
  "CO2 emissions per capita in Nigeria",
  "Infant mortality rate in Nigeria",
];

function EmptyResultState({ query, onQueryClick }: { query: string; onQueryClick: (q: string) => void }) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            query: `The user searched for "${query}" on a Nigeria data platform but no results were found. Suggest 6 alternative search queries that ARE available in Google Data Commons for Nigeria. The queries should be related to the user's intent but use measurable statistical indicators (e.g. GDP, population, literacy rate, life expectancy, CO2 emissions, unemployment, infant mortality, fertility rate, internet users, etc). Return ONLY a JSON array of 6 strings, nothing else.`,
            dataSummary: 'No data found for this query. Generate related searchable alternatives.',
            mode: 'suggestions_only',
          }),
        });
        if (!resp.ok) throw new Error('Failed');
        const text = await resp.text();
        // Extract JSON array from response
        const match = text.match(/\[[\s\S]*?\]/);
        if (match && !cancelled) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSuggestions(parsed.filter((s: any) => typeof s === 'string').slice(0, 6));
          } else {
            setSuggestions(FALLBACK_QUERIES);
          }
        } else {
          setSuggestions(FALLBACK_QUERIES);
        }
      } catch {
        if (!cancelled) setSuggestions(FALLBACK_QUERIES);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [query]);

  const displaySuggestions = suggestions.length > 0 ? suggestions : FALLBACK_QUERIES;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-12 max-w-lg mx-auto"
    >
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
        <Search className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">No exact data found</h3>
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
        We couldn't find statistical data for "<span className="font-medium text-foreground">{query}</span>". 
        Try one of these related queries instead:
      </p>
      {loading ? (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          Finding related topics...
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 justify-center">
          {displaySuggestions.map(q => (
            <button
              key={q}
              onClick={() => onQueryClick(q)}
              className="text-xs px-3.5 py-2 rounded-full border border-border bg-card text-muted-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-all"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Related topics ─────────────────────────────────────────────────

function RelatedTopics({ data, onTopicClick }: { data: any; onTopicClick: (q: string) => void }) {
  const topics = data?.relatedThings?.peerTopics || [];
  const places = data?.relatedThings?.mainTopics || [];
  if (topics.length === 0 && places.length === 0) return null;
  return (
    <div className="mt-6">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Explore Related</p>
      <div className="flex flex-wrap gap-2">
        {[...places, ...topics].map((t: any) => (
          <button key={t.dcid} onClick={() => onTopicClick(`${t.name} in Nigeria`)} className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main panel ─────────────────────────────────────────────────────

interface NLSearchPanelProps {
  initialQuery: string;
  onQueryChange?: (q: string) => void;
}

const NLSearchPanel = ({ initialQuery, onQueryChange }: NLSearchPanelProps) => {
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [collectedData, setCollectedData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (initialQuery && initialQuery !== submittedQuery) {
      setCollectedData({});
      setSubmittedQuery(initialQuery);
    }
  }, [initialQuery]);

  const { data, isLoading, error } = useNLQuery(submittedQuery);
  const blocks = useMemo(() => (data ? extractBlocks(data) : []), [data]);
  const hasFailure = data?.failure;

  // Separate highlight blocks from chart blocks for reordering
  const { highlightBlocks, chartBlocks } = useMemo(() => {
    const hBlocks: any[] = [];
    const cBlocks: any[] = [];
    for (const block of blocks) {
      const highlightTiles = block.tiles.filter((t: any) => t.type === 'HIGHLIGHT');
      const chartTiles = block.tiles.filter((t: any) => t.type !== 'HIGHLIGHT');
      if (highlightTiles.length > 0) {
        hBlocks.push({ ...block, tiles: highlightTiles });
      }
      if (chartTiles.length > 0) {
        cBlocks.push({ ...block, tiles: chartTiles });
      }
    }
    return { highlightBlocks: hBlocks, chartBlocks: cBlocks };
  }, [blocks]);

  const handleQueryClick = (q: string) => {
    setCollectedData({});
    setSubmittedQuery(q);
    onQueryChange?.(q);
  };

  const handleDataLoaded = useCallback((key: string, d: any) => {
    setCollectedData(prev => ({ ...prev, [key]: d }));
  }, []);

  return (
    <div className="space-y-6">
      {isLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Searching for data...
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </motion.div>
      )}

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-destructive/10 text-destructive p-5 rounded-xl text-sm space-y-3">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Something went wrong</p>
              <p className="text-muted-foreground mt-1">We couldn't process your query. This might be a temporary issue — please try again.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => handleQueryClick(submittedQuery)} size="sm" variant="outline" className="gap-1.5">
              <Search className="w-3.5 h-3.5" /> Retry
            </Button>
          </div>
        </motion.div>
      )}

      {hasFailure && !isLoading && (
        <EmptyResultState query={submittedQuery} onQueryClick={handleQueryClick} />
      )}

      {!hasFailure && blocks.length > 0 && !isLoading && (
        <div className="space-y-8 animate-fade-in">
          <h3 className="font-serif text-2xl md:text-3xl text-foreground">{submittedQuery}</h3>

          {/* Summary cards FIRST */}
          {highlightBlocks.length > 0 && (
            <section className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Key Figures</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {highlightBlocks.flatMap(block =>
                  block.tiles.map((tile: any, ti: number) => (
                    <ChartTile key={`h-${ti}`} tile={tile} mainPlace={block.mainPlace} onDataLoaded={handleDataLoaded} />
                  ))
                )}
              </div>
            </section>
          )}

          {/* Chart blocks */}
          {chartBlocks.map((block, bi) => (
            <section key={bi} className="space-y-3">
              <div className="border-b border-border pb-2">
                <h4 className="font-serif text-lg text-foreground">{block.title}</h4>
                {block.description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-3xl">{block.description}</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-4">
                {block.tiles.map((tile: any, ti: number) => (
                  <ChartTile key={ti} tile={tile} mainPlace={block.mainPlace} onDataLoaded={handleDataLoaded} />
                ))}
              </div>
              {block.footnote && <p className="text-[11px] text-muted-foreground italic">{block.footnote}</p>}
            </section>
          ))}

          {/* AI Analysis */}
          <AIInsightsPanel query={submittedQuery} blocks={blocks} collectedData={collectedData} onQueryClick={handleQueryClick} />

          <RelatedTopics data={data} onTopicClick={handleQueryClick} />
        </div>
      )}
    </div>
  );
};

export default NLSearchPanel;
