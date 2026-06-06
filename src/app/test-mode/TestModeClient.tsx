"use client";

import { useEffect, useState } from "react";
import { typedFetch } from "@/lib/api";

type HealthResponse = {
  ok: boolean;
  mode: string;
  timestamp: string;
};

export default function TestModeClient() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchHealth() {
    try {
      setLoading(true);
      setError(null);
      const result = await typedFetch<HealthResponse>("/api/health");
      setData(result);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mode = process.env.NEXT_PUBLIC_API_MODE || "live";

  return (
    <div className="p-6 space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Internal diagnostics page. This is not a customer, vendor, or admin product workflow.
      </div>

      <div
        className={`p-2 text-center font-bold ${
          mode === "mock" ? "bg-yellow-400 text-black" : "bg-green-500 text-white"
        }`}
      >
        {mode.toUpperCase()} MODE
      </div>

      <div>
        {loading && <p>Loading health check...</p>}
        <p>API Endpoint: /api/health</p>
      </div>

      {error && <p className="text-red-600">Error: {error}</p>}
      {data && (
        <pre className="bg-gray-100 p-2 rounded">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}

      <button
        onClick={fetchHealth}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Test Again
      </button>
    </div>
  );
}
