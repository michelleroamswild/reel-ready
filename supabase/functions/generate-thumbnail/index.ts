import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3";
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
const WORKER_URL = Deno.env.get("EXPORT_WORKER_URL")!;
const WORKER_API_KEY = Deno.env.get("EXPORT_WORKER_API_KEY") || "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { videoId, videoUrl } = await req.json();

    if (!videoId || !videoUrl) {
      return new Response(
        JSON.stringify({ error: "videoId and videoUrl are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 1. Call Fly.io worker to extract a JPEG frame
    const workerResp = await fetch(`${WORKER_URL}/generate-thumbnail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoUrl, apiKey: WORKER_API_KEY }),
    });

    if (!workerResp.ok) {
      const errText = await workerResp.text();
      throw new Error(`Worker error (${workerResp.status}): ${errText}`);
    }

    const thumbBuffer = new Uint8Array(await workerResp.arrayBuffer());
    const thumbKey = `thumbnails/${videoId}.jpg`;

    // 2. Upload JPEG to R2
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: thumbKey,
        Body: thumbBuffer,
        ContentType: "image/jpeg",
      })
    );

    const thumbnailUrl = PUBLIC_URL
      ? `${PUBLIC_URL}/${thumbKey}`
      : `https://${Deno.env.get("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com/${BUCKET}/${thumbKey}`;

    // 3. Update video record
    const { error: updateError } = await supabase
      .from("videos")
      .update({ thumbnail_url: thumbnailUrl })
      .eq("id", videoId);

    if (updateError) {
      throw new Error(`Failed to update video: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ thumbnailUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-thumbnail error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
