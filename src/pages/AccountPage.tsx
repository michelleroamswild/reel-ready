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
} from "@phosphor-icons/react";
import { useToast } from "@/hooks/use-toast";
import type { Platform, PerformanceTrend } from "@/types/posting-strategy";

export default function AccountPage() {
  const { user, signOut } = useAuth();
  const { profile, upsertProfile, isUpserting } = useAccountProfile();
  const { toast } = useToast();

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

      {/* Sign out */}
      <Button variant="outline" className="w-full" onClick={() => signOut()}>
        <SignOut className="h-4 w-4 mr-2" />
        Sign Out
      </Button>
    </div>
  );
}
