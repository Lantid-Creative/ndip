import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Loader2, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"confirm" | "loading" | "done" | "error">("confirm");
  const [errorMsg, setErrorMsg] = useState("");

  const handleUnsubscribe = async () => {
    if (!email) {
      setStatus("error");
      setErrorMsg("No email address provided.");
      return;
    }
    setStatus("loading");

    const { data: subs, error: subErr } = await supabase
      .from("subscribers")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .eq("is_active", true);

    if (subErr || !subs?.length) {
      setStatus("error");
      setErrorMsg("No active subscription found for this email.");
      return;
    }

    const { error: updateErr } = await supabase
      .from("subscribers")
      .update({ is_active: false, unsubscribed_at: new Date().toISOString() })
      .eq("id", subs[0].id);

    if (updateErr) {
      setStatus("error");
      setErrorMsg("Something went wrong. Please try again.");
      return;
    }

    setStatus("done");
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
            <span className="font-serif text-lg text-foreground">Unsubscribe</span>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-16 max-w-md">
        <div className="text-center">
          {status === "confirm" && (
            <>
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
                <Mail className="w-7 h-7 text-destructive" />
              </div>
              <h1 className="text-2xl font-semibold text-foreground mb-2">Unsubscribe</h1>
              <p className="text-sm text-muted-foreground mb-2">
                Are you sure you want to unsubscribe?
              </p>
              {email && (
                <p className="text-sm text-foreground font-medium mb-6">{email}</p>
              )}
              <p className="text-xs text-muted-foreground mb-8">
                You'll stop receiving daily intelligence reports. You can always resubscribe later.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleUnsubscribe}
                  className="h-11 px-6 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
                >
                  Yes, Unsubscribe
                </button>
                <a
                  href={`/manage-preferences?email=${encodeURIComponent(email)}`}
                  className="h-11 px-6 rounded-lg border border-border bg-card text-foreground text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center"
                >
                  Manage Preferences Instead
                </a>
              </div>
            </>
          )}

          {status === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Processing...</p>
            </div>
          )}

          {status === "done" && (
            <>
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-7 h-7 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold text-foreground mb-2">You've been unsubscribed</h1>
              <p className="text-sm text-muted-foreground mb-6">
                You will no longer receive daily reports at <span className="font-medium text-foreground">{email}</span>.
              </p>
              <p className="text-xs text-muted-foreground mb-8">
                Changed your mind? You can resubscribe anytime from the homepage.
              </p>
              <a
                href="/"
                className="inline-flex h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors items-center"
              >
                Go to NDIP
              </a>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-7 h-7 text-destructive" />
              </div>
              <h1 className="text-2xl font-semibold text-foreground mb-2">Something went wrong</h1>
              <p className="text-sm text-destructive mb-6">{errorMsg}</p>
              <a
                href="/"
                className="inline-flex h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors items-center"
              >
                Go to NDIP
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
