import { S3Client, DeleteObjectCommand } from "npm:@aws-sdk/client-s3";
import { createClient } from "npm:@supabase/supabase-js";
import { getAuthUser } from "../_shared/auth.ts";

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
    const { userId } = await getAuthUser(req);
    const { reelId, r2Key } = await req.json();

    if (!reelId) {
      return new Response(
        JSON.stringify({ error: "reelId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify the reel belongs to the user
    const { data: reel, error: fetchError } = await supabase
      .from("reels")
      .select("id, source_template")
      .eq("id", reelId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !reel) {
      throw new Error(`Reel not found: ${fetchError?.message ?? reelId}`);
    }

    // Delete R2 object if key provided
    if (r2Key) {
      try {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: BUCKET,
            Key: r2Key,
          })
        );
      } catch (r2Err) {
        console.error("R2 delete failed (non-fatal):", r2Err.message);
      }
    }

    // Clear source_template on the reel (keeps the reel itself)
    const { error: updateError } = await supabase
      .from("reels")
      .update({ source_template: null })
      .eq("id", reelId)
      .eq("user_id", userId);

    if (updateError) {
      throw new Error(`Failed to clear template: ${updateError.message}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("delete-template error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
