type PublicHeroArtworkProps = {
  serviceName?: string | null;
  vendorName?: string | null;
};

export function PublicHeroArtwork({
  serviceName = 'Reliance explainer',
  vendorName = 'Video coming soon',
}: PublicHeroArtworkProps) {
  return (
    <div className="relative h-[17rem] overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,#040913,#081120_52%,#0d1d36_100%)] sm:h-[18rem]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(36,107,255,0.24),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(53,214,165,0.16),transparent_16%)]" />

      <svg
        viewBox="0 0 720 420"
        className="absolute inset-0 h-full w-full opacity-[0.96]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="hero-panel-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10203a" />
            <stop offset="55%" stopColor="#0a1322" />
            <stop offset="100%" stopColor="#050a12" />
          </linearGradient>
          <linearGradient id="hero-cyan-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#246BFF" />
            <stop offset="100%" stopColor="#51BFFF" />
          </linearGradient>
          <linearGradient id="hero-emerald-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#35D6A5" />
            <stop offset="100%" stopColor="#1E8F77" />
          </linearGradient>
          <filter id="hero-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </defs>

        <rect x="72" y="84" width="326" height="250" rx="38" fill="url(#hero-panel-gradient)" />
        <rect x="412" y="78" width="220" height="264" rx="38" fill="#0a1322" opacity="0.9" />
        <rect x="96" y="232" width="278" height="92" rx="26" fill="#0b1525" stroke="#1f334f" strokeWidth="2" />
        <rect x="126" y="180" width="214" height="52" rx="22" fill="#142743" stroke="#274a74" strokeWidth="2" />
        <rect x="160" y="194" width="146" height="24" rx="12" fill="#09111e" />
        <path d="M330 162c26 0 44 12 58 31l-18 10c-10-14-22-20-38-20h-122v-21h120z" fill="url(#hero-cyan-gradient)" />
        <path d="M288 216c16 0 27 9 33 23l-15 8c-5-9-10-12-18-12h-56v-19h56z" fill="#7CC6FF" opacity="0.8" />
        <path d="M225 240h32v64h-32z" fill="#09111e" opacity="0.85" />
        <path d="M255 240h32v64h-32z" fill="#09111e" opacity="0.75" />
        <path d="M306 240h22v64h-22z" fill="#09111e" opacity="0.65" />
        <path d="M364 239h24v51c0 18-14 31-32 31h-16v-18h11c7 0 13-6 13-13v-51z" fill="#1e314b" />

        <circle cx="218" cy="124" r="30" fill="#101b2d" />
        <path d="M190 122c10-24 52-30 68-8-7 0-15 4-20 12-8-4-19-5-30-4-7 1-13 1-18 0z" fill="#1a2b45" />
        <path d="M198 156c16-9 44-9 60 0l28 48-46 20-58-24 16-44z" fill="#15253c" />
        <path d="M286 202c18 0 37 15 49 34l-18 14c-14-17-23-23-35-23l4-25z" fill="#1f3a5d" />
        <path d="M184 198c12 10 21 28 25 54l-22 6c-5-23-12-37-23-47l20-13z" fill="#1d3655" />
        <path d="M196 206l46 18-10 56h-35l-11-74z" fill="#243f64" />
        <path d="M218 160l14 48-26 10-13-34c-4-11 0-20 10-24l15 0z" fill="#19304c" />
        <path d="M292 208l30 22-20 26-36-19 26-29z" fill="#29517f" />
        <path d="M190 164l-20 18 14 28 18-14-12-32z" fill="#15304c" />
        <path d="M228 276h26l10 28h-48l12-28z" fill="#0d1727" />

        <rect x="444" y="104" width="156" height="78" rx="22" fill="#0d1728" stroke="#20344f" strokeWidth="2" />
        <rect x="444" y="196" width="156" height="58" rx="20" fill="#0d1728" stroke="#20344f" strokeWidth="2" />
        <rect x="444" y="268" width="156" height="50" rx="20" fill="#0d1728" stroke="#20344f" strokeWidth="2" />
        <rect x="468" y="126" width="108" height="14" rx="7" fill="url(#hero-cyan-gradient)" opacity="0.95" />
        <rect x="468" y="148" width="76" height="10" rx="5" fill="#32465f" />
        <rect x="468" y="216" width="88" height="10" rx="5" fill="#32465f" />
        <rect x="468" y="236" width="110" height="10" rx="5" fill="url(#hero-emerald-gradient)" opacity="0.85" />
        <rect x="468" y="288" width="76" height="10" rx="5" fill="#32465f" />
        <rect x="552" y="288" width="24" height="10" rx="5" fill="#f8b63c" />

        <circle cx="592" cy="102" r="58" fill="#2a66ff" opacity="0.18" filter="url(#hero-blur)" />
        <circle cx="496" cy="328" r="42" fill="#35d6a5" opacity="0.12" filter="url(#hero-blur)" />
      </svg>

      <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/72 backdrop-blur-md">
        Explainer Video
      </div>

      <div className="absolute right-5 top-5 rounded-full border border-white/10 bg-[rgba(6,12,23,0.72)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70 backdrop-blur-md">
        Coming Soon
      </div>

      <div className="absolute left-5 top-[4.8rem] max-w-[48%] pr-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/52">
          See how Reliance works
        </div>
        <div className="mt-2.5 font-display text-[1.18rem] font-semibold leading-[1.08] text-white sm:text-[1.34rem]">
          A short guide will live here.
        </div>
        <p className="mt-2.5 text-[13px] leading-5 text-white/68">
          This space is reserved for a future Reliance explainer video that shows customers how
          public proof, reviews, and Trust Score help them choose with confidence.
        </p>
      </div>

      <div className="absolute bottom-5 right-5 w-[198px] rounded-[22px] border border-white/10 bg-[rgba(6,11,21,0.78)] p-4 text-white backdrop-blur-xl sm:w-[210px]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/54">
          Future video
        </div>
        <div className="mt-2 text-base font-semibold leading-tight">{serviceName}</div>
        <div className="mt-1 text-sm text-white/60">{vendorName}</div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-white/76">
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
