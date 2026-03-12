import { useState, useRef } from "react";
import { Search, ArrowRight, Mail, Loader2, CheckCircle, Check, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import NLSearchPanel from "@/components/NLSearchPanel";

const NEWSLETTER_TOPICS = [
  { id: "economics", label: "Economics", description: "GDP, trade, inflation" },
  { id: "demographics", label: "Demographics", description: "Population, migration" },
  { id: "health", label: "Health", description: "Life expectancy, healthcare" },
  { id: "education", label: "Education", description: "Literacy, enrollment" },
  { id: "agriculture", label: "Agriculture", description: "Crops, food security" },
  { id: "sustainability", label: "Sustainability", description: "CO2, renewables, climate" },
  { id: "infrastructure", label: "Infrastructure", description: "Energy, internet" },
  { id: "governance", label: "Governance", description: "Corruption, institutions" },
  { id: "technology", label: "Technology", description: "Digital economy, startups" },
  { id: "security", label: "Security", description: "Crime, conflict, safety" },
];

const TOPICS = [
  { label: "Economics", query: "Economy in Nigeria" },
  { label: "Demographics", query: "Demographics of Nigeria" },
  { label: "Health", query: "Health in Nigeria" },
  { label: "Sustainability", query: "Sustainability in Nigeria" },
  { label: "Education", query: "Education in Nigeria" },
  { label: "Agriculture", query: "Agriculture in Nigeria" },
];

const SAMPLE_QUESTIONS = [
  { question: "What is the life expectancy in Nigeria?", category: "Health" },
  { question: "Tell me about the economy in Nigeria.", category: "Economics" },
  { question: "What are the CO2 emissions per capita in Nigeria?", category: "Sustainability" },
  { question: "What is the fertility rate in Nigeria?", category: "Demographics" },
  { question: "What is the unemployment rate in Nigeria?", category: "Economics" },
  { question: "What is the population of Nigeria?", category: "Demographics" },
];

const CATEGORY_COLORS: Record<string, string> = {
  Health: "text-blue-700 dark:text-blue-400",
  Economics: "text-green-700 dark:text-green-400",
  Sustainability: "text-emerald-700 dark:text-emerald-400",
  Demographics: "text-orange-700 dark:text-orange-400",
};

function SubscribeSection() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    setErrorMsg("");

    const { error } = await supabase.from('subscribers').insert({ email: email.trim().toLowerCase() });

    if (error) {
      if (error.code === '23505') {
        setStatus('success'); // already subscribed, treat as success
      } else {
        setStatus('error');
        setErrorMsg("Something went wrong. Please try again.");
      }
    } else {
      setStatus('success');
    }
  };

  return (
    <section className="bg-primary/5 py-12 md:py-16">
      <div className="container mx-auto px-4 max-w-xl text-center">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Mail className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Daily Intelligence Report</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Get key Nigeria indicators delivered to your inbox every morning — population, GDP, health metrics, and more.
        </p>

        {status === 'success' ? (
          <div className="flex items-center justify-center gap-2 text-primary text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            You're subscribed! Reports will arrive once email delivery is configured.
          </div>
        ) : (
          <form onSubmit={handleSubscribe} className="flex gap-2 max-w-md mx-auto">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="flex-1 h-10 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {status === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Subscribe
            </button>
          </form>
        )}
        {errorMsg && <p className="text-destructive text-xs mt-2">{errorMsg}</p>}
      </div>
    </section>
  );
}

const Index = () => {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setSubmittedQuery(trimmed);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="container mx-auto px-4 flex items-center h-14 gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-[10px]">NIP</span>
            </div>
            <span className="font-serif text-lg text-foreground">Nigeria Intelligence Platform</span>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter a question to explore"
                className="w-full pl-10 pr-10 h-10 rounded-full border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              {query.trim() && (
                <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-primary hover:text-primary/80">
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
        </div>
      </nav>

      {/* Hero + Topics (only shown when no results) */}
      {!submittedQuery && (
        <>
          <section className="bg-muted/40 py-16 md:py-24">
            <div className="container mx-auto px-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
                <h1 className="text-3xl md:text-4xl lg:text-[2.75rem] text-foreground leading-tight font-normal">
                  Nigeria Intelligence Platform brings together Nigeria's public data, making it simple to explore
                </h1>
                <div>
                  <h2 className="text-base font-semibold text-foreground mb-4">Topics to explore</h2>
                  <div className="flex flex-wrap gap-2.5">
                    {TOPICS.map((t) => (
                      <button
                        key={t.label}
                        onClick={() => handleSearch(t.query)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-border bg-background text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Sample Questions */}
          <section className="py-12 md:py-16">
            <div className="container mx-auto px-4">
              <h2 className="text-lg font-semibold text-foreground mb-6">Sample questions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {SAMPLE_QUESTIONS.map((sq) => (
                  <button
                    key={sq.question}
                    onClick={() => handleSearch(sq.question)}
                    className="text-left p-5 rounded-xl border border-border bg-card hover:shadow-md transition-shadow group"
                  >
                    <p className={`text-base font-medium leading-snug mb-4 ${CATEGORY_COLORS[sq.category] || "text-primary"}`}>
                      {sq.question}
                    </p>
                    <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                      {sq.category}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Subscribe Section */}
          <SubscribeSection />

          {/* Footer sources */}
          <section className="border-t border-border py-8">
            <div className="container mx-auto px-4 flex items-center gap-3 justify-center text-xs text-muted-foreground">
              <span>Sources: World Bank</span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span>UN</span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span>WHO</span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span>Nigeria Bureau of Statistics</span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span>Google Data Commons</span>
            </div>
          </section>
        </>
      )}

      {/* Search Results */}
      {submittedQuery && (
        <main ref={resultsRef} className="container mx-auto px-4 py-8">
          <NLSearchPanel initialQuery={submittedQuery} onQueryChange={setSubmittedQuery} />
        </main>
      )}
    </div>
  );
};

export default Index;
