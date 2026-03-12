import { useState, useMemo } from "react";
import { Search, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNLQuery } from "@/hooks/useDataCommons";
import { getTimeSeries, getObservation } from "@/lib/datacommons";
import { parseTimeSeries, parseLatestValue } from "@/hooks/useDataCommons";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";

const EXAMPLE_QUERIES = [
  "What is Nigeria's population?",
  "Health in Nigeria",
  "Life expectancy in Nigeria over time",
  "CO2 emissions per capita in Nigeria",
  "Fertility rate in Nigeria",
];

const CHART_COLORS = [
  '#c5221f', // DC red
  '#1a73e8', // DC blue
  '#34a853', // DC green
  '#f9ab00', // DC yellow
  '#9334e6', // DC purple
];

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
        tiles.push({
          type: tile.type,
          title: tile.title || block.title,
          description: tile.description,
          statVars,
        });
      }
    }
    blocks.push({
      title: block.title,
      description: block.description,
      footnote: block.footnote,
      tiles,
      mainPlace,
    });
  }
  return blocks;
}

function ChartTile({ tile, mainPlace }: { tile: any; mainPlace: string }) {
  const dcids = tile.statVars.map((sv: any) => sv.dcid);

  const { data, isLoading } = useQuery({
    queryKey: ['nl-chart', tile.type, dcids, mainPlace],
    queryFn: async () => {
      if (tile.type === 'HIGHLIGHT') {
        return getObservation(dcids, [mainPlace]);
      }
      return getTimeSeries(dcids, [mainPlace]);
    },
    staleTime: 1000 * 60 * 30,
  });

  if (isLoading) {
    return <Skeleton className="h-52 w-full rounded-lg" />;
  }

  if (tile.type === 'HIGHLIGHT') {
    return <HighlightTile tile={tile} data={data} mainPlace={mainPlace} />;
  }
  if (tile.type === 'LINE') {
    return <LineTile tile={tile} data={data} mainPlace={mainPlace} />;
  }
  if (tile.type === 'BAR') {
    return <BarTile tile={tile} data={data} mainPlace={mainPlace} />;
  }
  if (tile.type === 'RANKING') {
    return null;
  }
  return null;
}

function getSourceInfo(data: any, dcid: string, mainPlace: string) {
  try {
    const facets = data?.byVariable?.[dcid]?.byEntity?.[mainPlace]?.orderedFacets;
    if (!facets || facets.length === 0) return null;
    const facetId = facets[0].facetId;
    const facetMeta = data?.facets?.[facetId];
    if (!facetMeta) return null;
    const url = facetMeta.provenanceUrl || '';
    const domain = url ? new URL(url).hostname.replace('www.', '') : '';
    return { url, domain, importName: facetMeta.importName };
  } catch {
    return null;
  }
}

function SourceAttribution({ data, dcid, mainPlace }: { data: any; dcid: string; mainPlace: string }) {
  const source = getSourceInfo(data, dcid, mainPlace);
  if (!source?.domain) return null;
  return (
    <p className="text-[11px] text-muted-foreground mt-2">
      Source:{' '}
      <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
        {source.domain}
      </a>
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
          <p className="text-4xl font-bold text-foreground tracking-tight">
            {formatHighlightValue(v.value)}
          </p>
          {getUnit(v.name) && (
            <p className="text-sm text-muted-foreground mt-1">{getUnit(v.name)}</p>
          )}
          <p className="text-sm font-medium text-foreground mt-2">
            {tile.title || v.name} ({v.date})
          </p>
          <SourceAttribution data={data} dcid={v.dcid} mainPlace={mainPlace} />
        </div>
      ))}
    </div>
  );
}

function LineTile({ tile, data, mainPlace }: { tile: any; data: any; mainPlace: string }) {
  const chartData = useMemo(() => {
    if (!data) return [];
    if (tile.statVars.length === 1) {
      return parseTimeSeries(data, tile.statVars[0].dcid, mainPlace);
    }
    const dateMap: Record<string, any> = {};
    tile.statVars.forEach((sv: any) => {
      const series = parseTimeSeries(data, sv.dcid, mainPlace);
      series.forEach((pt: any) => {
        if (!dateMap[pt.date]) dateMap[pt.date] = { date: pt.date };
        dateMap[pt.date][sv.dcid] = pt.value;
      });
    });
    return Object.values(dateMap).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [data, tile.statVars, mainPlace]);

  if (chartData.length === 0) {
    return <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data available</div>;
  }

  return (
    <div className="bg-card rounded-xl p-5 border border-border">
      <h5 className="text-sm font-semibold text-foreground mb-1">{tile.title}</h5>
      <SourceAttribution data={data} dcid={tile.statVars[0]?.dcid} mainPlace={mainPlace} />
      <div className="mt-3">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatAxisValue}
              width={55}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number, name: string) => {
                const svName = tile.statVars.find((sv: any) => sv.dcid === name)?.name || name;
                return [formatValue(value), svName === 'value' ? tile.statVars[0]?.name : svName];
              }}
            />
            {tile.statVars.length === 1 ? (
              <Line
                type="monotone"
                dataKey="value"
                stroke={CHART_COLORS[0]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: CHART_COLORS[0] }}
              />
            ) : (
              tile.statVars.map((sv: any, i: number) => (
                <Line
                  key={sv.dcid}
                  type="monotone"
                  dataKey={sv.dcid}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  name={sv.dcid}
                  activeDot={{ r: 4 }}
                />
              ))
            )}
          </LineChart>
        </ResponsiveContainer>
        {/* Legend */}
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
  );
}

function BarTile({ tile, data, mainPlace }: { tile: any; data: any; mainPlace: string }) {
  const chartData = useMemo(() => {
    if (!data) return [];
    return tile.statVars.map((sv: any) => {
      const parsed = parseLatestValue(data, sv.dcid, mainPlace);
      return { name: sv.name, value: parsed?.value || 0, dcid: sv.dcid };
    }).filter((d: any) => d.value > 0);
  }, [data, tile.statVars, mainPlace]);

  if (chartData.length === 0) return null;

  return (
    <div className="bg-card rounded-xl p-5 border border-border">
      <h5 className="text-sm font-semibold text-foreground mb-1">{tile.title}</h5>
      <SourceAttribution data={data} dcid={tile.statVars[0]?.dcid} mainPlace={mainPlace} />
      <div className="mt-3">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={formatAxisValue} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
              formatter={(v: number) => [formatValue(v), '']}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={36}>
              {chartData.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

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

function RelatedTopics({ data, onTopicClick }: { data: any; onTopicClick: (q: string) => void }) {
  const topics = data?.relatedThings?.peerTopics || [];
  const places = data?.relatedThings?.mainTopics || [];
  if (topics.length === 0 && places.length === 0) return null;

  return (
    <div className="mt-6">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Explore Related</p>
      <div className="flex flex-wrap gap-2">
        {[...places, ...topics].map((t: any) => (
          <button
            key={t.dcid}
            onClick={() => onTopicClick(`${t.name} in Nigeria`)}
            className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}

const NLSearchPanel = () => {
  const [inputValue, setInputValue] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");

  const { data, isLoading, error } = useNLQuery(submittedQuery);

  const blocks = useMemo(() => (data ? extractBlocks(data) : []), [data]);
  const hasFailure = data?.failure;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setSubmittedQuery(inputValue.trim());
    }
  };

  const handleQueryClick = (q: string) => {
    setInputValue(q);
    setSubmittedQuery(q);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask anything about Nigeria's data..."
            className="pl-10 h-12 text-base"
          />
        </div>
        <Button type="submit" disabled={isLoading || !inputValue.trim()} className="h-12 px-6">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUERIES.map((q) => (
          <button
            key={q}
            onClick={() => handleQueryClick(q)}
            className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm">
          Failed to query. Please try a different question.
        </div>
      )}

      {hasFailure && !isLoading && (
        <div className="bg-secondary/20 text-muted-foreground p-4 rounded-lg text-sm">
          {data.failure}
        </div>
      )}

      {!hasFailure && blocks.length > 0 && !isLoading && (
        <div className="space-y-8 animate-fade-in">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <h3 className="font-serif text-xl text-foreground">
              Results for "{submittedQuery}"
            </h3>
          </div>

          {blocks.map((block, bi) => (
            <section key={bi} className="space-y-3">
              {/* Block header */}
              <div className="border-b border-border pb-2">
                <h4 className="font-serif text-lg text-foreground">{block.title}</h4>
                {block.description && (
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-3xl">{block.description}</p>
                )}
              </div>

              {/* Tiles: line + highlight side by side like DC */}
              <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-4">
                {block.tiles.map((tile: any, ti: number) => (
                  <ChartTile key={ti} tile={tile} mainPlace={block.mainPlace} />
                ))}
              </div>

              {block.footnote && (
                <p className="text-[11px] text-muted-foreground italic">{block.footnote}</p>
              )}
            </section>
          ))}

          <RelatedTopics data={data} onTopicClick={handleQueryClick} />
        </div>
      )}
    </div>
  );
};

export default NLSearchPanel;
