"use client";

// Small client-side fetch wrapper that sends credentials (cookie) and
// throws on non-OK responses, returning parsed JSON.
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch<T = any>(
  url: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    ...init,
  });

  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data && String((data as any).error)) ||
      `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status, data);
  }
  return data as T;
}

function safeJsonParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

// CSV export helper — accepts rows as array of objects, downloads file.
export function exportCsv(
  filename: string,
  rows: Record<string, any>[],
  columns?: { key: string; label: string }[]
) {
  if (!rows.length) {
    rows = [{}];
  }
  const cols =
    columns ||
    Object.keys(rows[0]).map((k) => ({ key: k, label: k }));

  const escapeCell = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/[",\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const header = cols.map((c) => escapeCell(c.label)).join(",");
  const body = rows
    .map((r) => cols.map((c) => escapeCell(r?.[c.key])).join(","))
    .join("\n");

  const csv = header + "\n" + body;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Print a given DOM element by id (hides everything else via @media print .print-area).
export function printElement(areaId: string) {
  const el = document.getElementById(areaId);
  if (!el) {
    window.print();
    return;
  }
  // toggle a temporary print-area class on the element so @media print shows only it
  el.classList.add("print-area");
  const cleanup = () => {
    el.classList.remove("print-area");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}
