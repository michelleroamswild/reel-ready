import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useAccountProfile } from "@/hooks/use-account-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SignOut,
  CircleNotch,
  CheckCircle,
  User,
  ChartBar,
  Sparkle,
  PencilSimple,
  UploadSimple,
} from "@phosphor-icons/react";
import { useToast } from "@/hooks/use-toast";
import { useVoiceProfile } from "@/hooks/use-voice-profile";
import { captionsFromExportFiles } from "@/lib/instagram-export";
import type { Platform, PerformanceTrend } from "@/types/posting-strategy";

export default function AccountPage() {
  const { user, signOut } = useAuth();
  const { profile, upsertProfile, isUpserting } = useAccountProfile();
  const {
    profile: voiceProfile,
    updatedAt: voiceUpdatedAt,
    buildProfile,
    isBuilding,
    updateProfileText,
    isUpdatingText,
  } = useVoiceProfile();
  const { toast } = useToast();

  const [editingVoice, setEditingVoice] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [importCaptions, setImportCaptions] = useState<string[]>([]);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const [platform, setPlatform] = useState<Platform>("instagram");
  const [postsPerWeek, setPostsPerWeek] = useState("");
  const [performanceTrend, setPerformanceTrend] =
    useState<PerformanceTrend>("stable");
  const [niche, setNiche] = useState("");
  const [metricsSaved, setMetricsSaved] = useState(false);

  // Populate form from saved profile
  useEffect(() => {
    if (profile) {
      setPlatform(profile.platform);
      setPostsPerWeek(String(profile.postsPerWeek));
      setPerformanceTrend(profile.performanceTrend);
      setNiche(profile.niche);
    }
  }, [profile]);

  const handleSaveMetrics = async () => {
    const ppw = parseFloat(postsPerWeek);
    if (isNaN(ppw)) return;

    await upsertProfile({
      platform,
      followerCount: 0,
      postsPerWeek: ppw,
      performanceTrend,
      niche: niche.trim(),
    });
    setMetricsSaved(true);
    toast({ title: "Account metrics saved" });
    setTimeout(() => setMetricsSaved(false), 2000);
  };

  const handleBuildVoice = async (captions?: string[]) => {
    try {
      await buildProfile(captions ? { captions } : undefined);
      setPasteOpen(false);
      setPasteText("");
      toast({ title: "Voice profile updated" });
    } catch (err) {
      toast({
        title: "Couldn't build voice profile",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  const handleSaveVoiceText = async () => {
    await updateProfileText(voiceText.trim());
    setEditingVoice(false);
    toast({ title: "Voice profile saved" });
  };

  const handleExportFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setImportStatus("Reading files…");
    setImportCaptions([]);
    try {
      const texts = await Promise.all(Array.from(files).map((f) => f.text()));
      const caps = captionsFromExportFiles(texts);
      setImportCaptions(caps);
      setImportStatus(
        caps.length
          ? `Found ${caps.length} caption${caps.length === 1 ? "" : "s"}`
          : "No captions found. Make sure you selected the posts_*.json / reels.json files from your export."
      );
    } catch {
      setImportCaptions([]);
      setImportStatus("Couldn't read those files.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold">Account</h1>
          <p className="text-sm text-muted-foreground truncate">
            {user?.email}
          </p>
        </div>
      </div>

      {/* Account metrics */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ChartBar className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Posting Preferences</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Used to recommend posting cadence for your trial reels.
        </p>

        <div className="rounded-lg border bg-card p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Platform</Label>
              <Select
                value={platform}
                onValueChange={(v) => setPlatform(v as Platform)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Posts / week</Label>
              <Input
                type="number"
                step="0.5"
                value={postsPerWeek}
                onChange={(e) => setPostsPerWeek(e.target.value)}
                placeholder="3"
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Performance trend</Label>
            <Select
              value={performanceTrend}
              onValueChange={(v) =>
                setPerformanceTrend(v as PerformanceTrend)
              }
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rising">Rising</SelectItem>
                <SelectItem value="stable">Stable</SelectItem>
                <SelectItem value="declining">Declining</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Niche</Label>
            <Input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. fitness, cooking, tech reviews"
              className="h-9 text-sm"
            />
          </div>

          <Button
            size="sm"
            className="w-full"
            onClick={handleSaveMetrics}
            disabled={!postsPerWeek || isUpserting}
          >
            {isUpserting ? (
              <CircleNotch className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : metricsSaved ? (
              <CheckCircle className="h-3.5 w-3.5 mr-1" weight="fill" />
            ) : null}
            {metricsSaved ? "Saved" : "Save"}
          </Button>
        </div>
      </div>

      {/* Caption voice */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkle className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Caption Voice</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Learn your caption style from your Instagram history so generated captions sound like you.
        </p>

        <div className="rounded-lg border bg-card p-4 space-y-4">
          {/* Existing profile */}
          {voiceProfile?.text && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Learned from {voiceProfile.sampleCount} caption
                {voiceProfile.sampleCount === 1 ? "" : "s"}
                {voiceUpdatedAt ? ` · ${new Date(voiceUpdatedAt).toLocaleDateString()}` : ""}
              </p>
              {editingVoice ? (
                <div className="space-y-2">
                  <textarea
                    className="text-xs w-full bg-transparent border rounded px-2 py-1.5 outline-none resize-none leading-relaxed"
                    rows={10}
                    value={voiceText}
                    onChange={(e) => setVoiceText(e.target.value)}
                  />
                  <div className="flex justify-end gap-1.5">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingVoice(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" className="h-7 text-xs" onClick={handleSaveVoiceText} disabled={isUpdatingText}>
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs whitespace-pre-line leading-relaxed text-muted-foreground max-h-48 overflow-y-auto">
                    {voiceProfile.text}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => { setVoiceText(voiceProfile.text); setEditingVoice(true); }}
                  >
                    <PencilSimple className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Build / update from captions */}
          <div className={`space-y-3 ${voiceProfile?.text ? "pt-3 border-t" : ""}`}>
            {!voiceProfile?.text && (
              <p className="text-xs text-muted-foreground">
                No voice profile yet — build one from your captions:
              </p>
            )}

            {/* Method 1: Instagram data export */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium flex items-center gap-1.5">
                <UploadSimple className="h-3.5 w-3.5" /> Import from Instagram data export
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                In Instagram: <span className="text-foreground">Settings → Accounts Center → Your information and permissions → Download your information</span>, request a <span className="text-foreground">JSON</span> export, unzip it, then select the <span className="text-foreground">posts</span> / <span className="text-foreground">reels</span> <code>.json</code> files.
              </p>
              <input
                type="file"
                multiple
                accept=".json,application/json"
                onChange={(e) => handleExportFiles(e.target.files)}
                className="block w-full text-[11px] text-muted-foreground file:mr-2 file:rounded file:border file:border-input file:bg-transparent file:px-2 file:py-1 file:text-xs file:cursor-pointer"
              />
              {importStatus && <p className="text-[11px] text-muted-foreground">{importStatus}</p>}
              {importCaptions.length > 0 && (
                <Button
                  size="sm"
                  className="w-full"
                  disabled={isBuilding}
                  onClick={() => handleBuildVoice(importCaptions)}
                >
                  {isBuilding ? (
                    <CircleNotch className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Sparkle className="h-3.5 w-3.5 mr-1" />
                  )}
                  Build from {importCaptions.length} caption{importCaptions.length === 1 ? "" : "s"}
                </Button>
              )}
            </div>

            {/* Method 2: paste */}
            <div className="pt-1">
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setPasteOpen((o) => !o)}
              >
                Or paste captions manually
              </button>
              {pasteOpen && (
                <div className="space-y-2 mt-2">
                  <textarea
                    className="text-xs w-full bg-transparent border rounded px-2 py-1.5 outline-none resize-none"
                    rows={6}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Paste a handful of your captions, separated by a blank line between each…"
                  />
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={isBuilding || !pasteText.trim()}
                    onClick={() =>
                      handleBuildVoice(
                        pasteText.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean)
                      )
                    }
                  >
                    {isBuilding ? <CircleNotch className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                    Build from pasted captions
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sign out */}
      <Button variant="outline" className="w-full" onClick={() => signOut()}>
        <SignOut className="h-4 w-4 mr-2" />
        Sign Out
      </Button>
    </div>
  );
}
