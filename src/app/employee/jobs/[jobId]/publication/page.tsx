"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PublicationWorkflowCard } from "@/components/service-video/PublicationWorkflowCard";

export default function EmployeePublicationDecisionPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = String(params?.jobId || "").trim();

  return (
    <div className="reliance-grid-lines min-h-screen bg-[#050a13] px-4 py-8 text-white">
      <main className="mx-auto w-full max-w-4xl space-y-5">
        <Link href="/employee/jobs" className="inline-flex items-center gap-2 text-sm font-medium text-blue-200 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to assigned work
        </Link>
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase text-blue-200">Participant decision</p>
          <h1 className="text-2xl font-bold">Review Public use of your likeness or audio</h1>
          <p className="max-w-2xl text-sm text-slate-300">
            You are deciding only for your own appearance or audio. Declining does not change the completed service or its Private proof.
          </p>
        </header>
        {jobId ? <PublicationWorkflowCard role="employee" bookingId={jobId} /> : null}
      </main>
    </div>
  );
}
