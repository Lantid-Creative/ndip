const HeroSection = () => {
  return (
    <section className="relative pt-24 pb-12 overflow-hidden">
      <div className="absolute inset-0 gradient-hero opacity-[0.07]" />
      <div className="container mx-auto px-4 relative">
        <div className="max-w-3xl mx-auto text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-light text-primary text-xs font-semibold mb-6 tracking-wide uppercase">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse-gold" />
            Live Data from Data Commons
          </div>
          
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-foreground leading-tight mb-4 text-balance">
            Nigeria's Data,<br />
            <span className="text-primary">Made Actionable</span>
          </h1>
          
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-8">
            Explore demographics, economy, health, education, climate and more — 
            powered by Google's Data Commons knowledge graph.
          </p>

          <div className="flex items-center gap-3 justify-center text-xs text-muted-foreground">
            <span>Sources: World Bank</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>UN</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>WHO</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>Nigeria Bureau of Statistics</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
