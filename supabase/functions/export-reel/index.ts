const WORKER_URL = Deno.env.get("EXPORT_WORKER_URL")!;
const WORKER_API_KEY = Deno.env.get("EXPORT_WORKER_API_KEY") || "";

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
    const { segments, burnText, textPosition } = await req.json();

    if (!segments?.length) {
      return new Response(
        JSON.stringify({ error: "No segments provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build payload for the worker — include R2 credentials so it can
    // upload the result directly to R2.
    const workerPayload = {
      apiKey: WORKER_API_KEY,
      segments: segments.map(
        (seg: {
          videoUrl: string;
          startSeconds: number;
          endSeconds: number;
          sectionText: string;
        }) => ({
          videoUrl: seg.videoUrl,
          startSeconds: seg.startSeconds,
          endSeconds: seg.endSeconds,
          sectionText: seg.sectionText,
        })
      ),
      burnText: burnText ?? false,
      textPosition: textPosition ?? "bottom",
      r2: {
        accountId: Deno.env.get("R2_ACCOUNT_ID")!,
        accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
        secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
        bucketName: Deno.env.get("R2_BUCKET_NAME")!,
        publicUrl: Deno.env.get("R2_PUBLIC_URL") || "",
      },
    };

    console.log(
      `[export-reel] Forwarding ${segments.length} segments to worker`
    );

    const workerResp = await fetch(`${WORKER_URL}/export-reel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workerPayload),
    });

    const result = await workerResp.json();

    if (!workerResp.ok) {
      console.error("[export-reel] Worker error:", result);
      return new Response(JSON.stringify({ error: result.error || "Export failed" }), {
        status: workerResp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[export-reel] Success:", result.url);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[export-reel] Error:", (err as Error).message);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
