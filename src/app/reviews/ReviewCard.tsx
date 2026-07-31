"use client";
import React from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SimpleTooltip from "@/components/ui/tooltip";

export interface ReviewCardProps {
  review: any;
  isSelected: boolean;
  onSelect: () => void;
  onDetails: () => void;
}

export default function ReviewCard({ review: r, isSelected, onSelect, onDetails }: ReviewCardProps) {
  return (
    <Card className="p-4 shadow-md border hover:ring-2 hover:ring-blue-400 transition" tabIndex={0}>
      <div className="flex justify-between mb-2">
        <SimpleTooltip content={r.status.charAt(0).toUpperCase() + r.status.slice(1)}>
          <Badge variant={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'destructive' : 'outline'}>{r.status}</Badge>
        </SimpleTooltip>
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
        <SimpleTooltip content={r.auto ? 'Auto-moderated' : 'Manually reviewed'}>
          <Badge variant={r.auto ? 'destructive' : 'secondary'}>{r.auto ? 'Auto' : 'Manual'}</Badge>
        </SimpleTooltip>
        <Badge variant="outline">{r.rating}★</Badge>
      </div>
      <CardHeader className="py-1"><CardTitle>{r.content.length > 50 ? r.content.slice(0, 50) + '...' : r.content}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 truncate">{r.reviewerType === 'vendor' ? r.vendor : r.user}</p>
        <Button size="sm" className="mt-2 focus:outline-none focus:ring" onClick={onDetails} aria-label={`View details for review ${r.id}`}>Details</Button>
      </CardContent>
    </Card>
  );
}
