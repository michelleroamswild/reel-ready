import { Film } from "lucide-react";

export default function VideosPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
      <Film className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-lg font-semibold">Videos</h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        Upload and manage your video library here. Connect a storage backend to get started.
      </p>
    </div>
  );
}
