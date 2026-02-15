import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Reel, ReelWithDetails } from "@/types/reel";
import type { Video } from "@/types/video";
import type { TrialBatchWithReels } from "@/types/trial";

const REELS_KEY = ["reels"];
const trialBatchKey = (id: string) => ["trial-batch", id];

export function useGenerateTrialReels() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reel,
      videos,
    }: {
      reel: ReelWithDetails;
      videos: Video[];
    }) => {
      // 1. Create trial_batches row
      const { data: batch, error: batchError } = await supabase
        .from("trial_batches")
        .insert({ base_reel_id: reel.id, status: "generating" })
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
          // Insert the reel
          const { data: variantReel, error: reelError } = await supabase
            .from("reels")
            .insert({
              phrase_id: reel.phrase_id,
              title: `${reel.title} — ${variant.variantLabel}`,
              target_duration_seconds: variant.targetDuration,
              trial_batch_id: batchId,
              trial_variant_type: variant.variantType,
              trial_variant_label: variant.variantLabel,
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

        // 5. Update batch status to ready
        const { error: updateError } = await supabase
          .from("trial_batches")
          .update({ status: "ready" })
          .eq("id", batchId);

        if (updateError) throw updateError;

        return batchId;
      } catch (err) {
        // Rollback: delete batch + any created reels (cascade handles segments)
        await supabase
          .from("reels")
          .delete()
          .eq("trial_batch_id", batchId)
          .catch(() => {});
        await supabase
          .from("trial_batches")
          .delete()
          .eq("id", batchId)
          .catch(() => {});
        throw err;
      }
    },
    onSuccess: (batchId) => {
      queryClient.invalidateQueries({ queryKey: REELS_KEY });
      queryClient.invalidateQueries({ queryKey: trialBatchKey(batchId) });
    },
  });
}

export function useGenerateTrialReelsFromVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      video,
      allVideos,
    }: {
      video: Video;
      allVideos: Video[];
    }) => {
      // 1. Create a base reel from this video
      const duration = video.duration_seconds ?? 10;
      const title = video.filename.replace(/\.[^.]+$/, "");

      const { data: baseReel, error: reelError } = await supabase
        .from("reels")
        .insert({
          phrase_id: null,
          title,
          target_duration_seconds: Math.round(duration),
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
        await supabase.from("reels").delete().eq("id", baseReelId).catch(() => {});
        throw segError;
      }

      // 2. Create trial batch
      const { data: batch, error: batchError } = await supabase
        .from("trial_batches")
        .insert({ base_reel_id: baseReelId, status: "generating" })
        .select()
        .single();

      if (batchError) {
        await supabase.from("reels").delete().eq("id", baseReelId).catch(() => {});
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
          const { data: variantReel, error: vrError } = await supabase
            .from("reels")
            .insert({
              phrase_id: null,
              title: `${title} — ${variant.variantLabel}`,
              target_duration_seconds: variant.targetDuration,
              trial_batch_id: batchId,
              trial_variant_type: variant.variantType,
              trial_variant_label: variant.variantLabel,
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

        // 7. Update batch status
        const { error: updateError } = await supabase
          .from("trial_batches")
          .update({ status: "ready" })
          .eq("id", batchId);

        if (updateError) throw updateError;

        return batchId;
      } catch (err) {
        // Rollback
        await supabase
          .from("reels")
          .delete()
          .eq("trial_batch_id", batchId)
          .catch(() => {});
        await supabase
          .from("trial_batches")
          .delete()
          .eq("id", batchId)
          .catch(() => {});
        await supabase
          .from("reels")
          .delete()
          .eq("id", baseReelId)
          .catch(() => {});
        throw err;
      }
    },
    onSuccess: (batchId) => {
      queryClient.invalidateQueries({ queryKey: REELS_KEY });
      queryClient.invalidateQueries({ queryKey: trialBatchKey(batchId) });
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
