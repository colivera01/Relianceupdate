const HOMEPAGE_EXPLAINER_SRC =
  "/tutorials/homepage-explainer.mp4?v=20260701-approved-audio";

type PublicHeroArtworkProps = {
  serviceName?: string | null;
  vendorName?: string | null;
};

export function PublicHeroArtwork(_props: PublicHeroArtworkProps) {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,#040913,#081120_52%,#0d1d36_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(36,107,255,0.24),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(53,214,165,0.16),transparent_18%)]" />

      <div className="relative border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-white/10 bg-black/24 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/72 backdrop-blur-md">
            Explainer Video
          </div>
          <div className="inline-flex rounded-full border border-[var(--reliance-blue)]/28 bg-[var(--reliance-blue)]/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
            Reliance guide
          </div>
        </div>
      </div>

      <div className="relative p-3 sm:p-4">
        <div className="overflow-hidden rounded-[22px] border border-white/10 bg-black shadow-[0_24px_70px_rgba(0,0,0,0.36)]">
          <video
            className="aspect-video w-full bg-black"
            controls
            playsInline
            preload="metadata"
            src={HOMEPAGE_EXPLAINER_SRC}
            title="How Reliance helps customers compare service proof"
          >
            Your browser does not support embedded video playback.
          </video>
        </div>
      </div>

      <div className="relative grid gap-3 px-5 pb-5 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6 sm:pb-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-white/52">
            See how Reliance works
          </div>
          <div className="mt-2 text-xl font-semibold leading-tight text-white sm:text-2xl">
            A short guide to Reliance
          </div>
          <div className="mt-1 text-base text-white/60">
            Service proof, reviews, and Trust Score
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-white/76 sm:w-[260px]">
          <div className="rounded-2xl border border-white/8 bg-white/6 px-2 py-2">
            Reviews
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/6 px-2 py-2">
            Videos
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/6 px-2 py-2">
            Trust
          </div>
        </div>
      </div>
    </div>
  );
}
