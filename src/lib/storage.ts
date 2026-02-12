import { supabase } from "./supabase";

interface UploadUrlResponse {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}

export async function getUploadUrl(
  filename: string,
  contentType: string
): Promise<UploadUrlResponse> {
  const { data, error } = await supabase.functions.invoke("upload-url", {
    body: { filename, contentType },
  });

  if (error) throw error;
  return data as UploadUrlResponse;
}

export async function uploadToR2(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ key: string; url: string }> {
  const { uploadUrl, key, publicUrl } = await getUploadUrl(file.name, file.type);

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed with status ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });

  return { key, url: publicUrl };
}
