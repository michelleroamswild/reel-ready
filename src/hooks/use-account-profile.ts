import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, getCurrentUserId } from "@/lib/supabase";
import type {
  AccountProfile,
  AccountState,
  Platform,
  PerformanceTrend,
} from "@/types/posting-strategy";

const ACCOUNT_PROFILE_KEY = ["account-profile"];

function mapRow(row: Record<string, unknown>): AccountProfile {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    platform: row.platform as Platform,
    followerCount: row.follower_count as number,
    postsPerWeek: row.posts_per_week as number,
    performanceTrend: row.performance_trend as PerformanceTrend,
    niche: (row.niche as string) ?? "",
    topPostingHours: (row.top_posting_hours as number[]) ?? undefined,
    avgEngagementRate: (row.avg_engagement_rate as number) ?? null,
    audienceDemographics:
      (row.audience_demographics as Record<string, unknown>) ?? null,
    lastSyncedAt: (row.last_synced_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function useAccountProfile(platform?: Platform) {
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: [...ACCOUNT_PROFILE_KEY, platform ?? "default"],
    queryFn: async (): Promise<AccountProfile | null> => {
      let query = supabase
        .from("account_profiles")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (platform) {
        query = query.eq("platform", platform);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return mapRow(data);
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (state: AccountState) => {
      const user_id = await getCurrentUserId();
      const { data, error } = await supabase
        .from("account_profiles")
        .upsert(
          {
            user_id,
            platform: state.platform,
            follower_count: state.followerCount,
            posts_per_week: state.postsPerWeek,
            performance_trend: state.performanceTrend,
            niche: state.niche,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,platform" }
        )
        .select()
        .single();
      if (error) throw error;
      return mapRow(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNT_PROFILE_KEY });
    },
  });

  return {
    profile,
    isLoading,
    upsertProfile: upsertMutation.mutateAsync,
    isUpserting: upsertMutation.isPending,
  };
}
