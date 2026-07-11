import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, getCurrentUserId } from "@/lib/supabase";
import { uploadToR2, UploadCancelledError } from "@/lib/storage";
import { getVideoDuration, getVideoDurationFromUrl } from "@/lib/duration";
import type { Video, VideoAnalysis } from "@/types/video";

const VIDEOS_KEY = ["videos"];

async function fetchVideos(): Promise<Video[]> {
  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

async function generateThumbnail(videoId: string, videoUrl: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("generate-thumbnail", {
    body: { videoId, videoUrl },
  });
  if (error) throw error;
  return data?.thumbnailUrl ?? null;
}

async function analyzeVideoWithAi(
  videoId: string,
  videoUrl: string,
  mimeType?: string
): Promise<VideoAnalysis | null> {
  try {
    console.log("[analyze] Calling analyze-video edge function for", videoId, videoUrl);
    const { data, error } = await supabase.functions.invoke("analyze-video", {
      body: { videoUrl, mimeType: mimeType || "video/mp4" },
    });

    if (error) {
      // Try to extract the actual error message from the response
      let detail = error.message;
      try {
        if (error.context && typeof error.context.json === "function") {
          const body = await error.context.json();
          detail = body?.error || JSON.stringify(body);
        }
      } catch {}
      console.error("[analyze] Edge function error detail:", detail);
      throw new Error(detail);
    }

    const analysis = data.analysis as VideoAnalysis;

    // Save analysis to the video record
    await supabase
      .from("videos")
      .update({ analysis })
      .eq("id", videoId);

    return analysis;
  } catch (err) {
    console.error("Video analysis failed:", err);
    return null;
  }
}

export function useVideos() {
  const queryClient = useQueryClient();

  const { data: videos = [], isLoading } = useQuery({
    queryKey: VIDEOS_KEY,
    queryFn: fetchVideos,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({
      file,
      onProgress,
      videoType,
      signal,
    }: {
      file: File;
      onProgress?: (percent: number) => void;
      videoType?: "clip" | "edit";
      signal?: AbortSignal;
    }) => {
      // Read the duration from the local file before uploading (cheap, metadata only).
      const duration = await getVideoDuration(file).catch(() => null);

      const { key, url } = await uploadToR2(file, onProgress, signal);

      if (signal?.aborted) throw new UploadCancelledError();

      const user_id = await getCurrentUserId();
      const { data, error } = await supabase
        .from("videos")
        .insert({
          filename: file.name,
          r2_key: key,
          url,
          size_bytes: file.size,
          duration_seconds: duration,
          mime_type: file.type,
          video_type: videoType ?? "clip",
          user_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Video;
    },
    onSuccess: (video) => {
      queryClient.invalidateQueries({ queryKey: VIDEOS_KEY });
      // Trigger thumbnail generation and AI analysis in the background
      generateThumbnail(video.id, video.url).then(() => {
        queryClient.invalidateQueries({ queryKey: VIDEOS_KEY });
      });
      analyzeVideoWithAi(video.id, video.url, video.mime_type).then(() => {
        queryClient.invalidateQueries({ queryKey: VIDEOS_KEY });
      });
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async (video: Video) => {
      return analyzeVideoWithAi(video.id, video.url, video.mime_type || undefined);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: VIDEOS_KEY }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("delete-video", {
        body: { videoId: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: VIDEOS_KEY }),
  });

  // Auto-generate thumbnails for videos that don't have one yet
  const backfillingRef = useRef(false);
  const backfilledIds = useRef(new Set<string>());

  useEffect(() => {
    if (isLoading || backfillingRef.current) return;

    const missing = videos.filter(
      (v) => !v.thumbnail_url && !backfilledIds.current.has(v.id)
    );
    if (missing.length === 0) return;

    backfillingRef.current = true;

    (async () => {
      for (const v of missing) {
        backfilledIds.current.add(v.id);
        try {
          await generateThumbnail(v.id, v.url);
        } catch (err) {
          console.warn("Thumbnail backfill stopped:", err);
          break;
        }
      }
      backfillingRef.current = false;
      queryClient.invalidateQueries({ queryKey: VIDEOS_KEY });
    })();
  }, [videos, isLoading, queryClient]);

  // Backfill durations for videos uploaded before we captured them.
  // preload="metadata" only fetches the file header via a range request — cheap.
  const durationBackfillingRef = useRef(false);
  const durationBackfilledIds = useRef(new Set<string>());

  useEffect(() => {
    if (isLoading || durationBackfillingRef.current) return;

    const missing = videos.filter(
      (v) => v.duration_seconds == null && !durationBackfilledIds.current.has(v.id)
    );
    if (missing.length === 0) return;

    durationBackfillingRef.current = true;

    (async () => {
      let changed = false;
      for (const v of missing) {
        durationBackfilledIds.current.add(v.id);
        try {
          const duration = await getVideoDurationFromUrl(v.url);
          if (duration != null) {
            await supabase.from("videos").update({ duration_seconds: duration }).eq("id", v.id);
            changed = true;
          }
        } catch (err) {
          console.warn("Duration backfill failed for", v.id, err);
        }
      }
      durationBackfillingRef.current = false;
      if (changed) queryClient.invalidateQueries({ queryKey: VIDEOS_KEY });
    })();
  }, [videos, isLoading, queryClient]);

  const thumbnailMutation = useMutation({
    mutationFn: async (video: Video) => {
      return generateThumbnail(video.id, video.url);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: VIDEOS_KEY }),
  });

  const updateVideoMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Pick<Video, "filename" | "video_type">> }) => {
      const { error } = await supabase
        .from("videos")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: VIDEOS_KEY }),
  });

  return {
    videos,
    isLoading,
    uploadVideo: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    analyzeVideo: (video: Video) => analyzeMutation.mutate(video),
    isAnalyzing: analyzeMutation.isPending,
    deleteVideo: (id: string) => deleteMutation.mutate(id),
    deletingVideoId: deleteMutation.isPending ? (deleteMutation.variables as string | undefined) ?? null : null,
    generateThumbnail: (video: Video) => thumbnailMutation.mutate(video),
    updateVideo: updateVideoMutation.mutate,
  };
}
