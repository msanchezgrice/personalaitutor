"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

function formatRefreshTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SignupAuditRefreshControls({
  initialRefreshedAt,
}: {
  initialRefreshedAt: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [refreshedAt, setRefreshedAt] = useState(initialRefreshedAt);

  useEffect(() => {
    setRefreshedAt(initialRefreshedAt);
  }, [initialRefreshedAt]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      startTransition(() => {
        router.refresh();
        setRefreshedAt(new Date().toISOString());
      });
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [router]);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] text-gray-400">
      <span>Refreshed {formatRefreshTime(refreshedAt)}</span>
      <button
        type="button"
        className="btn btn-secondary px-4 py-2 text-xs"
        onClick={() => {
          startTransition(() => {
            router.refresh();
            setRefreshedAt(new Date().toISOString());
          });
        }}
        disabled={isPending}
      >
        <i className={`fa-solid ${isPending ? "fa-spinner fa-spin" : "fa-rotate-right"} mr-2`}></i>
        {isPending ? "Refreshing" : "Refresh"}
      </button>
    </div>
  );
}
