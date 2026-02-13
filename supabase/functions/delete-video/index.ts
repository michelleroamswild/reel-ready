import { S3Client, DeleteObjectCommand } from "npm:@aws-sdk/client-s3";
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
    const { videoId } = await req.json();

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: "videoId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch video record to get the R2 key
    const { data: video, error: fetchError } = await supabase
      .from("videos")
      .select("id, r2_key")
      .eq("id", videoId)
      .single();

    if (fetchError || !video) {
      throw new Error(`Video not found: ${fetchError?.message ?? videoId}`);
    }

    // Delete from R2
    if (video.r2_key) {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: BUCKET,
          Key: video.r2_key,
        })
      );
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from("videos")
      .delete()
      .eq("id", videoId);

    if (deleteError) {
      throw new Error(`Failed to delete video record: ${deleteError.message}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("delete-video error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
