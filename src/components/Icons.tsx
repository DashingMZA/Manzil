import type { SVGProps } from "react";

/**
 * Chhote inline SVG icons (24x24, stroke-based). Jaan-boojh kar koi icon
 * library nahi — extra dependency aur version-drift ka jhanjhat nahi.
 */
function Svg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export const ServerIcon = () => (
  <Svg>
    <rect x="2" y="2" width="20" height="8" rx="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" />
    <path d="M6 6h.01M6 18h.01" />
  </Svg>
);

export const SettingsIcon = () => (
  <Svg>
    <path d="M4 6h3M11 6h9" />
    <circle cx="9" cy="6" r="2" />
    <path d="M4 12h9M17 12h3" />
    <circle cx="15" cy="12" r="2" />
    <path d="M4 18h5M13 18h7" />
    <circle cx="11" cy="18" r="2" />
  </Svg>
);

export const HeartIcon = () => (
  <Svg>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </Svg>
);

export const InfoIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </Svg>
);

export const SunIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </Svg>
);

export const MoonIcon = () => (
  <Svg>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </Svg>
);

export const MonitorIcon = () => (
  <Svg>
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </Svg>
);

export const CopyIcon = () => (
  <Svg>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Svg>
);

/** Sidebar collapse/expand toggle — `pointLeft` ke hisaab se left ya right chevron. */
export const ChevronDoubleIcon = ({ pointLeft }: { pointLeft: boolean }) => (
  <Svg>
    {pointLeft ? (
      <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
    ) : (
      <path d="M13 17l5-5-5-5M6 17l5-5-5-5" />
    )}
  </Svg>
);
