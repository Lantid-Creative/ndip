import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Search, Download as DownloadIcon, Loader2, X, ChevronRight, ChevronDown, Info } from "lucide-react";
import { queryDataCommons } from "@/lib/datacommons";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Statistical variable tree ─── */
const VARIABLE_TREE: VariableGroup[] = [
  {
    label: "Demographics",
    children: [
      { dcid: "Count_Person", label: "Total Population" },
      { dcid: "Count_Person_Male", label: "Male Population" },
      { dcid: "Count_Person_Female", label: "Female Population" },
      { dcid: "GrowthRate_Count_Person", label: "Population Growth Rate" },
      { dcid: "FertilityRate_Person_Female", label: "Fertility Rate" },
      { dcid: "LifeExpectancy_Person", label: "Life Expectancy" },
      { dcid: "Count_Death_0Years_AsFractionOf_Count_BirthEvent_LiveBirth", label: "Infant Mortality Rate" },
      { dcid: "Count_BirthEvent_LiveBirth_AsFractionOfCount_Person", label: "Birth Rate" },
      { dcid: "Count_Death_AsFractionOfCount_Person", label: "Death Rate" },
      { dcid: "dc/svpg/sdg/SP_POP_NETM.001", label: "Net Migration" },
    ],
  },
  {
    label: "Economy",
    children: [
      { dcid: "Amount_EconomicActivity_GrossDomesticProduction_Nominal", label: "GDP (Nominal)" },
      { dcid: "Amount_EconomicActivity_GrossDomesticProduction_Nominal_PerCapita", label: "GDP Per Capita" },
      { dcid: "GrowthRate_Amount_EconomicActivity_GrossDomesticProduction_Nominal", label: "GDP Growth Rate" },
      { dcid: "Amount_EconomicActivity_GrossNationalIncome_PurchasingPowerParity_PerCapita", label: "GNI Per Capita (PPP)" },
      { dcid: "UnemploymentRate_Person", label: "Unemployment Rate" },
      { dcid: "Amount_Remittance_InwardRemittance", label: "Inward Remittances" },
      { dcid: "Amount_Debt_Government_AsAFractionOfAmount_EconomicActivity_GrossDomesticProduction_Nominal", label: "Government Debt (% GDP)" },
    ],
  },
  {
    label: "Health",
    children: [
      { dcid: "LifeExpectancy_Person", label: "Life Expectancy" },
      { dcid: "LifeExpectancy_Person_Female", label: "Life Expectancy (Female)" },
      { dcid: "LifeExpectancy_Person_Male", label: "Life Expectancy (Male)" },
      { dcid: "Count_Death_0Years_AsFractionOf_Count_BirthEvent_LiveBirth", label: "Infant Mortality Rate" },
      { dcid: "Count_Person_IsInternetUser_PerCapita", label: "Internet Users Per Capita" },
    ],
  },
  {
    label: "Education",
    children: [
      { dcid: "Count_Person_LiteracyStatus_Literate_AsAFractionOfCount_Person_Age15Onwards", label: "Literacy Rate (15+)" },
      { dcid: "Count_Person_EnrolledInSchool_AsAFractionOfCount_Person_SchoolAge", label: "School Enrollment Rate" },
    ],
  },
  {
    label: "Environment",
    children: [
      { dcid: "Amount_Emissions_CarbonDioxide_PerCapita", label: "CO₂ Emissions Per Capita" },
      { dcid: "Amount_Emissions_CarbonDioxide", label: "Total CO₂ Emissions" },
      { dcid: "Amount_Emissions_GreenhouseGas_PerCapita", label: "Greenhouse Gas Per Capita" },
      { dcid: "Area_Forest", label: "Forest Area" },
    ],
  },
  {
    label: "Agriculture",
    children: [
      { dcid: "Area_Farm", label: "Agricultural Land" },
      { dcid: "Amount_CropProduction", label: "Crop Production" },
    ],
  },
  {
    label: "Energy",
    children: [
      { dcid: "Amount_Consumption_Energy_PerCapita", label: "Energy Consumption Per Capita" },
      { dcid: "Percent_Household_WithElectricity", label: "Electricity Access (%)" },
    ],
  },
];

interface VariableItem {
  dcid: string;
  label: string;
}

interface VariableGroup {
  label: string;
  children: VariableItem[];
}

/* ─── Geographic breakdown levels ─── */
const GEO_LEVELS = [
  { value: "Country", label: "Country" },
  { value: "AdministrativeArea1", label: "State / Province" },
  { value: "AdministrativeArea2", label: "District / LGA" },
  { value: "City", label: "City" },
];

/* ─── Place search result ─── */
interface PlaceResult {
  dcid: string;
  name: string;
}

type DateMode = "latest" | "all" | "range";

/* ─── Component ─── */
export default function DownloadPage() {
  // Place search
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [searchingPlace, setSearchingPlace] = useState(false);

  // Geo level
  const [geoLevel, setGeoLevel] = useState("");

  // Date
  const [dateMode, setDateMode] = useState<DateMode>("latest");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Variables (max 5)
  const [selectedVars, setSelectedVars] = useState<VariableItem[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [varFilter, setVarFilter] = useState("");

  // Preview / download
  const [previewData, setPreviewData] = useState<Record<string, unknown>[][] | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  /* ─── Place search ─── */
  const searchPlace = useCallback(async () => {
    if (!placeQuery.trim()) return;
    setSearchingPlace(true);
    setPlaceResults([]);
    try {
      const data = await queryDataCommons({
        endpoint: "resolve",
        params: {
          nodes: [placeQuery.trim()],
          property: "<-description->dcid",
        },
      });
      if (data?.failure) {
        setPlaceResults([]);
      } else {
        const entities = data?.entities || [];
        const results: PlaceResult[] = entities
          .flatMap((e: any) => (e.candidates || []).map((c: any) => ({ dcid: c.dcid, name: e.node || c.dcid })))
          .slice(0, 10);
        setPlaceResults(results);
      }
    } catch {
      setPlaceResults([]);
    }
    setSearchingPlace(false);
  }, [placeQuery]);

  /* ─── Variable selection ─── */
  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    );
  };

  const toggleVar = (v: VariableItem) => {
    setSelectedVars((prev) => {
      const exists = prev.find((s) => s.dcid === v.dcid);
      if (exists) return prev.filter((s) => s.dcid !== v.dcid);
      if (prev.length >= 5) return prev; // max 5
      return [...prev, v];
    });
  };

  const removeVar = (dcid: string) => {
    setSelectedVars((prev) => prev.filter((s) => s.dcid !== dcid));
  };

  /* ─── Fetch data ─── */
  const fetchData = useCallback(async () => {
    if (!selectedPlace || selectedVars.length === 0) return;
    setLoading(true);
    setErrorMsg("");
    setPreviewData(null);

    try {
      // Determine entities: if geoLevel is set, get child places; otherwise use selected place
      let entityDcids: string[] = [selectedPlace.dcid];

      if (geoLevel) {
        // Get contained places of the selected type
        const childData = await queryDataCommons({
          endpoint: "node",
          params: {
            nodes: [selectedPlace.dcid],
            property: "<-containedInPlace+{typeOf:" + geoLevel + "}",
          },
        });
        if (!childData?.failure && childData?.data?.[selectedPlace.dcid]) {
          const arcs = childData.data[selectedPlace.dcid];
          const inNodes = arcs?.arcs?.["containedInPlace+"]?.nodes || [];
          if (inNodes.length > 0) {
            entityDcids = inNodes.map((n: any) => n.dcid).filter(Boolean);
          }
        }
      }

      // Determine date param
      let dateParam = "LATEST";
      if (dateMode === "all") dateParam = "";
      else if (dateMode === "range") {
        if (dateFrom && dateTo) dateParam = `${dateFrom}/${dateTo}`;
        else if (dateFrom) dateParam = dateFrom;
        else dateParam = "LATEST";
      }

      // Fetch observations for all variables
      const varDcids = selectedVars.map((v) => v.dcid);
      const obsData = await queryDataCommons({
        endpoint: "observation",
        params: {
          date: dateParam,
          variable: { dcids: varDcids },
          entity: { dcids: entityDcids },
          select: ["variable", "entity", "value", "date"],
        },
      });

      if (obsData?.failure) {
        setErrorMsg(obsData.error || "Failed to fetch data from the API.");
        setLoading(false);
        return;
      }

      // Parse into rows: each row = { placeDcid, placeName, ...per-variable date/value/source }
      const rows: Record<string, unknown>[] = [];
      const byEntity = obsData?.byVariable || {};

      // Build a map: entity -> variable -> [{date, value}]
      const entityMap: Record<string, Record<string, { date: string; value: number }[]>> = {};

      for (const varDcid of varDcids) {
        const varData = byEntity[varDcid]?.byEntity || {};
        for (const entityDcid of Object.keys(varData)) {
          if (!entityMap[entityDcid]) entityMap[entityDcid] = {};
          const ordered = varData[entityDcid]?.orderedFacets || [];
          const observations: { date: string; value: number }[] = [];
          for (const facet of ordered) {
            for (const obs of facet.observations || []) {
              observations.push({ date: obs.date, value: obs.value });
            }
          }
          entityMap[entityDcid][varDcid] = observations;
        }
      }

      // Flatten into tabular rows
      for (const [entityDcid, varMap] of Object.entries(entityMap)) {
        // For "latest" or "range" mode, we might have one row per entity
        // For "all" mode, we may have multiple dates

        if (dateMode === "latest") {
          const row: Record<string, unknown> = { placeDcid: entityDcid, placeName: entityDcid };
          for (const v of selectedVars) {
            const obs = varMap[v.dcid]?.[0];
            row[`Date:${v.label}`] = obs?.date || "";
            row[`Value:${v.label}`] = obs?.value ?? "";
          }
          rows.push(row);
        } else {
          // Collect all unique dates across all variables for this entity
          const allDates = new Set<string>();
          for (const v of selectedVars) {
            for (const obs of varMap[v.dcid] || []) {
              allDates.add(obs.date);
            }
          }
          const sortedDates = Array.from(allDates).sort();
          for (const date of sortedDates) {
            const row: Record<string, unknown> = { placeDcid: entityDcid, placeName: entityDcid, date };
            for (const v of selectedVars) {
              const match = varMap[v.dcid]?.find((o) => o.date === date);
              row[`Value:${v.label}`] = match?.value ?? "";
            }
            rows.push(row);
          }
        }
      }

      setPreviewData(rows as any);
    } catch (err: any) {
      setErrorMsg(err.message || "Unexpected error fetching data.");
    }
    setLoading(false);
  }, [selectedPlace, geoLevel, dateMode, dateFrom, dateTo, selectedVars]);

  /* ─── CSV download ─── */
  const downloadCSV = useCallback(() => {
    if (!previewData || previewData.length === 0) return;
    const headers = Object.keys(previewData[0]);
    const csvRows = [
      headers.join(","),
      ...previewData.map((row) =>
        headers.map((h) => {
          const val = String((row as any)[h] ?? "");
          return val.includes(",") ? `"${val}"` : val;
        }).join(",")
      ),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ndip-data-${selectedPlace?.name || "export"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [previewData, selectedPlace]);

  /* ─── Filtered variable tree ─── */
  const filterLower = varFilter.toLowerCase();
  const filteredTree = VARIABLE_TREE.map((g) => ({
    ...g,
    children: g.children.filter((v) =>
      !filterLower || v.label.toLowerCase().includes(filterLower) || v.dcid.toLowerCase().includes(filterLower)
    ),
  })).filter((g) => g.children.length > 0);

  const canPreview = !!selectedPlace && selectedVars.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 flex items-center h-14 gap-3">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-serif text-foreground text-lg hidden md:inline">
              Nigeria Data Intelligence Platform
            </span>
            <span className="font-serif text-foreground text-sm md:hidden">NDIP</span>
          </Link>
          <div className="flex-1" />
          <Link
            to="/"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Search
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-2xl font-serif font-bold text-foreground mb-2">Data Download Tool</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Download statistical data as CSV. Select a location, pick up to 5 variables, choose your date range, and preview or download.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* ─── Left: Variable tree ─── */}
          <aside className="border border-border rounded-xl bg-card p-4 h-fit lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Statistical Variables
            </h2>
            <input
              type="text"
              value={varFilter}
              onChange={(e) => setVarFilter(e.target.value)}
              placeholder="Filter variables…"
              className="w-full h-8 px-3 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all mb-3"
            />
            <div className="space-y-1">
              {filteredTree.map((group) => {
                const isExpanded = expandedGroups.includes(group.label) || !!filterLower;
                return (
                  <div key={group.label}>
                    <button
                      onClick={() => toggleGroup(group.label)}
                      className="flex items-center gap-1.5 w-full text-left py-1.5 px-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      )}
                      {group.label}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        ({group.children.length})
                      </span>
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          <div className="ml-4 space-y-0.5 pb-1">
                            {group.children.map((v) => {
                              const isSelected = selectedVars.some((s) => s.dcid === v.dcid);
                              const atLimit = selectedVars.length >= 5 && !isSelected;
                              return (
                                <button
                                  key={v.dcid}
                                  onClick={() => toggleVar(v)}
                                  disabled={atLimit}
                                  className={`flex items-center gap-2 w-full text-left py-1 px-2 rounded text-xs transition-colors ${
                                    isSelected
                                      ? "bg-primary/10 text-primary font-medium"
                                      : atLimit
                                      ? "text-muted-foreground/50 cursor-not-allowed"
                                      : "text-foreground hover:bg-muted/40"
                                  }`}
                                >
                                  <div
                                    className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                      isSelected
                                        ? "bg-primary border-primary"
                                        : "border-border"
                                    }`}
                                  >
                                    {isSelected && (
                                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                        <path d="M1.5 4L3.2 5.7L6.5 2.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground" />
                                      </svg>
                                    )}
                                  </div>
                                  {v.label}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* ─── Right: Form + Preview ─── */}
          <div className="space-y-6">
            {/* Location */}
            <div className="border border-border rounded-xl bg-card p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Location</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={placeQuery}
                    onChange={(e) => setPlaceQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchPlace()}
                    placeholder="Enter a country, state, county, or city…"
                    className="flex-1 h-10 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                  <button
                    onClick={searchPlace}
                    disabled={searchingPlace || !placeQuery.trim()}
                    className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {searchingPlace ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                </div>

                {/* Search results dropdown */}
                {placeResults.length > 0 && !selectedPlace && (
                  <div className="mt-2 border border-border rounded-lg bg-popover shadow-md max-h-48 overflow-y-auto">
                    {placeResults.map((p) => (
                      <button
                        key={p.dcid}
                        onClick={() => {
                          setSelectedPlace(p);
                          setPlaceResults([]);
                          setPlaceQuery(p.name);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors border-b border-border last:border-0"
                      >
                        <span className="font-medium">{p.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">({p.dcid})</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected place chip */}
                {selectedPlace && (
                  <div className="mt-2 inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full">
                    {selectedPlace.name} ({selectedPlace.dcid})
                    <button
                      onClick={() => {
                        setSelectedPlace(null);
                        setPlaceQuery("");
                        setPreviewData(null);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Breakdown */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  Breakdown by
                </label>
                <select
                  value={geoLevel}
                  onChange={(e) => setGeoLevel(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                >
                  <option value="">No breakdown (place itself)</option>
                  {GEO_LEVELS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Date</label>
                <div className="flex flex-wrap gap-3 items-center">
                  {(["latest", "all", "range"] as DateMode[]).map((mode) => (
                    <label key={mode} className="inline-flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
                      <input
                        type="radio"
                        name="dateMode"
                        checked={dateMode === mode}
                        onChange={() => setDateMode(mode)}
                        className="accent-primary"
                      />
                      {mode === "latest" ? "Latest Date" : mode === "all" ? "All Available Dates" : "Date Range"}
                    </label>
                  ))}
                </div>
                {dateMode === "range" && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      placeholder="YYYY or YYYY-MM"
                      className="h-9 px-3 w-40 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <input
                      type="text"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      placeholder="YYYY or YYYY-MM"
                      className="h-9 px-3 w-40 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>
                )}
              </div>

              {/* Selected variables summary */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  Variables ({selectedVars.length}/5)
                </label>
                {selectedVars.length === 0 ? (
                  <p className="text-xs text-muted-foreground">← Select variables from the left panel</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedVars.map((v) => (
                      <span
                        key={v.dcid}
                        className="inline-flex items-center gap-1 bg-accent/10 text-accent text-xs px-2.5 py-1 rounded-full"
                      >
                        {v.label}
                        <button onClick={() => removeVar(v.dcid)} className="hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview button */}
              <div className="flex gap-3">
                <button
                  onClick={fetchData}
                  disabled={!canPreview || loading}
                  className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Preview
                </button>
                {previewData && previewData.length > 0 && (
                  <button
                    onClick={downloadCSV}
                    className="h-10 px-5 rounded-lg border border-primary text-primary text-sm font-medium hover:bg-primary/10 transition-colors flex items-center gap-1.5"
                  >
                    <DownloadIcon className="w-4 h-4" />
                    Download CSV
                  </button>
                )}
              </div>
            </div>

            {/* Error */}
            {errorMsg && (
              <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-4 text-sm text-destructive">
                {errorMsg}
              </div>
            )}

            {/* Preview table */}
            {previewData && previewData.length > 0 && (
              <div className="border border-border rounded-xl bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <h3 className="text-sm font-medium text-foreground">
                    Preview ({previewData.length} rows)
                  </h3>
                  <button
                    onClick={downloadCSV}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <DownloadIcon className="w-3 h-3" />
                    Download CSV
                  </button>
                </div>
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        {Object.keys(previewData[0]).map((h) => (
                          <th key={h} className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.slice(0, 100).map((row, i) => (
                        <tr key={i} className="border-t border-border hover:bg-muted/20 transition-colors">
                          {Object.keys(previewData[0]).map((h) => (
                            <td key={h} className="px-3 py-1.5 text-foreground whitespace-nowrap">
                              {String((row as any)[h] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {previewData.length > 100 && (
                  <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
                    Showing first 100 of {previewData.length} rows. Download CSV for full data.
                  </div>
                )}
              </div>
            )}

            {previewData && previewData.length === 0 && !loading && (
              <div className="border border-border rounded-xl bg-card p-8 text-center">
                <Info className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No data found for the selected combination.</p>
              </div>
            )}

            {/* Instructions */}
            {!previewData && !loading && (
              <div className="border border-border rounded-xl bg-card p-6 text-sm text-muted-foreground space-y-3">
                <h3 className="font-medium text-foreground">How to use</h3>
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>Enter a place in the search box (e.g. "Nigeria", "Lagos") and select it from results.</li>
                  <li>Optionally choose a geographic breakdown level (e.g. States within Nigeria).</li>
                  <li>Pick up to 5 statistical variables from the left panel.</li>
                  <li>Choose your date preference: latest, all available, or a custom range.</li>
                  <li>Click <strong>Preview</strong> to see the data, then <strong>Download CSV</strong> to export.</li>
                </ol>
                <p className="text-xs">
                  Data is sourced from open public datasets. Each row represents a place and date combination.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
