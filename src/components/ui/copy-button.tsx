"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";

export function CopyButton({
  value,
  label = "Copy",
  className = "flex items-center gap-1 text-xs text-faint hover:text-muted",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button onClick={copy} className={className}>
      <Icon name={copied ? "Check" : "Copy"} size={12} />
      {copied ? "Copied" : label}
    </button>
  );
}
