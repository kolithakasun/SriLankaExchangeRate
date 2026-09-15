import { useId } from "react";

type BrandLogoProps = {
  variant?: "inline" | "mark";
  className?: string;
  markClassName?: string;
  textClassName?: string;
  title?: string;
};

function ExchangeMark({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const greenId = `erlk-g-${uid}`;
  const blueId = `erlk-b-${uid}`;

  return (
    <svg
      viewBox="0 0 128 128"
      className={className}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={greenId} x1="10%" y1="60%" x2="95%" y2="15%">
          <stop offset="0%" stopColor="#1B7A34" />
          <stop offset="45%" stopColor="#3DD63A" />
          <stop offset="100%" stopColor="#9AFF3D" />
        </linearGradient>
        <linearGradient id={blueId} x1="90%" y1="35%" x2="5%" y2="80%">
          <stop offset="0%" stopColor="#071A45" />
          <stop offset="40%" stopColor="#1650C8" />
          <stop offset="100%" stopColor="#3B86FF" />
        </linearGradient>
      </defs>

      {/* Top green exchange arrow */}
      <path
        fill={`url(#${greenId})`}
        d="M22 66
           C24 36 48 18 76 20
           C90 21 101 28 108 40
           L112 34
           L118 52
           L100 50
           L104 44
           C96 32 86 28 74 27
           C52 25 36 38 34 62
           Z"
      />

      {/* Bottom blue exchange arrow */}
      <path
        fill={`url(#${blueId})`}
        d="M106 62
           C104 92 80 110 52 108
           C38 107 27 100 20 88
           L16 94
           L10 76
           L28 78
           L24 84
           C32 96 42 100 54 101
           C76 103 92 90 94 66
           Z"
      />

      <text
        x="64"
        y="80"
        textAnchor="middle"
        fontFamily="Manrope, ui-sans-serif, system-ui, sans-serif"
        fontSize="58"
        fontWeight="800"
        fill="#0A1E4A"
      >
        $
      </text>
    </svg>
  );
}

export function BrandLogo({
  variant = "inline",
  className = "",
  markClassName = "h-9 w-9",
  textClassName = "text-base sm:text-lg",
  title = "ExchangeRateLK",
}: BrandLogoProps) {
  const wordmark = (
    <span className={`font-extrabold tracking-tight ${textClassName}`}>
      <span className="text-[#0A1E4A] dark:text-[#e8eefc]">ExchangeRate</span>
      <span className="bg-gradient-to-r from-[#1B7A34] via-[#3DD63A] to-[#9AFF3D] bg-clip-text text-transparent">
        LK
      </span>
    </span>
  );

  if (variant === "mark") {
    return (
      <span className={`inline-flex ${className}`} title={title}>
        <ExchangeMark className={markClassName} />
        <span className="sr-only">{title}</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 sm:gap-3 ${className}`}>
      <ExchangeMark
        className={`shrink-0 dark:[&_text]:fill-[#e8eefc] ${markClassName}`}
      />
      {wordmark}
    </span>
  );
}
