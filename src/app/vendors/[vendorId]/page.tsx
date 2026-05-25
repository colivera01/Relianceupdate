'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Building2, Image as ImageIcon, ArrowLeft, Video } from 'lucide-react';

interface PublicService {
  serviceId: string;
  serviceName: string;
  serviceDescription: string;
  price: number;
  previewMediaUrl: string | null;
}

interface PublicMediaItem {
  mediaId: string;
  serviceId: string | null;
  title: string;
  mimeType: string;
  url: string;
  createdAt: string;
  isPrimaryProofVideo?: boolean;
}

interface PublicVendorPayload {
  success: boolean;
  vendor?: {
    vendorId: string;
    vendorName: string;
    businessType: string | null;
    category: string | null;
    bio: string | null;
    location: string | null;
    serviceAreas: string[];
    profilePhoto: string | null;
    rating?: number | null;
    reviewCount?: number | null;
  };
  publicServices?: PublicService[];
  publicMedia?: PublicMediaItem[];
  meta?: {
    serviceEligibilityRule?: string;
    reviewEligibilityRule?: string;
  };
  error?: string;
}

interface PublicVendorReview {
  reviewId: string;
  vendorId: string;
  rating: number;
  comment: string;
  createdAt: string;
  reviewerDisplayName: string;
}

export default function PublicVendorProfilePage() {
  const params = useParams();
  const vendorId = String(params?.vendorId || '');

  const [payload, setPayload] = useState<PublicVendorPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<PublicVendorReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!vendorId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/vendors/${vendorId}/public`, { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.success === false) {
          throw new Error(json?.error || `Failed to load vendor (${res.status})`);
        }
        setPayload(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load vendor profile');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [vendorId]);

  useEffect(() => {
    const loadReviews = async () => {
      if (!vendorId) return;
      setReviewsLoading(true);
      setReviewsError(null);
      try {
        const res = await fetch(`/api/vendors/${vendorId}/reviews/public`, { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.success === false) {
          throw new Error(json?.error || `Failed to load reviews (${res.status})`);
        }
        setReviews(Array.isArray(json?.reviews) ? json.reviews : []);
      } catch (err) {
        setReviewsError(err instanceof Error ? err.message : 'Failed to load public reviews');
        setReviews([]);
      } finally {
        setReviewsLoading(false);
      }
    };
    loadReviews();
  }, [vendorId]);

  const vendor = payload?.vendor || null;
  const services = payload?.publicServices || [];
  const media = payload?.publicMedia || [];
  const primaryProofVideo = useMemo(
    () =>
      media.find(
        (item) =>
          Boolean(item?.isPrimaryProofVideo) &&
          String(item?.mimeType || '').toLowerCase().startsWith('video/') &&
          Boolean(String(item?.url || '').trim())
      ) || null,
    [media]
  );

  const mediaByService = useMemo(() => {
    const map = new Map<string, PublicMediaItem[]>();
    for (const item of media) {
      if (!item.serviceId) continue;
      if (!map.has(item.serviceId)) map.set(item.serviceId, []);
      map.get(item.serviceId)!.push(item);
    }
    return map;
  }, [media]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/browse">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Browse
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Card className="animate-pulse"><CardContent className="h-28" /></Card>
            <Card className="animate-pulse"><CardContent className="h-44" /></Card>
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-6 text-red-700">
              {error}
            </CardContent>
          </Card>
        ) : !vendor ? (
          <Card>
            <CardContent className="p-6 text-gray-700">
              Public vendor profile not found.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">{vendor.vendorName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {vendor.category ? <Badge variant="outline">{vendor.category}</Badge> : null}
                  {vendor.businessType ? <Badge variant="outline">{vendor.businessType}</Badge> : null}
                </div>
                {vendor.location ? (
                  <p className="text-sm text-gray-700 flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    {vendor.location}
                  </p>
                ) : null}
                {vendor.bio ? <p className="text-sm text-gray-700">{vendor.bio}</p> : null}
                {typeof vendor.rating === 'number' && typeof vendor.reviewCount === 'number' ? (
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">{vendor.rating.toFixed(1)}★</span>{' '}
                    <span className="text-gray-500">
                      ({vendor.reviewCount} public aggregate review{vendor.reviewCount === 1 ? '' : 's'})
                    </span>
                  </p>
                ) : null}
                {vendor.serviceAreas?.length ? (
                  <p className="text-sm text-gray-600">
                    Service Areas: {vendor.serviceAreas.join(', ')}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Public Services</CardTitle>
              </CardHeader>
              <CardContent>
                {services.length === 0 ? (
                  <div className="text-sm text-gray-600">
                    No publicly listed services are available for this vendor yet.
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {services.map((service) => (
                      <div key={service.serviceId} className="border rounded-lg p-4 bg-white">
                        {service.previewMediaUrl ? (
                          <img
                            src={service.previewMediaUrl}
                            alt={service.serviceName}
                            className="w-full h-32 object-cover rounded mb-3"
                          />
                        ) : (
                          <div className="w-full h-32 rounded mb-3 bg-gray-100 flex items-center justify-center text-gray-500 text-sm">
                            <ImageIcon className="w-4 h-4 mr-1" />
                            No public preview
                          </div>
                        )}
                        <div className="font-semibold text-gray-900">{service.serviceName}</div>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{service.serviceDescription || 'No description available.'}</p>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-gray-900">
                            {service.previewMediaUrl ? 'Public proof preview' : 'Public service listing'}
                          </div>
                          <Link href={`/service/${service.serviceId}`}>
                            <Button size="sm">View Service</Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Proof of Completed Work</CardTitle>
              </CardHeader>
              <CardContent>
                {primaryProofVideo ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-emerald-700 text-white hover:bg-emerald-700">Primary proof</Badge>
                      <span className="text-sm text-gray-700">
                        This completed service video is the main proof clip shown to customers.
                      </span>
                    </div>
                    <video
                      src={primaryProofVideo.url}
                      className="w-full max-h-[360px] rounded border bg-black"
                      controls
                      preload="metadata"
                    />
                    <p className="text-sm text-gray-700">{primaryProofVideo.title || 'Completed service proof'}</p>
                  </div>
                ) : (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    No completed proof video is available yet for this vendor.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Public Media Gallery</CardTitle>
              </CardHeader>
              <CardContent>
                {media.length === 0 ? (
                  <div className="text-sm text-gray-600">No public media available.</div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {media.map((item) => (
                      <div key={item.mediaId} className="border rounded-lg overflow-hidden bg-white">
                        {String(item.mimeType || '').startsWith('video/') ? (
                          <video src={item.url} className="w-full h-28 object-cover" muted playsInline preload="metadata" />
                        ) : (
                          <img src={item.url} alt={item.title} className="w-full h-28 object-cover" />
                        )}
                        <div className="p-2 text-xs text-gray-700">
                          <div className="font-medium line-clamp-1">{item.title}</div>
                          {item.isPrimaryProofVideo ? (
                            <div className="mt-1 inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                              <Video className="h-3 w-3" />
                              Primary proof
                            </div>
                          ) : null}
                          {item.serviceId ? (
                            <div className="text-gray-500 mt-1 flex items-center">
                              <Building2 className="w-3 h-3 mr-1" />
                              {mediaByService.get(item.serviceId)?.length || 0} item(s) in service
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Public Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                {reviewsLoading ? (
                  <div className="text-sm text-gray-600">Loading public reviews...</div>
                ) : reviewsError ? (
                  <div className="text-sm text-red-700">{reviewsError}</div>
                ) : reviews.length === 0 ? (
                  <div className="text-sm text-gray-600">No public reviews are available yet.</div>
                ) : (
                  <div className="space-y-3">
                    {reviews.map((review) => (
                      <div key={review.reviewId} className="rounded-lg border p-3 bg-white">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-gray-900">
                            {review.rating}/5
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.comment || '-'}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          Reviewer: {review.reviewerDisplayName}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {payload?.meta?.serviceEligibilityRule ? (
              <div className="text-xs text-gray-500 space-y-1">
                <p>Note: {payload.meta.serviceEligibilityRule}</p>
                {payload?.meta?.reviewEligibilityRule ? (
                  <p>Reviews: {payload.meta.reviewEligibilityRule}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
