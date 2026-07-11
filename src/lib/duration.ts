// Read a video's duration (in seconds) by loading just its metadata.
// Works off either an uploaded File (object URL) or a remote URL.
// Returns null if the duration can't be determined.

function readDuration(src: string): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata"; // only fetches the header, not the whole file
    video.muted = true;
    let done = false;

    const finish = (val: number | null) => {
      if (done) return;
      done = true;
      video.removeAttribute("src");
      video.load();
      resolve(val);
    };

    video.onloadedmetadata = () => {
      const d = video.duration;
      finish(Number.isFinite(d) && d > 0 ? d : null);
    };
    video.onerror = () => finish(null);
    setTimeout(() => finish(null), 15000);

    video.src = src;
  });
}

export async function getVideoDuration(file: File): Promise<number | null> {
  const url = URL.createObjectURL(file);
  try {
    return await readDuration(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function getVideoDurationFromUrl(url: string): Promise<number | null> {
  return readDuration(url);
}

// Display helper. Short clips show exact tenths ("12.4s"); a minute or more
// switches to m:ss ("1:12").
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Length filter buckets. Short-form clips cluster under 15s, so the granularity
// lives there.
export const LENGTH_BUCKETS: { value: string; label: string }[] = [
  { value: "0-3", label: "≤3s" },
  { value: "3-6", label: "3–6s" },
  { value: "6-9", label: "6–9s" },
  { value: "9-12", label: "9–12s" },
  { value: "12-15", label: "12–15s" },
  { value: "15+", label: "15s+" },
];

export function durationBucket(seconds: number): string {
  if (seconds <= 3) return "0-3";
  if (seconds <= 6) return "3-6";
  if (seconds <= 9) return "6-9";
  if (seconds <= 12) return "9-12";
  if (seconds <= 15) return "12-15";
  return "15+";
}
