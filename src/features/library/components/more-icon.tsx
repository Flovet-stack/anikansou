/**
 * Hugeicons "more horizontal" (decision 0003), drawn static: icons-animated
 * has no animated version, and three dots don't need one.
 */
export function MoreIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M11.992 12H12.001M18 12H18.009M6 12H6.00898"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
