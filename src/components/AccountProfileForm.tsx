import { useState, useEffect } from "react";
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
  CircleNotch,
  CheckCircle,
} from "@phosphor-icons/react";
import type { Platform, PerformanceTrend, AccountState } from "@/types/posting-strategy";

interface AccountProfileFormProps {
  onAccountState: (state: AccountState) => void;
}

export function AccountProfileForm({ onAccountState }: AccountProfileFormProps) {
  const { profile, isLoading, upsertProfile, isUpserting } =
    useAccountProfile();

  const [platform, setPlatform] = useState<Platform>("instagram");
  const [postsPerWeek, setPostsPerWeek] = useState("");
  const [performanceTrend, setPerformanceTrend] =
    useState<PerformanceTrend>("stable");
  const [niche, setNiche] = useState("");

  // Populate from saved profile
  useEffect(() => {
    if (profile) {
      setPlatform(profile.platform);
      setPostsPerWeek(String(profile.postsPerWeek));
      setPerformanceTrend(profile.performanceTrend);
      setNiche(profile.niche);
    }
  }, [profile]);

  // Auto-emit when profile is loaded
  useEffect(() => {
    if (profile && profile.postsPerWeek > 0) {
      onAccountState({
        platform: profile.platform,
        followerCount: 0,
        postsPerWeek: profile.postsPerWeek,
        performanceTrend: profile.performanceTrend,
        niche: profile.niche,
      });
    }
  }, [profile, onAccountState]);

  const handleSubmit = () => {
    const ppw = parseFloat(postsPerWeek);
    if (isNaN(ppw)) return;

    const state: AccountState = {
      platform,
      followerCount: 0,
      postsPerWeek: ppw,
      performanceTrend,
      niche: niche.trim(),
    };
    onAccountState(state);
    upsertProfile(state);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 justify-center">
        <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading account...</span>
      </div>
    );
  }

  // If profile exists with valid data, show summary view
  if (profile && profile.postsPerWeek > 0) {
    return (
      <div className="rounded-lg border bg-card p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <CheckCircle className="h-3.5 w-3.5 text-green-500" weight="fill" />
          <p className="text-xs font-medium">
            Using saved posting preferences
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-muted/50 px-2.5 py-1.5 text-center">
            <p className="text-[10px] text-muted-foreground">Posts/wk</p>
            <p className="text-xs font-semibold">{profile.postsPerWeek}</p>
          </div>
          <div className="rounded-md bg-muted/50 px-2.5 py-1.5 text-center">
            <p className="text-[10px] text-muted-foreground">Trend</p>
            <p className="text-xs font-semibold capitalize">
              {profile.performanceTrend}
            </p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Edit in Account settings
        </p>
      </div>
    );
  }

  // No saved profile — show inline form
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <p className="text-xs text-muted-foreground">
        Enter your posting preferences, or save them in Account settings.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Platform</Label>
          <Select
            value={platform}
            onValueChange={(v) => setPlatform(v as Platform)}
          >
            <SelectTrigger className="h-8 text-sm">
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
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Performance</Label>
        <Select
          value={performanceTrend}
          onValueChange={(v) => setPerformanceTrend(v as PerformanceTrend)}
        >
          <SelectTrigger className="h-8 text-sm">
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
          className="h-8 text-sm"
        />
      </div>

      <Button
        size="sm"
        className="w-full"
        onClick={handleSubmit}
        disabled={!postsPerWeek || isUpserting}
      >
        {isUpserting ? (
          <CircleNotch className="h-3.5 w-3.5 animate-spin mr-1" />
        ) : null}
        Use These Settings
      </Button>
    </div>
  );
}
