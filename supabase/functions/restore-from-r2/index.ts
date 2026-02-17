import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "npm:@aws-sdk/client-s3";
import { createClient } from "npm:@supabase/supabase-js";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${Deno.env.get("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
  },
});

const BUCKET = Deno.env.get("R2_BUCKET_NAME")!;
const PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL");

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getPublicUrl(key: string): string {
  if (PUBLIC_URL) return `${PUBLIC_URL}/${key}`;
  return `https://${Deno.env.get("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com/${BUCKET}/${key}`;
}

// Extract original filename from R2 key like "videos/{uuid}-{filename}"
function extractFilename(key: string): string {
  const basename = key.split("/").pop() || key;
  // Remove the leading UUID prefix (36 chars + dash)
  const match = basename.match(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/
  );
  return match ? match[1] : basename;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const restored = { videos: 0, thumbnails: 0, skipped: 0 };

    // List all objects in R2
    let continuationToken: string | undefined;
    const videoKeys: { key: string; size: number; lastModified: Date }[] = [];
    const thumbnailKeys: string[] = [];

    do {
      const listResult = await s3.send(
        new ListObjectsV2Command({
          Bucket: BUCKET,
          ContinuationToken: continuationToken,
        })
      );

      for (const obj of listResult.Contents || []) {
        if (!obj.Key) continue;

        if (obj.Key.startsWith("videos/")) {
          videoKeys.push({
            key: obj.Key,
            size: obj.Size || 0,
            lastModified: obj.LastModified || new Date(),
          });
        } else if (obj.Key.startsWith("thumbnails/")) {
          thumbnailKeys.push(obj.Key);
        }
      }

      continuationToken = listResult.NextContinuationToken;
    } while (continuationToken);

    // Check which videos already exist in the database
    const { data: existingVideos } = await supabase
      .from("videos")
      .select("r2_key");
    const existingKeys = new Set(
      (existingVideos || []).map((v: { r2_key: string }) => v.r2_key)
    );

    // Insert video records for R2 objects not already in DB
    for (const video of videoKeys) {
      if (existingKeys.has(video.key)) {
        restored.skipped++;
        continue;
      }

      const filename = extractFilename(video.key);
      const url = getPublicUrl(video.key);

      // Try to get content type from R2 metadata
      let mimeType = "video/mp4";
      try {
        const head = await s3.send(
          new HeadObjectCommand({ Bucket: BUCKET, Key: video.key })
        );
        if (head.ContentType) mimeType = head.ContentType;
      } catch {
        // default to video/mp4
      }

      const { error } = await supabase.from("videos").insert({
        filename,
        r2_key: video.key,
        url,
        size_bytes: video.size,
        mime_type: mimeType,
        video_type: "clip",
        user_id: userId,
        created_at: video.lastModified.toISOString(),
      });

      if (error) {
        console.error(`Failed to insert video ${video.key}:`, error.message);
      } else {
        restored.videos++;
      }
    }

    // Update thumbnail URLs for restored videos
    for (const thumbKey of thumbnailKeys) {
      // thumbnails/{videoId}.jpg — extract the videoId
      const match = thumbKey.match(
        /^thumbnails\/([0-9a-f-]+)\.(jpg|jpeg|png|webp)$/
      );
      if (!match) continue;

      const videoId = match[1];
      const thumbUrl = getPublicUrl(thumbKey);

      const { error } = await supabase
        .from("videos")
        .update({ thumbnail_url: thumbUrl })
        .eq("id", videoId)
        .eq("user_id", userId);

      if (!error) restored.thumbnails++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        restored,
        totalR2Videos: videoKeys.length,
        totalR2Thumbnails: thumbnailKeys.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("restore-from-r2 error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
