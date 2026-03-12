import { useState, useMemo, useCallback, useEffect } from "react";
import { Loader2, Sparkles, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Info, XCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNLQuery } from "@/hooks/useDataCommons";
import { getTimeSeries, getObservation } from "@/lib/datacommons";
import { parseTimeSeries, parseLatestValue } from "@/hooks/useDataCommons";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell } from "recharts";
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
    <p className="text-[11px] text-muted-foreground mt-1">
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
    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-6 flex flex-col justify-center border border-blue-100 dark:border-blue-900/40">
      {values.map((v: any, i: number) => (
        <div key={i}>
          <p className="text-4xl font-bold text-foreground tracking-tight">{formatHighlightValue(v.value)}</p>
          {getUnit(v.name) && <p className="text-sm text-muted-foreground mt-1">{getUnit(v.name)}</p>}
          <p className="text-sm font-medium text-foreground mt-2">{tile.title || v.name} ({v.date})</p>
          <SourceAttribution data={data} dcid={v.dcid} mainPlace={mainPlace} />
        </div>
      ))}
    </div>
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
    return { value: latest.value, date: latest.date, name: sv.name, dcid: sv.dcid, source };
  }, [data, tile, mainPlace]);

  if (!summary) return null;

  return (
    <div className="flex flex-col justify-center p-5">
      <p className="text-4xl font-bold text-foreground tracking-tight">{formatHighlightValue(summary.value)}</p>
      {getUnit(summary.name) && <p className="text-sm text-muted-foreground mt-1">{getUnit(summary.name)}</p>}
      <p className="text-sm font-medium text-foreground mt-3">{tile.title || summary.name} in Nigeria ({summary.date})</p>
      {summary.source?.domain && (
        <p className="text-[11px] text-muted-foreground mt-2">
          Source: <a href={summary.source.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{summary.source.domain}</a>
        </p>
      )}
    </div>
  );
}

function LineTile({ tile, data, mainPlace }: { tile: any; data: any; mainPlace: string }) {
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

  return (
    <>
      <div className="bg-card rounded-xl p-5 border border-border">
        <h5 className="text-sm font-semibold text-foreground mb-1">{tile.title}</h5>
        <SourceAttribution data={data} dcid={tile.statVars[0]?.dcid} mainPlace={mainPlace} />
        <div className="mt-3">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={formatAxisValue} width={55} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                formatter={(value: number, name: string) => {
                  const svName = tile.statVars.find((sv: any) => sv.dcid === name)?.name || name;
                  return [formatValue(value), svName === 'value' ? tile.statVars[0]?.name : svName];
                }} />
              {tile.statVars.length === 1 ? (
                <Line type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              ) : (
                tile.statVars.map((sv: any, i: number) => (
                  <Line key={sv.dcid} type="monotone" dataKey={sv.dcid} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} name={sv.dcid} activeDot={{ r: 4 }} />
                ))
              )}
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 px-2">
            {tile.statVars.map((sv: any, i: number) => (
              <div key={sv.dcid} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                {sv.name}
              </div>
            ))}
          </div>
        </div>
      </div>
      <ChartSummary tile={tile} data={data} mainPlace={mainPlace} />
    </>
  );
}

function BarTile({ tile, data, mainPlace }: { tile: any; data: any; mainPlace: string }) {
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
        <h5 className="text-sm font-semibold text-foreground mb-1">{tile.title}</h5>
        <SourceAttribution data={data} dcid={tile.statVars[0]?.dcid} mainPlace={mainPlace} />
        <div className="mt-3">
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
        </div>
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
  const [hasGenerated, setHasGenerated] = useState(false);
  const [error, setError] = useState('');

  const generateInsights = useCallback(async () => {
    const dataSummary = buildDataSummary(blocks, collectedData);
    if (!dataSummary.trim()) return;

    setIsLoading(true);
    setHasGenerated(true);
    setError('');
    setAnalysis(null);

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ query, dataSummary }),
      });

      if (!resp.ok) {
        throw new Error('Analysis failed');
      }

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

  const dataReady = Object.keys(collectedData).length > 0;

  return (
    <div className="space-y-1">
      {/* Trigger */}
      {!hasGenerated && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10"
        >
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-4.5 h-4.5 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground flex-1">Get AI-powered insights, comparisons, and policy implications from this data.</p>
          <Button onClick={generateInsights} disabled={!dataReady} size="sm" className="gap-1.5 shrink-0">
            <Sparkles className="w-3.5 h-3.5" /> Analyze
          </Button>
        </motion.div>
      )}

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
          <Button onClick={generateInsights} size="sm" variant="outline">Retry</Button>
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
                <button onClick={generateInsights} className="text-xs text-muted-foreground hover:text-primary mt-1 transition-colors">
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
                        {/* Nigeria bar */}
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
                        {/* Other bar */}
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

const NLSearchPanel = () => {
  const [inputValue, setInputValue] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [collectedData, setCollectedData] = useState<Record<string, any>>({});

  const { data, isLoading, error } = useNLQuery(submittedQuery);
  const blocks = useMemo(() => (data ? extractBlocks(data) : []), [data]);
  const hasFailure = data?.failure;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) { setCollectedData({}); setSubmittedQuery(inputValue.trim()); }
  };

  const handleQueryClick = (q: string) => {
    setInputValue(q);
    setCollectedData({});
    setSubmittedQuery(q);
  };

  const handleDataLoaded = useCallback((key: string, d: any) => {
    setCollectedData(prev => ({ ...prev, [key]: d }));
  }, []);

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Ask anything about Nigeria's data..." className="pl-10 h-12 text-base" />
        </div>
        <Button type="submit" disabled={isLoading || !inputValue.trim()} className="h-12 px-6">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUERIES.map((q) => (
          <button key={q} onClick={() => handleQueryClick(q)} className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
            {q}
          </button>
        ))}
      </div>

      {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm">Failed to query. Please try a different question.</div>}
      {hasFailure && !isLoading && <div className="bg-secondary/20 text-muted-foreground p-4 rounded-lg text-sm">{data.failure}</div>}

      {!hasFailure && blocks.length > 0 && !isLoading && (
        <div className="space-y-8 animate-fade-in">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <h3 className="font-serif text-xl text-foreground">Results for "{submittedQuery}"</h3>
          </div>

          {blocks.map((block, bi) => (
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
