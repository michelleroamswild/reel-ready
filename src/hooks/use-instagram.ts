import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { InstagramConnection } from "@/types/posting-strategy";

const INSTAGRAM_KEY = ["instagram-connection"];

const INSTAGRAM_APP_ID = import.meta.env.VITE_INSTAGRAM_APP_ID ?? "";

function mapRow(row: Record<string, unknown>): InstagramConnection {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    igUserId: row.ig_user_id as string,
    igUsername: row.ig_username as string,
    followersCount: row.followers_count as number,
    mediaCount: row.media_count as number,
    tokenExpiresAt: row.token_expires_at as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function useInstagramConnection() {
  const queryClient = useQueryClient();

  const { data: connection, isLoading } = useQuery({
    queryKey: INSTAGRAM_KEY,
    queryFn: async (): Promise<InstagramConnection | null> => {
      const { data, error } = await supabase
        .from("instagram_connections")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return mapRow(data);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("instagram_connections")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all for this user (RLS scoped)
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INSTAGRAM_KEY });
    },
  });

  const syncMetricsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "instagram-sync-metrics"
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INSTAGRAM_KEY });
      queryClient.invalidateQueries({ queryKey: ["account-profile"] });
    },
  });

  const connectTokenMutation = useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.functions.invoke(
        "instagram-exchange-token",
        { body: { token } }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { igUsername: string; followersCount: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INSTAGRAM_KEY });
      queryClient.invalidateQueries({ queryKey: ["account-profile"] });
    },
  });

  return {
    connection,
    isConnected: !!connection,
    isLoading,
    connectWithToken: connectTokenMutation.mutateAsync,
    isConnecting: connectTokenMutation.isPending,
    disconnect: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,
    syncMetrics: syncMetricsMutation.mutateAsync,
    isSyncing: syncMetricsMutation.isPending,
  };
}

export function getInstagramOAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: INSTAGRAM_APP_ID,
    redirect_uri: redirectUri,
    scope: "instagram_basic,instagram_manage_insights,pages_show_list",
    response_type: "code",
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
}

export async function exchangeInstagramCode(
  code: string,
  redirectUri: string
): Promise<{ igUsername: string; followersCount: number }> {
  const { data, error } = await supabase.functions.invoke(
    "instagram-exchange-token",
    { body: { code, redirectUri } }
  );
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
