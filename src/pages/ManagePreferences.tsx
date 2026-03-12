import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Check, Loader2, Plus, X, ArrowLeft } from "lucide-react";

const ALL_TOPICS = [
  { id: "economics", label: "Economics", description: "GDP, trade, inflation, fiscal policy" },
  { id: "demographics", label: "Demographics", description: "Population, migration, urbanization" },
  { id: "health", label: "Health", description: "Life expectancy, disease, healthcare access" },
  { id: "education", label: "Education", description: "Literacy, enrollment, school infrastructure" },
  { id: "agriculture", label: "Agriculture", description: "Crop production, food security, exports" },
  { id: "sustainability", label: "Sustainability", description: "CO2 emissions, renewables, climate" },
  { id: "infrastructure", label: "Infrastructure", description: "Energy, internet, transportation" },
  { id: "governance", label: "Governance", description: "Corruption index, policy, institutions" },
  { id: "technology", label: "Technology", description: "Tech adoption, digital economy, startups" },
  { id: "security", label: "Security", description: "Crime rates, conflict, safety indices" },
];

export default function ManagePreferences() {
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const [email, setEmail] = useState(emailParam);
  const [subscriberId, setSubscriberId] = useState<string | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [savedTopics, setSavedTopics] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const loadPreferences = async (emailToLoad: string) => {
    setStatus("loading");
    setErrorMsg("");

    // Find subscriber
    const { data: subs, error: subErr } = await supabase
      .from("subscribers")
      .select("id")
      .eq("email", emailToLoad.trim().toLowerCase())
      .eq("is_active", true);

    if (subErr || !subs?.length) {
      setStatus("error");
      setErrorMsg("No active subscription found for this email.");
      return;
    }

    setSubscriberId(subs[0].id);

    // Load preferences
    const { data: prefs } = await supabase
      .from("subscriber_preferences")
      .select("topic")
      .eq("subscriber_id", subs[0].id)
      .eq("is_active", true);

    const topics = (prefs || []).map((p: any) => p.topic);
    setSelectedTopics(topics);
    setSavedTopics(topics);
    setStatus("loaded");
  };

  useEffect(() => {
    if (emailParam) loadPreferences(emailParam);
  }, [emailParam]);

  const toggleTopic = (topicId: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topicId) ? prev.filter((t) => t !== topicId) : [...prev, topicId]
    );
  };

  const savePreferences = async () => {
    if (!subscriberId) return;
    setStatus("saving");

    // Remove deselected topics
    const toRemove = savedTopics.filter((t) => !selectedTopics.includes(t));
    const toAdd = selectedTopics.filter((t) => !savedTopics.includes(t));

    for (const topic of toRemove) {
      await supabase
        .from("subscriber_preferences")
        .delete()
        .eq("subscriber_id", subscriberId)
        .eq("topic", topic);
    }

    if (toAdd.length > 0) {
      await supabase.from("subscriber_preferences").insert(
        toAdd.map((topic) => ({ subscriber_id: subscriberId, topic }))
      );
    }

    setSavedTopics([...selectedTopics]);
    setStatus("saved");
    setTimeout(() => setStatus("loaded"), 2000);
  };

  const hasChanges = JSON.stringify([...selectedTopics].sort()) !== JSON.stringify([...savedTopics].sort());

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="container mx-auto px-4 flex items-center h-14 gap-4">
          <a href="/" className="flex items-center gap-2 shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </a>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-[10px]">NIP</span>
            </div>
            <span className="font-serif text-lg text-foreground">Manage Newsletter</span>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">Newsletter Preferences</h1>
          <p className="text-sm text-muted-foreground">
            Choose the topics you want in your daily intelligence report.
          </p>
        </div>

        {status === "idle" && !emailParam && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) loadPreferences(email);
            }}
            className="flex gap-2 max-w-md mx-auto"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your subscribed email"
              className="flex-1 h-10 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            <button
              type="submit"
              className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Load
            </button>
          </form>
        )}

        {status === "loading" && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground py-8">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading preferences...
          </div>
        )}

        {status === "error" && (
          <div className="text-center py-8">
            <p className="text-destructive text-sm mb-4">{errorMsg}</p>
            <button
              onClick={() => setStatus("idle")}
              className="text-sm text-primary hover:underline"
            >
              Try another email
            </button>
          </div>
        )}

        {(status === "loaded" || status === "saving" || status === "saved") && (
          <>
            <p className="text-xs text-muted-foreground text-center mb-6">
              Managing preferences for <span className="font-medium text-foreground">{email}</span>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {ALL_TOPICS.map((topic) => {
                const isSelected = selectedTopics.includes(topic.id);
                return (
                  <button
                    key={topic.id}
                    onClick={() => toggleTopic(topic.id)}
                    className={`relative text-left p-4 rounded-xl border transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-card hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{topic.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{topic.description}</p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          isSelected ? "bg-primary text-primary-foreground" : "border border-border"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {selectedTopics.length} topic{selectedTopics.length !== 1 ? "s" : ""} selected
              </p>
              <button
                onClick={savePreferences}
                disabled={!hasChanges || status === "saving"}
                className="h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {status === "saving" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {status === "saved" && <Check className="w-3.5 h-3.5" />}
                {status === "saved" ? "Saved!" : "Save Preferences"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
