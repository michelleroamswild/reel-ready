import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, getCurrentUserId } from "@/lib/supabase";
import { uploadToR2, UploadCancelledError } from "@/lib/storage";
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
  try {
    const { data, error } = await supabase.functions.invoke("generate-thumbnail", {
      body: { videoId, videoUrl },
    });
    if (error) throw error;
    return data?.thumbnailUrl ?? null;
  } catch (err) {
    console.error("Thumbnail generation failed:", err);
    return null;
  }
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
        await generateThumbnail(v.id, v.url);
      }
      backfillingRef.current = false;
      queryClient.invalidateQueries({ queryKey: VIDEOS_KEY });
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
    generateThumbnail: (video: Video) => thumbnailMutation.mutate(video),
    updateVideo: updateVideoMutation.mutate,
  };
}
