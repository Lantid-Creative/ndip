import { useState, useCallback } from "react";
import { Share2, Link2, Download, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ShareExportProps {
  query: string;
}

export default function ShareExport({ query }: ShareExportProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/?q=${encodeURIComponent(query)}`;

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      await navigator.share({
        title: `NDIP: ${query}`,
        text: `Explore data about "${query}" on the Nigeria Data Intelligence Platform`,
        url: shareUrl,
      });
    } else {
      handleCopyLink();
    }
  }, [query, shareUrl, handleCopyLink]);

  const handleExportCharts = useCallback(() => {
    // Find all SVG charts on the page and export them
    const svgs = document.querySelectorAll('.recharts-responsive-container svg');
    if (svgs.length === 0) return;

    svgs.forEach((svg, i) => {
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      canvas.width = (svg as SVGElement).clientWidth * 2;
      canvas.height = (svg as SVGElement).clientHeight * 2;
      
      img.onload = () => {
        ctx?.scale(2, 2);
        ctx?.drawImage(img, 0, 0);
        const link = document.createElement('a');
        link.download = `ndip-chart-${i + 1}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    });
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
          <Share2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Share</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleCopyLink} className="gap-2 text-xs">
          {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Link2 className="w-3.5 h-3.5" />}
          {copied ? "Link copied!" : "Copy link"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleNativeShare} className="gap-2 text-xs">
          <Share2 className="w-3.5 h-3.5" />
          Share via...
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportCharts} className="gap-2 text-xs">
          <Download className="w-3.5 h-3.5" />
          Export charts as PNG
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
