"use client";

import { startTransition, useEffect, useEffectEvent } from "react";
import { useRouter } from "next/navigation";

export function OverviewLiveUpdater({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();

  const refresh = useEffectEvent(() => {
    if (document.visibilityState !== "visible") return;
    startTransition(() => {
      router.refresh();
    });
  });

  useEffect(() => {
    const handle = setInterval(() => {
      refresh();
    }, intervalMs);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(handle);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs]);

  return null;
}
