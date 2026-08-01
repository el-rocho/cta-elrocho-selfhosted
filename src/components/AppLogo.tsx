import React from 'react';
import logoLightSvgRaw from '../assets/app-logo.svg?raw';
import logoDarkSvgRaw from '../assets/app-logo-dark.svg?raw';

interface AppLogoProps {
  className?: string;
  style?: React.CSSProperties;
}

function prepareLogoMarkup(svg: string, variantClass: string): string {
  return svg
    .replace(/<\?xml[^>]*\?>/i, '')
    .replace(/<!DOCTYPE[^>]*>/i, '')
    .replace('<svg ', `<svg class="app-logo-variant ${variantClass}" aria-hidden="true" focusable="false" `)
    .trim();
}

const logoMarkup = [
  prepareLogoMarkup(logoLightSvgRaw, 'app-logo-light'),
  prepareLogoMarkup(logoDarkSvgRaw, 'app-logo-dark'),
].join('');

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
