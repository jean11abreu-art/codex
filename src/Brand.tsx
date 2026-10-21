/** Vector rendering of the supplied Premium Flex wordmark; no external assets. */
export function PremiumFlexLogo() {
  return <svg className="premium-flex-logo" viewBox="0 0 456 152" role="img" aria-label="Premium Flex — Mangueiras & Conexões">
    <text x="10" y="85" fill="#202020" fontFamily="Arial, Helvetica, sans-serif" fontSize="64" fontWeight="900" textLength="291" lengthAdjust="spacingAndGlyphs">Premium</text>
    <text x="315" y="85" fill="#df8b2c" fontFamily="Arial, Helvetica, sans-serif" fontSize="64" fontWeight="900" textLength="130" lengthAdjust="spacingAndGlyphs">Flex</text>
    <path d="M 42 98 H 444 L 430 120 H 28 Z" fill="#df8b2c" />
    <text x="68" y="114" fill="#fff" fontFamily="Arial, Helvetica, sans-serif" fontSize="18" fontWeight="700" letterSpacing="3" textLength="335" lengthAdjust="spacingAndGlyphs">MANGUEIRAS &amp; CONEXÕES</text>
  </svg>;
}

export function BrazilFlag() {
  const stars = [[14.4,6.5],[10.5,10],[12,10.4],[13,11],[9.5,11.1],[11,12.1],[12.3,12.8],[13.8,11.6],[14.4,10.8],[15.4,11.3],[16.2,10.3],[17.6,10.7],[17,11.8],[18.6,11.6],[16,12.6],[14.8,13.4],[13.6,13.3],[12.8,14],[14.6,14.5],[15.8,14],[17,13.5],[18,12.9],[11.6,13.5],[10.4,12.8],[13.8,12],[15.2,12],[16.9,12.7]];
  return <span className="brazil-flag" title="Brasil">
    <svg viewBox="0 0 28 20" role="img" aria-label="Bandeira do Brasil">
      <defs><clipPath id="brasil-disc"><circle cx="14" cy="10" r="5" /></clipPath></defs>
      <path fill="#009b3a" d="M0 0h28v20H0z" />
      <path fill="#ffdf00" d="m14 2 11.3 8L14 18 2.7 10Z" />
      <circle cx="14" cy="10" r="5" fill="#002776" />
      <g clipPath="url(#brasil-disc)">
        <path d="M8 8.5c4.2-1 8.4.6 12.1 3.2" fill="none" stroke="#fff" strokeWidth=".85" />
        <text x="10.3" y="8.7" fill="#009b3a" fontFamily="Arial,sans-serif" fontSize=".7" fontWeight="700" transform="rotate(14 10.3 8.7)">ORDEM E PROGRESSO</text>
        {stars.map(([x,y],index) => <circle key={index} cx={x} cy={y} r={index % 4 === 0 ? '.17' : '.12'} fill="#fff" />)}
      </g>
    </svg>
  </span>;
}
