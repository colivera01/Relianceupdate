'use client';

import Link from "next/link";
import { ArrowLeft, Clock, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DevicePairPage() {
  return (
    <div className="reliance-operator-shell reliance-grid-lines flex min-h-screen items-center justify-center px-4 py-10 text-white">
      <Card className="w-full max-w-xl border border-blue-400/20 bg-slate-950/85 text-white shadow-[0_24px_90px_rgba(3,8,20,0.38)]">
        <CardHeader className="space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-300/20 bg-blue-500/12">
            <Smartphone className="h-6 w-6 text-blue-100" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-white">Device pairing is not active yet</CardTitle>
            <CardDescription className="mt-2 text-slate-300">
              Reliance will support direct phone and headset pairing in a future release. For now, employees can use
              their assigned job links to capture stage videos without pairing a device first.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-2xl border border-blue-300/20 bg-blue-500/10 p-4">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 text-blue-100" />
              <div>
                <p className="font-semibold text-white">Future-state workflow</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  We kept the route reserved so the feature can return later, but the setup fields are hidden until
                  the full pairing experience is ready.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="bg-[var(--reliance-blue)] text-white hover:bg-[#1a58db]">
              <Link href="/employee/jobs">Open Employee Jobs</Link>
            </Button>
            <Button asChild variant="outline" className="border-blue-300/20 bg-slate-900 text-white hover:bg-slate-800">
              <Link href="/help">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go to Help
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
