import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { uploadToR2 } from "@/lib/storage";
import type { Video } from "@/types/video";

const VIDEOS_KEY = ["videos"];

async function fetchVideos(): Promise<Video[]> {
  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: VIDEOS_KEY }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("videos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: VIDEOS_KEY }),
  });

  return {
    videos,
    isLoading,
    uploadVideo: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    deleteVideo: (id: string) => deleteMutation.mutate(id),
  };
}
