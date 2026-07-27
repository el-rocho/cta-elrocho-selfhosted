import React from 'react';
import logoSvgRaw from '../assets/app-logo.svg?raw';

interface AppLogoProps {
  className?: string;
  style?: React.CSSProperties;
}

const logoMarkup = logoSvgRaw
  .replace(/<\?xml[^>]*\?>/i, '')
  .replace(/<!DOCTYPE[^>]*>/i, '')
  .replace('<svg ', '<svg aria-hidden="true" focusable="false" ')
  .trim();

export const AppLogo: React.FC<AppLogoProps> = ({
  className = 'w-full h-full',
  style,
}) => (
  <span
    role="img"
    aria-label="Control Tensión Arterial Selfhosted"
    className={className}
    style={style}
    dangerouslySetInnerHTML={{ __html: logoMarkup }}
  />
);
