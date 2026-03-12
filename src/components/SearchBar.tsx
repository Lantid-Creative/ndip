import { useState, useRef, useEffect, useCallback } from "react";
import { Search, ArrowRight, Clock, TrendingUp, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const POPULAR_QUERIES = [
  "What is the GDP of Nigeria?",
  "Population of Nigeria",
  "Life expectancy in Nigeria",
  "Unemployment rate in Nigeria",
  "CO2 emissions in Nigeria",
  "Infant mortality rate in Nigeria",
  "Fertility rate in Nigeria",
  "Literacy rate in Nigeria",
];

const STORAGE_KEY = "ndip-search-history";

function getHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]").slice(0, 8);
  } catch { return []; }
}

function addToHistory(q: string) {
  const history = getHistory().filter(h => h.toLowerCase() !== q.toLowerCase());
  history.unshift(q);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 8)));
}

function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  onSearch: (q: string) => void;
  variant?: "hero" | "nav";
  className?: string;
}

export default function SearchBar({ value, onChange, onSearch, variant = "nav", className = "" }: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHistory(getHistory());
  }, [focused]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearch = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    addToHistory(trimmed);
    onChange(trimmed);
    onSearch(trimmed);
    setFocused(false);
    inputRef.current?.blur();
  }, [onChange, onSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(value);
  };

  const handleClearHistory = () => {
    clearHistory();
    setHistory([]);
  };

  const showDropdown = focused && !value.trim();
  const filteredPopular = value.trim()
    ? POPULAR_QUERIES.filter(q => q.toLowerCase().includes(value.toLowerCase())).slice(0, 5)
    : [];
  const showSuggestions = focused && value.trim() && filteredPopular.length > 0;

  const isHero = variant === "hero";

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground ${isHero ? 'w-5 h-5' : 'w-4 h-4'}`} />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="Ask a question about Nigeria's data..."
            className={`w-full bg-card text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${
              isHero
                ? 'pl-12 pr-12 h-14 rounded-2xl text-base shadow-card'
                : 'pl-10 pr-10 h-10 rounded-full text-sm'
            }`}
          />
          {value.trim() && (
            <button type="submit" className={`absolute top-1/2 -translate-y-1/2 text-primary hover:text-primary/80 transition-colors ${isHero ? 'right-4' : 'right-3'}`}>
              <ArrowRight className={isHero ? 'w-5 h-5' : 'w-4 h-4'} />
            </button>
          )}
        </div>
      </form>

      {/* Dropdown */}
      <AnimatePresence>
        {(showDropdown || showSuggestions) && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full mt-2 w-full bg-popover border border-border rounded-xl shadow-elevated overflow-hidden"
          >
            {/* Filtered suggestions */}
            {showSuggestions && (
              <div className="p-2">
                {filteredPopular.map(q => (
                  <button
                    key={q}
                    onClick={() => handleSearch(q)}
                    className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span dangerouslySetInnerHTML={{
                      __html: q.replace(
                        new RegExp(`(${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                        '<mark class="bg-primary/15 text-primary font-medium rounded px-0.5">$1</mark>'
                      )
                    }} />
                  </button>
                ))}
              </div>
            )}

            {/* History + Popular when empty */}
            {showDropdown && (
              <div className="p-2">
                {history.length > 0 && (
                  <>
                    <div className="flex items-center justify-between px-3 py-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Recent</span>
                      <button onClick={handleClearHistory} className="text-[11px] text-muted-foreground hover:text-destructive transition-colors">
                        Clear
                      </button>
                    </div>
                    {history.map(q => (
                      <button
                        key={q}
                        onClick={() => handleSearch(q)}
                        className="flex items-center gap-3 w-full text-left px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{q}</span>
                      </button>
                    ))}
                    <div className="border-t border-border my-1.5" />
                  </>
                )}
                <div className="px-3 py-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Popular</span>
                </div>
                {POPULAR_QUERIES.slice(0, 5).map(q => (
                  <button
                    key={q}
                    onClick={() => handleSearch(q)}
                    className="flex items-center gap-3 w-full text-left px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                    {q}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
