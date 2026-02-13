import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { uploadToR2 } from "@/lib/storage";
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

async function analyzeVideoWithAi(
  videoId: string,
  videoUrl: string,
  mimeType?: string
): Promise<VideoAnalysis | null> {
  try {
    const { data, error } = await supabase.functions.invoke("analyze-video", {
      body: { videoUrl, mimeType: mimeType || "video/mp4" },
    });

    if (error) throw error;

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
    }: {
      file: File;
      onProgress?: (percent: number) => void;
    }) => {
      const { key, url } = await uploadToR2(file, onProgress);

      const { data, error } = await supabase
        .from("videos")
        .insert({
          filename: file.name,
          r2_key: key,
          url,
          size_bytes: file.size,
          mime_type: file.type,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Video;
    },
    onSuccess: (video) => {
      queryClient.invalidateQueries({ queryKey: VIDEOS_KEY });
      // Trigger AI analysis in the background
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

  return {
    videos,
    isLoading,
    uploadVideo: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    analyzeVideo: (video: Video) => analyzeMutation.mutate(video),
    isAnalyzing: analyzeMutation.isPending,
    deleteVideo: (id: string) => deleteMutation.mutate(id),
  };
}
