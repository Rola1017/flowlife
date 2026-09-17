"use client";

import { useEffect, useState } from "react";
import { TH } from "@/lib/theme";
import { getCloudWriteFailures, subscribeCloudWriteFailures } from "@/lib/cloudWrite";

export function CloudSyncBadge() {
  const [fail, setFail] = useState(() => getCloudWriteFailures());
  const [open, setOpen] = useState(false);

  useEffect(() => subscribeCloudWriteFailures(() => setFail(getCloudWriteFailures())), []);

  if (fail.count <= 0) return null;

  return (
    <div style={{ marginTop: 6 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          textAlign: "left",
          border: `1px solid ${TH.red}66`,
          background: TH.red + "18",
          color: TH.red,
          borderRadius: 8,
          padding: "5px 8px",
          fontSize: 10,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        ⚠️ 有 {fail.count} 筆資料未能同步到雲端
      </button>
      {open && fail.lastError && (
        <div style={{ fontSize: 9, color: TH.red, marginTop: 4, lineHeight: 1.4, wordBreak: "break-all" }}>
          {fail.lastError}
        </div>
      )}
    </div>
  );
}
