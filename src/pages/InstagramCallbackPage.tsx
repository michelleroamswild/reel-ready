import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { exchangeInstagramCode } from "@/hooks/use-instagram";
import { CircleNotch, CheckCircle, WarningCircle } from "@phosphor-icons/react";

export default function InstagramCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      setMessage(
        searchParams.get("error_description") ?? "Authorization was denied."
      );
      return;
    }

    if (!code) {
      setStatus("error");
      setMessage("No authorization code received.");
      return;
    }

    const redirectUri = `${window.location.origin}/instagram/callback`;

    exchangeInstagramCode(code, redirectUri)
      .then((result) => {
        setStatus("success");
        setMessage(
          `Connected as @${result.igUsername} (${result.followersCount.toLocaleString()} followers)`
        );
        setTimeout(() => navigate(-1), 2000);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.message ?? "Failed to connect Instagram.");
      });
  }, [searchParams, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center px-4">
      {status === "loading" && (
        <>
          <CircleNotch className="h-10 w-10 text-muted-foreground animate-spin" />
          <p className="text-sm text-muted-foreground">
            Connecting your Instagram account...
          </p>
        </>
      )}
      {status === "success" && (
        <>
          <CheckCircle className="h-10 w-10 text-green-500" weight="fill" />
          <p className="text-sm font-medium">{message}</p>
          <p className="text-xs text-muted-foreground">
            Redirecting back...
          </p>
        </>
      )}
      {status === "error" && (
        <>
          <WarningCircle className="h-10 w-10 text-destructive" weight="fill" />
          <p className="text-sm font-medium text-destructive">{message}</p>
          <button
            className="text-sm text-primary underline"
            onClick={() => navigate(-1)}
          >
            Go back
          </button>
        </>
      )}
    </div>
  );
}
