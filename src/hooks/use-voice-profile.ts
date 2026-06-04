import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, getCurrentUserId } from "@/lib/supabase";

export interface VoiceProfile {
  text: string;
  signatureHashtags: string[];
  sampleCount: number;
  totalCaptions: number;
  source: "instagram" | "paste";
}

export interface VoiceProfileState {
  profile: VoiceProfile | null;
  updatedAt: string | null;
}

const VOICE_PROFILE_KEY = ["voice-profile"];

export function useVoiceProfile() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: VOICE_PROFILE_KEY,
    queryFn: async (): Promise<VoiceProfileState> => {
      const { data, error } = await supabase
        .from("account_profiles")
        .select("voice_profile, voice_profile_updated_at")
        .eq("platform", "instagram")
        .maybeSingle();
      if (error) throw error;
      return {
        profile: (data?.voice_profile as VoiceProfile | null) ?? null,
        updatedAt: (data?.voice_profile_updated_at as string | null) ?? null,
      };
    },
  });

  // Build (or rebuild) the profile. Pass captions to use paste-mode; omit to
  // harvest from the connected Instagram account.
  const buildMutation = useMutation({
    mutationFn: async (vars?: { captions?: string[] }) => {
      const { data, error } = await supabase.functions.invoke("build-voice-profile", {
        body: { captions: vars?.captions },
      });
      if (error) {
        // supabase-js wraps non-2xx in a generic FunctionsHttpError; dig out the
        // real { error } message the function returned in its response body.
        let detail = error.message;
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const body = await ctx.json();
            if (body?.error) detail = body.error;
          } catch {
            /* response wasn't json */
          }
        }
        console.error("[build-voice-profile] failed:", detail);
        throw new Error(detail);
      }
      if (data?.error) throw new Error(data.error);
      return data.voiceProfile as VoiceProfile;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: VOICE_PROFILE_KEY }),
  });

  // Persist a hand-edited profile text.
  const updateTextMutation = useMutation({
    mutationFn: async (text: string) => {
      const user_id = await getCurrentUserId();
      const existing = (data?.profile ?? {}) as Partial<VoiceProfile>;
      const next = { ...existing, text };
      const { error } = await supabase
        .from("account_profiles")
        .upsert(
          {
            user_id,
            platform: "instagram",
            voice_profile: next,
            voice_profile_updated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,platform" }
        );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: VOICE_PROFILE_KEY }),
  });

  return {
    profile: data?.profile ?? null,
    updatedAt: data?.updatedAt ?? null,
    isLoading,
    buildProfile: buildMutation.mutateAsync,
    isBuilding: buildMutation.isPending,
    updateProfileText: updateTextMutation.mutateAsync,
    isUpdatingText: updateTextMutation.isPending,
  };
}
