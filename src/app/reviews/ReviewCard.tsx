"use client";
import React from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from '@/components/ui/tooltip';
import { Info } from "lucide-react";

export interface ReviewCardProps {
  review: any;
  isSelected: boolean;
  onSelect: () => void;
  onDetails: () => void;
  countdown: { hours: number; minutes: number; seconds: number } | null;
  timerColor: string;
  progress: number; // 0-100
}

export default function ReviewCard({ review: r, isSelected, onSelect, onDetails, countdown, timerColor, progress }: ReviewCardProps) {
  return (
    <Card className="p-4 shadow-md border hover:ring-2 hover:ring-blue-400 transition" tabIndex={0}>
      <div className="flex justify-between mb-2">
        <Tooltip content={r.status.charAt(0).toUpperCase() + r.status.slice(1)}>
          <Badge variant={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'destructive' : 'outline'}>{r.status}</Badge>
        </Tooltip>
        <input type="checkbox" checked={isSelected} onChange={onSelect} aria-label={`Select review ${r.id}`} />
      </div>
      { (r.isDup || r.isIPSpam) && <Badge variant="destructive" title="Duplicate or suspicious reviewer">⚠️ Suspicious Activity</Badge> }
      <div className="flex justify-center mb-2">
        <img src={r.mediaUrl} alt="Review media" loading="lazy" className="w-full h-32 object-cover rounded-md border mb-2" />
      </div>
      <div className="flex justify-center mb-2">
        <img src={r.reviewerType === 'vendor' ? r.vendorImage : r.userImage} alt={r.reviewerType === 'vendor' ? r.vendor : r.user} loading="lazy" className="w-12 h-12 rounded-full border" />
      </div>
      <div className="flex justify-between items-center mb-2">
        <Tooltip content={r.auto ? 'Auto-moderated' : 'Manually reviewed'}>
          <Badge variant={r.auto ? 'destructive' : 'secondary'}>{r.auto ? 'Auto' : 'Manual'}</Badge>
        </Tooltip>
        <Badge variant="outline">{r.rating}★</Badge>
      </div>
      {/* Countdown Timer + Progress Bar + Info Tooltip */}
      <div className={`mb-2 text-sm flex items-center gap-2 ${countdown ? timerColor : 'text-gray-400 font-semibold'}`}>
        {countdown
          ? <>
              <span>Auto review will apply in: {countdown.hours}h {countdown.minutes}m {countdown.seconds}s</span>
              <Tooltip content="If not manually reviewed, this review will be auto-reviewed after 72 hours."><Info className="w-4 h-4 text-blue-400 inline-block" /></Tooltip>
              {countdown.hours < 1 && <Badge variant="destructive">Expiring soon!</Badge>}
            </>
          : <span>Auto review applied</span>
        }
      </div>
      {countdown && <div className="w-full h-2 bg-gray-200 rounded mb-2 overflow-hidden"><div className={`h-2 rounded ${timerColor} bg-current`} style={{ width: `${progress}%`, backgroundColor: timerColor.includes('red') ? '#dc2626' : timerColor.includes('orange') ? '#f59e42' : '#6b7280' }} /></div>}
      <CardHeader className="py-1"><CardTitle>{r.content.length > 50 ? r.content.slice(0, 50) + '...' : r.content}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 truncate">{r.reviewerType === 'vendor' ? r.vendor : r.user}</p>
        <Button size="sm" className="mt-2 focus:outline-none focus:ring" onClick={onDetails} aria-label={`View details for review ${r.id}`}>Details</Button>
        {countdown && countdown.hours < 1 && <Button size="sm" variant="secondary" className="ml-2" onClick={onDetails}>Review Now</Button>}
      </CardContent>
    </Card>
  );
} 