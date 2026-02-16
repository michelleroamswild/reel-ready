import { useState, useEffect } from "react";
import { supabase, getCurrentUserId } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PencilSimple,
  Sparkle,
  LinkSimple,
  CircleNotch,
  Check,
  MusicNote,
} from "@phosphor-icons/react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddTrendingAudioDialog({ open, onOpenChange, onSuccess }: Props) {
  const [activeTab, setActiveTab] = useState("manual");

  // Manual tab
  const [manualTitle, setManualTitle] = useState("");
  const [manualArtist, setManualArtist] = useState("");
  const [manualPlatform, setManualPlatform] = useState("tiktok");
  const [manualGenre, setManualGenre] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualDone, setManualDone] = useState(false);

  // AI Research tab
  const [niche, setNiche] = useState("");
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchCount, setResearchCount] = useState<number | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);

  // URL Extract tab
  const [extractUrl, setExtractUrl] = useState("");
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractResult, setExtractResult] = useState<{
    title: string;
    artist: string;
    genre: string;
    mood: string;
    confidence: string;
  } | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setManualTitle("");
      setManualArtist("");
      setManualPlatform("tiktok");
      setManualGenre("");
      setManualUrl("");
      setManualLoading(false);
      setManualError(null);
      setManualDone(false);
      setNiche("");
      setResearchLoading(false);
      setResearchCount(null);
      setResearchError(null);
      setExtractUrl("");
      setExtractLoading(false);
      setExtractResult(null);
      setExtractError(null);
    }
  }, [open]);

  const handleManualAdd = async () => {
    if (!manualTitle.trim()) return;
    setManualLoading(true);
    setManualError(null);
    try {
      const user_id = await getCurrentUserId();
      const { error } = await supabase.from("trending_audio").insert({
        title: manualTitle.trim(),
        artist: manualArtist.trim() || null,
        platform: manualPlatform,
        genre: manualGenre.trim() || null,
        external_url: manualUrl.trim() || null,
        source: "manual",
        user_id,
      });
      if (error) throw error;
      setManualDone(true);
      onSuccess();
      setTimeout(() => onOpenChange(false), 800);
    } catch (err) {
      setManualError(err instanceof Error ? err.message : "Failed to add track");
    } finally {
      setManualLoading(false);
    }
  };

  const handleResearch = async () => {
    if (!niche.trim()) return;
    setResearchLoading(true);
    setResearchError(null);
    setResearchCount(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "research-trending-audio",
        { body: { niche: niche.trim() } }
      );
      if (error) throw error;
      let parsed = data;
      if (typeof data === "string") parsed = JSON.parse(data);
      if (parsed.error) throw new Error(parsed.error);
      setResearchCount(parsed.count ?? 0);
      onSuccess();
    } catch (err) {
      setResearchError(
        err instanceof Error ? err.message : "Research failed"
      );
    } finally {
      setResearchLoading(false);
    }
  };

  const handleExtract = async () => {
    if (!extractUrl.trim()) return;
    setExtractLoading(true);
    setExtractError(null);
    setExtractResult(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "extract-audio-from-url",
        { body: { videoUrl: extractUrl.trim() } }
      );
      if (error) throw error;
      let parsed = data;
      if (typeof data === "string") parsed = JSON.parse(data);
      if (parsed.error) throw new Error(parsed.error);
      setExtractResult(parsed.track);
      onSuccess();
    } catch (err) {
      setExtractError(
        err instanceof Error ? err.message : "Extraction failed"
      );
    } finally {
      setExtractLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Trending Audio</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="manual" className="flex-1 text-xs">
              <PencilSimple className="h-3.5 w-3.5 mr-1" />
              Manual
            </TabsTrigger>
            <TabsTrigger value="research" className="flex-1 text-xs">
              <Sparkle className="h-3.5 w-3.5 mr-1" />
              AI Research
            </TabsTrigger>
            <TabsTrigger value="extract" className="flex-1 text-xs">
              <LinkSimple className="h-3.5 w-3.5 mr-1" />
              From URL
            </TabsTrigger>
          </TabsList>

          {/* Manual Tab */}
          <TabsContent value="manual" className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Title *</Label>
              <Input
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="Song title"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Artist</Label>
              <Input
                value={manualArtist}
                onChange={(e) => setManualArtist(e.target.value)}
                placeholder="Artist name"
                className="h-8 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Platform</Label>
                <Select value={manualPlatform} onValueChange={setManualPlatform}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Genre</Label>
                <Input
                  value={manualGenre}
                  onChange={(e) => setManualGenre(e.target.value)}
                  placeholder="e.g. pop, lo-fi"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">URL</Label>
              <Input
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="Link to the sound (optional)"
                className="h-8 text-sm"
              />
            </div>

            {manualError && (
              <p className="text-xs text-destructive">{manualError}</p>
            )}

            <Button
              className="w-full"
              size="sm"
              disabled={!manualTitle.trim() || manualLoading || manualDone}
              onClick={handleManualAdd}
            >
              {manualDone ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Added
                </>
              ) : manualLoading ? (
                <>
                  <CircleNotch className="h-4 w-4 mr-1 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Track"
              )}
            </Button>
          </TabsContent>

          {/* AI Research Tab */}
          <TabsContent value="research" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Enter a niche or content topic and AI will suggest trending audio
              tracks that work well for that type of content.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Niche / Topic</Label>
              <Input
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. fitness reels, cooking content, aesthetic lifestyle"
                className="h-8 text-sm"
              />
            </div>

            {researchError && (
              <p className="text-xs text-destructive">{researchError}</p>
            )}

            {researchCount !== null && (
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <MusicNote className="h-5 w-5 mx-auto text-primary mb-1" weight="fill" />
                <p className="text-sm font-medium">
                  Added {researchCount} tracks
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  for "{niche}"
                </p>
              </div>
            )}

            <Button
              className="w-full"
              size="sm"
              disabled={!niche.trim() || researchLoading}
              onClick={handleResearch}
            >
              {researchLoading ? (
                <>
                  <CircleNotch className="h-4 w-4 mr-1 animate-spin" />
                  Researching...
                </>
              ) : (
                <>
                  <Sparkle className="h-4 w-4 mr-1" />
                  Research Trends
                </>
              )}
            </Button>
          </TabsContent>

          {/* URL Extract Tab */}
          <TabsContent value="extract" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Paste a TikTok or Instagram Reel URL and AI will identify the
              audio track used in the video.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Video URL</Label>
              <Input
                value={extractUrl}
                onChange={(e) => {
                  setExtractUrl(e.target.value);
                  setExtractError(null);
                }}
                placeholder="https://www.tiktok.com/..."
                className="h-8 text-sm"
              />
            </div>

            {extractError && (
              <p className="text-xs text-destructive">{extractError}</p>
            )}

            {extractResult && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                <p className="text-sm font-medium">{extractResult.title}</p>
                {extractResult.artist && extractResult.artist !== "Unknown" && (
                  <p className="text-xs text-muted-foreground">
                    {extractResult.artist}
                  </p>
                )}
                <div className="flex flex-wrap gap-1">
                  {extractResult.genre && (
                    <Badge variant="secondary" className="text-[10px]">
                      {extractResult.genre}
                    </Badge>
                  )}
                  {extractResult.mood && (
                    <Badge variant="secondary" className="text-[10px]">
                      {extractResult.mood}
                    </Badge>
                  )}
                  {extractResult.confidence && (
                    <Badge
                      variant={
                        extractResult.confidence === "high"
                          ? "default"
                          : "outline"
                      }
                      className="text-[10px]"
                    >
                      {extractResult.confidence} confidence
                    </Badge>
                  )}
                </div>
              </div>
            )}

            <Button
              className="w-full"
              size="sm"
              disabled={!extractUrl.trim() || extractLoading}
              onClick={handleExtract}
            >
              {extractLoading ? (
                <>
                  <CircleNotch className="h-4 w-4 mr-1 animate-spin" />
                  Analyzing video...
                </>
              ) : (
                <>
                  <LinkSimple className="h-4 w-4 mr-1" />
                  Extract Audio
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
