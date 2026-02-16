import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, getCurrentUserId } from "@/lib/supabase";
import type { Reel, ReelWithDetails } from "@/types/reel";
import type { Video } from "@/types/video";
import type { TrialBatch, TrialBatchWithReels, ReferencePatterns } from "@/types/trial";
import type { TrendingAudio } from "@/types/trending-audio";

const REELS_KEY = ["reels"];
const reelKey = (id: string) => ["reels", id];
const trialBatchKey = (id: string) => ["trial-batch", id];
const trialBatchesForReelKey = (reelId: string) => ["trial-batches-for-reel", reelId];

export function useGenerateTrialReels() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reel,
      videos,
      trendingAudio,
      referencePatterns,
      referenceUrls,
    }: {
      reel: ReelWithDetails;
      videos: Video[];
      trendingAudio?: TrendingAudio[];
      referencePatterns?: ReferencePatterns;
      referenceUrls?: string[];
    }) => {
      // 1. Create trial_batches row
      const user_id = await getCurrentUserId();
      const { data: batch, error: batchError } = await supabase
        .from("trial_batches")
        .insert({ base_reel_id: reel.id, status: "generating", user_id })
        .select()
        .single();

      if (batchError) throw batchError;
      const batchId = batch.id as string;

      try {
        // 2. Filter to analyzed videos
        const analyzedVideos = videos.filter(
          (v) => v.analysis !== null && v.analysis !== undefined
        );

        if (analyzedVideos.length === 0) {
          throw new Error(
            "No analyzed videos available. Analyze at least one video first."
          );
        }

        // 3. Call edge function
        const { data: result, error: fnError } =
          await supabase.functions.invoke("generate-trial-reels", {
            body: {
              baseReel: {
                title: reel.title,
                phraseText:
                  reel.phrase?.text ??
                  reel.reel_segments[0]?.section_text ??
                  "",
                targetDuration: reel.target_duration_seconds,
                segments: reel.reel_segments.map((seg) => ({
                  section_text: seg.section_text,
                  video_id: seg.video_id,
                  start_seconds: seg.start_seconds,
                  end_seconds: seg.end_seconds,
                  section_index: seg.section_index,
                })),
              },
              videos: analyzedVideos.map((v) => ({
                id: v.id,
                filename: v.filename,
                duration_seconds: v.duration_seconds,
                analysis: v.analysis,
              })),
              ...(trendingAudio?.length
                ? {
                    trendingAudio: trendingAudio.map((t) => ({
                      title: t.title,
                      artist: t.artist,
                      genre: t.genre,
                      mood: t.mood,
                      usage_count: t.usage_count,
                    })),
                  }
                : {}),
              ...(referencePatterns ? { referencePatterns } : {}),
            },
          });

        if (fnError) throw fnError;

        // Parse result
        let parsed = result;
        if (typeof result === "string") {
          try {
            parsed = JSON.parse(result);
          } catch {
            throw new Error(
              `Edge function returned invalid JSON: ${result.slice(0, 200)}`
            );
          }
        }

        if (!parsed) throw new Error("Edge function returned empty response");
        if (parsed.error) throw new Error(parsed.error);

        const variants = parsed.variants as Array<{
          variantType: string;
          variantLabel: string;
          targetDuration: number;
          audioSuggestion?: string;
          segments: Array<{
            sectionIndex: number;
            sectionText: string;
            videoId: string;
            startSeconds: number;
            endSeconds: number;
          }>;
        }>;

        if (!variants || variants.length === 0) {
          throw new Error("AI returned no variants");
        }

        // UUID validation regex
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        // 4. For each variant: insert reel + segments
        for (const variant of variants) {
          // For audio variants, append suggestion to the label
          const label = variant.audioSuggestion
            ? `${variant.variantLabel} · ${variant.audioSuggestion}`
            : variant.variantLabel;

          // Insert the reel
          const { data: variantReel, error: reelError } = await supabase
            .from("reels")
            .insert({
              phrase_id: reel.phrase_id,
              title: `${reel.title} — ${variant.variantLabel}`,
              target_duration_seconds: variant.targetDuration,
              trial_batch_id: batchId,
              trial_variant_type: variant.variantType,
              trial_variant_label: label,
              user_id,
              // Copy text settings from base reel
              text_position: reel.text_position,
              text_size: reel.text_size,
              text_border: reel.text_border,
              text_border_color: reel.text_border_color,
              burn_text: reel.burn_text,
            })
            .select()
            .single();

          if (reelError) throw reelError;

          const variantReelId = (variantReel as Reel).id;

          // Validate and insert segments
          const segments = variant.segments.map((seg) => {
            if (!uuidRegex.test(seg.videoId)) {
              throw new Error(
                `Invalid video_id "${seg.videoId}" — expected UUID.`
              );
            }
            return {
              reel_id: variantReelId,
              video_id: seg.videoId,
              section_text: seg.sectionText ?? "",
              section_index: seg.sectionIndex ?? 0,
              start_seconds: seg.startSeconds ?? 0,
              end_seconds: seg.endSeconds ?? 5,
            };
          });

          const { error: segError } = await supabase
            .from("reel_segments")
            .insert(segments);

          if (segError) throw segError;
        }

        // 5. Update batch status to ready (and save reference data if present)
        const batchUpdate: Record<string, unknown> = { status: "ready" };
        if (referenceUrls?.length) batchUpdate.reference_urls = referenceUrls;
        if (referencePatterns) batchUpdate.reference_patterns = referencePatterns;

        const { error: updateError } = await supabase
          .from("trial_batches")
          .update(batchUpdate)
          .eq("id", batchId);

        if (updateError) throw updateError;

        return batchId;
      } catch (err) {
        // Rollback: delete batch + any created reels (cascade handles segments)
        try { await supabase.from("reels").delete().eq("trial_batch_id", batchId); } catch {}
        try { await supabase.from("trial_batches").delete().eq("id", batchId); } catch {}
        throw err;
      }
    },
    onSuccess: (batchId, variables) => {
      queryClient.invalidateQueries({ queryKey: REELS_KEY });
      queryClient.invalidateQueries({ queryKey: trialBatchKey(batchId) });
      queryClient.invalidateQueries({
        queryKey: trialBatchesForReelKey(variables.reel.id),
      });
    },
  });
}

export function useGenerateTrialReelsFromVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      video,
      allVideos,
      trendingAudio,
      referencePatterns,
      referenceUrls,
    }: {
      video: Video;
      allVideos: Video[];
      trendingAudio?: TrendingAudio[];
      referencePatterns?: ReferencePatterns;
      referenceUrls?: string[];
    }) => {
      // 1. Create a base reel from this video
      const user_id = await getCurrentUserId();
      const duration = video.duration_seconds ?? 10;
      const title = video.filename.replace(/\.[^.]+$/, "");

      const { data: baseReel, error: reelError } = await supabase
        .from("reels")
        .insert({
          phrase_id: null,
          title,
          target_duration_seconds: Math.round(duration),
          user_id,
        })
        .select()
        .single();

      if (reelError) throw reelError;
      const baseReelId = (baseReel as Reel).id;

      // Insert single segment covering the full video
      const { error: segError } = await supabase
        .from("reel_segments")
        .insert({
          reel_id: baseReelId,
          video_id: video.id,
          section_text: "",
          section_index: 0,
          start_seconds: 0,
          end_seconds: duration,
        });

      if (segError) {
        try { await supabase.from("reels").delete().eq("id", baseReelId); } catch {}
        throw segError;
      }

      // 2. Create trial batch
      const { data: batch, error: batchError } = await supabase
        .from("trial_batches")
        .insert({ base_reel_id: baseReelId, status: "generating", user_id })
        .select()
        .single();

      if (batchError) {
        try { await supabase.from("reels").delete().eq("id", baseReelId); } catch {}
        throw batchError;
      }
      const batchId = batch.id as string;

      try {
        // 3. Filter to analyzed videos
        const analyzedVideos = allVideos.filter(
          (v) => v.analysis !== null && v.analysis !== undefined
        );

        if (analyzedVideos.length === 0) {
          throw new Error(
            "No analyzed videos available. Analyze at least one video first."
          );
        }

        // 4. Call edge function with generateText flag
        const { data: result, error: fnError } =
          await supabase.functions.invoke("generate-trial-reels", {
            body: {
              generateText: true,
              baseReel: {
                title,
                phraseText: "",
                targetDuration: Math.round(duration),
                segments: [
                  {
                    section_text: "",
                    video_id: video.id,
                    start_seconds: 0,
                    end_seconds: duration,
                    section_index: 0,
                  },
                ],
              },
              videos: analyzedVideos.map((v) => ({
                id: v.id,
                filename: v.filename,
                duration_seconds: v.duration_seconds,
                analysis: v.analysis,
              })),
              ...(trendingAudio?.length
                ? {
                    trendingAudio: trendingAudio.map((t) => ({
                      title: t.title,
                      artist: t.artist,
                      genre: t.genre,
                      mood: t.mood,
                      usage_count: t.usage_count,
                    })),
                  }
                : {}),
              ...(referencePatterns ? { referencePatterns } : {}),
            },
          });

        if (fnError) throw fnError;

        let parsed = result;
        if (typeof result === "string") {
          try {
            parsed = JSON.parse(result);
          } catch {
            throw new Error(
              `Edge function returned invalid JSON: ${result.slice(0, 200)}`
            );
          }
        }

        if (!parsed) throw new Error("Edge function returned empty response");
        if (parsed.error) throw new Error(parsed.error);

        // 5. If AI generated base text, update base reel segment
        if (parsed.baseText) {
          await supabase
            .from("reel_segments")
            .update({ section_text: parsed.baseText })
            .eq("reel_id", baseReelId);
        }

        const variants = parsed.variants as Array<{
          variantType: string;
          variantLabel: string;
          targetDuration: number;
          audioSuggestion?: string;
          segments: Array<{
            sectionIndex: number;
            sectionText: string;
            videoId: string;
            startSeconds: number;
            endSeconds: number;
          }>;
        }>;

        if (!variants || variants.length === 0) {
          throw new Error("AI returned no variants");
        }

        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        // 6. Create variant reels
        for (const variant of variants) {
          const label = variant.audioSuggestion
            ? `${variant.variantLabel} · ${variant.audioSuggestion}`
            : variant.variantLabel;

          const { data: variantReel, error: vrError } = await supabase
            .from("reels")
            .insert({
              phrase_id: null,
              title: `${title} — ${variant.variantLabel}`,
              target_duration_seconds: variant.targetDuration,
              trial_batch_id: batchId,
              trial_variant_type: variant.variantType,
              trial_variant_label: label,
              user_id,
            })
            .select()
            .single();

          if (vrError) throw vrError;

          const variantReelId = (variantReel as Reel).id;

          const segments = variant.segments.map((seg) => {
            if (!uuidRegex.test(seg.videoId)) {
              throw new Error(
                `Invalid video_id "${seg.videoId}" — expected UUID.`
              );
            }
            return {
              reel_id: variantReelId,
              video_id: seg.videoId,
              section_text: seg.sectionText ?? "",
              section_index: seg.sectionIndex ?? 0,
              start_seconds: seg.startSeconds ?? 0,
              end_seconds: seg.endSeconds ?? 5,
            };
          });

          const { error: vsError } = await supabase
            .from("reel_segments")
            .insert(segments);

          if (vsError) throw vsError;
        }

        // 7. Update batch status (and save reference data if present)
        const batchUpdate2: Record<string, unknown> = { status: "ready" };
        if (referenceUrls?.length) batchUpdate2.reference_urls = referenceUrls;
        if (referencePatterns) batchUpdate2.reference_patterns = referencePatterns;

        const { error: updateError } = await supabase
          .from("trial_batches")
          .update(batchUpdate2)
          .eq("id", batchId);

        if (updateError) throw updateError;

        return batchId;
      } catch (err) {
        // Rollback
        try { await supabase.from("reels").delete().eq("trial_batch_id", batchId); } catch {}
        try { await supabase.from("trial_batches").delete().eq("id", batchId); } catch {}
        try { await supabase.from("reels").delete().eq("id", baseReelId); } catch {}
        throw err;
      }
    },
    onSuccess: (batchId) => {
      queryClient.invalidateQueries({ queryKey: REELS_KEY });
      queryClient.invalidateQueries({ queryKey: trialBatchKey(batchId) });
    },
  });
}

export function useTrialBatchesForReel(reelId: string | undefined) {
  return useQuery({
    queryKey: trialBatchesForReelKey(reelId!),
    queryFn: async (): Promise<TrialBatchWithReels[]> => {
      // Fetch all batches for this base reel
      const { data: batches, error: batchError } = await supabase
        .from("trial_batches")
        .select("*")
        .eq("base_reel_id", reelId!)
        .order("created_at", { ascending: false });

      if (batchError) throw batchError;
      if (!batches || batches.length === 0) return [];

      // Fetch all variant reels across all batches in one query
      const batchIds = batches.map((b) => b.id);
      const { data: reels, error: reelsError } = await supabase
        .from("reels")
        .select(
          `
          *,
          phrase:phrases(id, text, tags),
          reel_segments(
            *,
            video:videos!video_id(id, filename, url, duration_seconds, thumbnail_url)
          )
        `
        )
        .in("trial_batch_id", batchIds)
        .order("created_at", { ascending: true });

      if (reelsError) throw reelsError;

      // Sort segments within each reel
      for (const reel of reels ?? []) {
        reel.reel_segments?.sort(
          (a: { section_index: number }, b: { section_index: number }) =>
            a.section_index - b.section_index
        );
      }

      // Group reels by batch
      return batches.map((batch) => ({
        ...batch,
        base_reel: { id: reelId!, title: "" },
        reels: ((reels ?? []) as ReelWithDetails[]).filter(
          (r) => r.trial_batch_id === batch.id
        ),
      })) as TrialBatchWithReels[];
    },
    enabled: !!reelId,
  });
}

export function useRegenerateVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      variantReel,
      videos,
    }: {
      variantReel: ReelWithDetails;
      videos: Video[];
    }) => {
      const variantType = variantReel.trial_variant_type as
        | "text"
        | "visual"
        | "audio";
      if (!variantType || !variantReel.trial_batch_id) {
        throw new Error("Not a trial variant reel");
      }

      // Fetch the batch to get base_reel_id
      const { data: batch, error: batchError } = await supabase
        .from("trial_batches")
        .select("base_reel_id")
        .eq("id", variantReel.trial_batch_id)
        .single();

      if (batchError) throw batchError;

      // Fetch base reel with segments
      const { data: baseReel, error: baseError } = await supabase
        .from("reels")
        .select(
          `*, reel_segments(*, video:videos!video_id(id, filename, url, duration_seconds, thumbnail_url))`
        )
        .eq("id", batch.base_reel_id)
        .single();

      if (baseError) throw baseError;

      const baseSegments = (baseReel.reel_segments ?? []).sort(
        (a: { section_index: number }, b: { section_index: number }) =>
          a.section_index - b.section_index
      );

      // Filter to analyzed videos
      const analyzedVideos = videos.filter(
        (v) => v.analysis !== null && v.analysis !== undefined
      );

      if (analyzedVideos.length === 0) {
        throw new Error("No analyzed videos available.");
      }

      // Build phraseText from base reel segments
      const phraseText = baseSegments
        .map((s: { section_text: string }) => s.section_text)
        .filter(Boolean)
        .join(" ");

      // Call edge function with singleVariantType
      const { data: result, error: fnError } =
        await supabase.functions.invoke("generate-trial-reels", {
          body: {
            singleVariantType: variantType,
            baseReel: {
              title: baseReel.title,
              phraseText,
              targetDuration: baseReel.target_duration_seconds,
              segments: baseSegments.map(
                (seg: {
                  section_text: string;
                  video_id: string;
                  start_seconds: number;
                  end_seconds: number;
                  section_index: number;
                }) => ({
                  section_text: seg.section_text,
                  video_id: seg.video_id,
                  start_seconds: seg.start_seconds,
                  end_seconds: seg.end_seconds,
                  section_index: seg.section_index,
                })
              ),
            },
            videos: analyzedVideos.map((v) => ({
              id: v.id,
              filename: v.filename,
              duration_seconds: v.duration_seconds,
              analysis: v.analysis,
            })),
          },
        });

      if (fnError) throw fnError;

      let parsed = result;
      if (typeof result === "string") {
        try {
          parsed = JSON.parse(result);
        } catch {
          throw new Error(
            `Edge function returned invalid JSON: ${result.slice(0, 200)}`
          );
        }
      }

      if (!parsed) throw new Error("Edge function returned empty response");
      if (parsed.error) throw new Error(parsed.error);

      const variants = parsed.variants as Array<{
        variantType: string;
        variantLabel: string;
        targetDuration: number;
        audioSuggestion?: string;
        segments: Array<{
          sectionIndex: number;
          sectionText: string;
          videoId: string;
          startSeconds: number;
          endSeconds: number;
        }>;
      }>;

      if (!variants || variants.length === 0) {
        throw new Error("AI returned no variants");
      }

      const variant = variants[0];

      // Delete old segments
      const { error: delError } = await supabase
        .from("reel_segments")
        .delete()
        .eq("reel_id", variantReel.id);

      if (delError) throw delError;

      // Insert new segments
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      const newSegments = variant.segments.map((seg) => {
        if (!uuidRegex.test(seg.videoId)) {
          throw new Error(
            `Invalid video_id "${seg.videoId}" — expected UUID.`
          );
        }
        return {
          reel_id: variantReel.id,
          video_id: seg.videoId,
          section_text: seg.sectionText ?? "",
          section_index: seg.sectionIndex ?? 0,
          start_seconds: seg.startSeconds ?? 0,
          end_seconds: seg.endSeconds ?? 5,
        };
      });

      const { error: insError } = await supabase
        .from("reel_segments")
        .insert(newSegments);

      if (insError) throw insError;

      // Update reel label (and title)
      const label = variant.audioSuggestion
        ? `${variant.variantLabel} · ${variant.audioSuggestion}`
        : variant.variantLabel;

      const { error: updateError } = await supabase
        .from("reels")
        .update({
          trial_variant_label: label,
          title: `${baseReel.title} — ${variant.variantLabel}`,
          target_duration_seconds: variant.targetDuration,
        })
        .eq("id", variantReel.id);

      if (updateError) throw updateError;

      return variantReel.id;
    },
    onSuccess: (reelId) => {
      queryClient.invalidateQueries({ queryKey: reelKey(reelId) });
      queryClient.invalidateQueries({ queryKey: REELS_KEY });
    },
  });
}

export function useDeleteTrialBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      batchId,
      baseReelId,
    }: {
      batchId: string;
      baseReelId: string;
    }) => {
      // Delete variant reels first (cascade handles their segments)
      const { error: reelsError } = await supabase
        .from("reels")
        .delete()
        .eq("trial_batch_id", batchId);

      if (reelsError) throw reelsError;

      // Then delete the batch itself
      const { error: batchError } = await supabase
        .from("trial_batches")
        .delete()
        .eq("id", batchId);

      if (batchError) throw batchError;

      return { batchId, baseReelId };
    },
    onSuccess: ({ batchId, baseReelId }) => {
      queryClient.invalidateQueries({ queryKey: REELS_KEY });
      queryClient.invalidateQueries({ queryKey: trialBatchKey(batchId) });
      queryClient.invalidateQueries({
        queryKey: trialBatchesForReelKey(baseReelId),
      });
    },
  });
}

export function useTrialBatch(batchId: string | undefined) {
  return useQuery({
    queryKey: trialBatchKey(batchId!),
    queryFn: async (): Promise<TrialBatchWithReels> => {
      // Fetch the batch
      const { data: batch, error: batchError } = await supabase
        .from("trial_batches")
        .select("*")
        .eq("id", batchId!)
        .single();

      if (batchError) throw batchError;

      // Fetch the base reel title
      const { data: baseReel, error: baseError } = await supabase
        .from("reels")
        .select("id, title")
        .eq("id", batch.base_reel_id)
        .single();

      if (baseError) throw baseError;

      // Fetch variant reels with segments
      const { data: reels, error: reelsError } = await supabase
        .from("reels")
        .select(
          `
          *,
          phrase:phrases(id, text, tags),
          reel_segments(
            *,
            video:videos!video_id(id, filename, url, duration_seconds, thumbnail_url)
          )
        `
        )
        .eq("trial_batch_id", batchId!)
        .order("created_at", { ascending: true });

      if (reelsError) throw reelsError;

      // Sort segments within each reel
      for (const reel of reels) {
        reel.reel_segments?.sort(
          (a: { section_index: number }, b: { section_index: number }) =>
            a.section_index - b.section_index
        );
      }

      return {
        ...batch,
        base_reel: baseReel,
        reels: reels as ReelWithDetails[],
      } as TrialBatchWithReels;
    },
    enabled: !!batchId,
    refetchInterval: (query) => {
      // Poll while still generating
      const data = query.state.data as TrialBatchWithReels | undefined;
      if (data?.status === "generating") return 2000;
      return false;
    },
  });
}
