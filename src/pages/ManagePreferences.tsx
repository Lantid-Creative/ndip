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
  { id: "sustainability", label: "Sustainability", description: "CO₂ emissions, renewables, climate" },
  { id: "infrastructure", label: "Infrastructure", description: "Energy, internet, transportation" },
  { id: "governance", label: "Governance", description: "Corruption index, policy, institutions" },
  { id: "technology", label: "Technology", description: "Tech adoption, digital economy, startups" },
  { id: "security", label: "Security", description: "Crime rates, conflict, safety indices" },
];

const KNOWN_TOPIC_IDS = ALL_TOPICS.map(t => t.id);

const TIME_OPTIONS = [
  { value: 6, label: "6:00 AM" },
  { value: 7, label: "7:00 AM" },
  { value: 8, label: "8:00 AM" },
  { value: 9, label: "9:00 AM" },
  { value: 12, label: "12:00 PM" },
  { value: 18, label: "6:00 PM" },
  { value: 21, label: "9:00 PM" },
];

export default function ManagePreferences() {
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const [email, setEmail] = useState(emailParam);
  const [subscriberId, setSubscriberId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredHour, setPreferredHour] = useState(7);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [customTopicInput, setCustomTopicInput] = useState("");
  const [savedState, setSavedState] = useState({ topics: [] as string[], customTopics: [] as string[], firstName: "", lastName: "", preferredHour: 7 });
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const loadPreferences = async (emailToLoad: string) => {
    setStatus("loading");
    setErrorMsg("");

    const { data: subs, error: subErr } = await supabase
      .from("subscribers")
      .select("id, first_name, last_name, preferred_hour")
      .eq("email", emailToLoad.trim().toLowerCase())
      .eq("is_active", true);

    if (subErr || !subs?.length) {
      setStatus("error");
      setErrorMsg("No active subscription found for this email.");
      return;
    }

    const sub = subs[0];
    setSubscriberId(sub.id);
    setFirstName(sub.first_name || "");
    setLastName(sub.last_name || "");
    setPreferredHour(sub.preferred_hour ?? 7);

    const { data: prefs } = await supabase
      .from("subscriber_preferences")
      .select("topic")
      .eq("subscriber_id", sub.id)
      .eq("is_active", true);

    const allTopicIds = (prefs || []).map((p: any) => p.topic);
    const known = allTopicIds.filter((t: string) => KNOWN_TOPIC_IDS.includes(t));
    const custom = allTopicIds.filter((t: string) => !KNOWN_TOPIC_IDS.includes(t));

    setSelectedTopics(known);
    setCustomTopics(custom);
    setSavedState({
      topics: known,
      customTopics: custom,
      firstName: sub.first_name || "",
      lastName: sub.last_name || "",
      preferredHour: sub.preferred_hour ?? 7,
    });
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

  const addCustomTopic = () => {
    const trimmed = customTopicInput.trim().toLowerCase();
    if (trimmed && !customTopics.includes(trimmed) && !KNOWN_TOPIC_IDS.includes(trimmed)) {
      setCustomTopics(prev => [...prev, trimmed]);
      setCustomTopicInput("");
    }
  };

  const removeCustomTopic = (topic: string) => {
    setCustomTopics(prev => prev.filter(t => t !== topic));
  };

  const allCurrentTopics = [...selectedTopics, ...customTopics];
  const allSavedTopics = [...savedState.topics, ...savedState.customTopics];

  const hasChanges =
    JSON.stringify([...allCurrentTopics].sort()) !== JSON.stringify([...allSavedTopics].sort()) ||
    firstName !== savedState.firstName ||
    lastName !== savedState.lastName ||
    preferredHour !== savedState.preferredHour;

  const savePreferences = async () => {
    if (!subscriberId) return;
    setStatus("saving");

    // Update subscriber profile
    await supabase
      .from("subscribers")
      .update({ first_name: firstName.trim(), last_name: lastName.trim(), preferred_hour: preferredHour })
      .eq("id", subscriberId);

    // Sync topics
    const toRemove = allSavedTopics.filter(t => !allCurrentTopics.includes(t));
    const toAdd = allCurrentTopics.filter(t => !allSavedTopics.includes(t));

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

    setSavedState({
      topics: [...selectedTopics],
      customTopics: [...customTopics],
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      preferredHour,
    });
    setStatus("saved");
    setTimeout(() => setStatus("loaded"), 2000);
  };

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
              <span className="text-primary-foreground font-bold text-[8px]">NDIP</span>
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
            Update your name, topics, and delivery time for your daily intelligence report.
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

            {/* Name fields */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">First name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="w-full h-10 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="w-full h-10 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
            </div>

            {/* Time preference */}
            <div className="mb-6">
              <label className="text-xs text-muted-foreground mb-2 block">Preferred delivery time (WAT)</label>
              <div className="flex flex-wrap gap-2">
                {TIME_OPTIONS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setPreferredHour(t.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      preferredHour === t.value
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Standard topics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
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

            {/* Custom topics */}
            <div className="mb-8">
              <label className="text-xs text-muted-foreground mb-2 block">Custom topics</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={customTopicInput}
                  onChange={(e) => setCustomTopicInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTopic())}
                  placeholder="e.g. fintech, oil prices, diaspora"
                  className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={addCustomTopic}
                  disabled={!customTopicInput.trim()}
                  className="h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-40 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              {customTopics.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {customTopics.map((ct) => (
                    <span key={ct} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full">
                      {ct}
                      <button onClick={() => removeCustomTopic(ct)} className="hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {allCurrentTopics.length} topic{allCurrentTopics.length !== 1 ? "s" : ""} selected
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
