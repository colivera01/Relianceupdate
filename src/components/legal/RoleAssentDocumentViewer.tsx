"use client";

import { Download, FileText } from "lucide-react";

type ContentItem = {
  contentKey: string;
  version: string;
  contentHash: string;
  contentSnapshot: string;
  audienceRole: string;
};

function labelFor(key: string) {
  if (key === "reliance.terms-of-use") return "Reliance Terms of Use";
  if (key === "reliance.privacy-notice") return "Reliance Privacy Notice";
  if (key === "reliance.vendor-role-assent") return "Vendor Organization Agreement";
  if (key === "reliance.employee-accountless-role-assent") return "Accountless Employee Service Order Notice";
  return key;
}

export function RoleAssentDocumentViewer(props: {
  content: ContentItem[];
  packageKey: string;
}) {
  function downloadExactVersions() {
    const body = props.content
      .map(
        (item) =>
          `${labelFor(item.contentKey)}\nVersion: ${item.version}\nSHA-256: ${item.contentHash}\n\n${item.contentSnapshot}`,
      )
      .join("\n\n========================================\n\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${props.packageKey}-exact-versions.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      {props.content.map((item) => (
        <details key={item.contentKey} className="border-y border-slate-300 py-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-950">
            <FileText className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <span>{labelFor(item.contentKey)}</span>
            <span className="ml-auto text-xs font-normal text-slate-500">Review exact version</span>
          </summary>
          <div className="mt-3 max-h-80 overflow-y-auto border-l-2 border-blue-200 pl-4">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-slate-700">
              {item.contentSnapshot}
            </pre>
          </div>
          <p className="mt-2 break-all text-xs text-slate-500">
            Version {item.version} - SHA-256 {item.contentHash}
          </p>
        </details>
      ))}
      <button
        type="button"
        onClick={downloadExactVersions}
        className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Download the exact versions shown
      </button>
    </div>
  );
}
