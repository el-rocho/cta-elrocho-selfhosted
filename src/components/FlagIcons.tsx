import React from 'react';

interface FlagProps {
  className?: string;
  size?: number;
}

// Bandera de España 🇪🇸 (SVG Vectorial)
export const FlagES: React.FC<FlagProps> = ({ className = '', size = 18 }) => {
  const height = Math.round(size * 0.72);
  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 750 500"
      className={className}
      style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
      aria-hidden="true"
    >
      <rect width="750" height="500" fill="#c60b1e" />
      <rect y="125" width="750" height="250" fill="#ffc400" />
    </svg>
  );
};

// Bandera de Reino Unido 🇬🇧 (Union Jack SVG Vectorial)
export const FlagGB: React.FC<FlagProps> = ({ className = '', size = 18 }) => {
  const height = Math.round(size * 0.72);
  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 60 30"
      className={className}
      style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
      aria-hidden="true"
    >
      <clipPath id="flag-gb-clip">
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <clipPath id="flag-gb-diag">
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      </clipPath>
      <g clipPath="url(#flag-gb-clip)">
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#00247d" strokeWidth="60" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#ffffff" strokeWidth="10" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#cf142b" strokeWidth="6" clipPath="url(#flag-gb-diag)" />
        <path d="M30,0 v30 M0,15 h60" stroke="#ffffff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#cf142b" strokeWidth="6" />
      </g>
    </svg>
  );
};
