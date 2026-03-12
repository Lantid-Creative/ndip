import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNLQuery } from "@/hooks/useDataCommons";

const EXAMPLE_QUERIES = [
  "What is Nigeria's population?",
  "Compare GDP of Nigeria and Ghana",
  "Life expectancy in Nigeria over time",
  "CO2 emissions per capita in Nigeria",
  "Unemployment rate in Nigeria vs Kenya",
];

const NLSearchPanel = () => {
  const [inputValue, setInputValue] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");

  const { data, isLoading, error } = useNLQuery(submittedQuery);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setSubmittedQuery(inputValue.trim());
    }
  };

  const handleExample = (q: string) => {
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
            onClick={() => handleExample(q)}
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

      {data && !isLoading && (
        <div className="bg-card rounded-xl p-6 shadow-card">
          <h3 className="font-serif text-lg mb-4 text-foreground">Results</h3>
          <pre className="text-sm text-muted-foreground overflow-auto max-h-96 bg-muted p-4 rounded-lg whitespace-pre-wrap">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default NLSearchPanel;
