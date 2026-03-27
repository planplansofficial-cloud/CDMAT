function Logo({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon
        points="50,5 93,27.5 93,72.5 50,95 7,72.5 7,27.5"
        stroke="#c9a84c"
        strokeWidth="3"
        fill="rgba(201,168,76,0.05)"
      />
      <rect x="35" y="30" width="30" height="35" rx="2" stroke="#c9a84c" strokeWidth="2" fill="none" />
      <line x1="35" y1="40" x2="65" y2="40" stroke="#c9a84c" strokeWidth="1.5" />
      <line x1="35" y1="48" x2="65" y2="48" stroke="#c9a84c" strokeWidth="1.5" />
      <line x1="35" y1="56" x2="65" y2="56" stroke="#c9a84c" strokeWidth="1.5" />
      <line x1="44" y1="58" x2="44" y2="68" stroke="#c9a84c" strokeWidth="2" />
      <line x1="56" y1="58" x2="56" y2="68" stroke="#c9a84c" strokeWidth="2" />
      <line x1="44" y1="68" x2="56" y2="68" stroke="#c9a84c" strokeWidth="2" />
      <path d="M50 30 L55 22 L60 30" stroke="#c9a84c" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export default Logo;
