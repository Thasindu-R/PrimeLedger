import { Sparkles, ArrowRight } from "lucide-react";

interface PromoBannerProps {
  headline: string;
  subtitle: string;
  ctaLabel: string;
  onCtaClick?: () => void;
}

export function PromoBanner({
  headline,
  subtitle,
  ctaLabel,
  onCtaClick,
}: PromoBannerProps) {
  return (
    <div className="rounded-2xl p-4 flex flex-col justify-between min-h-36 bg-gradient-to-br from-green-500 via-green-600 to-lime-700">
      {/* Top Section */}
      <div>
        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 bg-white/20 text-white text-xs font-medium px-2.5 py-1 rounded-full mb-2">
          <Sparkles size={12} />
          <span>New feature</span>
        </div>

        {/* Headline */}
        <h3 className="text-white font-bold text-lg leading-snug">
          {headline}
        </h3>

        {/* Subtitle */}
        <p className="text-green-100 text-xs mt-1.5 leading-relaxed">
          {subtitle}
        </p>
      </div>

      {/* Bottom Section */}
      <div className="mt-3">
        <button
          onClick={onCtaClick}
          className="bg-white text-green-700 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-green-50 transition-colors inline-flex items-center gap-2 self-start"
        >
          <span>{ctaLabel}</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
