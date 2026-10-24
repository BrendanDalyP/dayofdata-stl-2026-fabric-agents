/** SpaceParts mark: a hex nut (a part) on an orbit. */
export function BrandMark({ size = 30 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="SpaceParts">
            <defs>
                <linearGradient id="sp-g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#6aa8f5" />
                    <stop offset="1" stopColor="#2a78d6" />
                </linearGradient>
            </defs>
            <ellipse cx="16" cy="16" rx="14.5" ry="6" fill="none" stroke="#f0b429" strokeWidth="1.6" transform="rotate(-24 16 16)" />
            <path d="M16 6.5 24.2 11.25v9.5L16 25.5l-8.2-4.75v-9.5Z" fill="url(#sp-g)" />
            <circle cx="16" cy="16" r="3.4" fill="#0e1a2e" />
            <circle cx="28.4" cy="10.6" r="1.7" fill="#f0b429" />
        </svg>
    );
}
