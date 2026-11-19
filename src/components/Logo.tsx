// Logo oficial (public/brand, pacote rumo-brand-assets-v1) nas duas versões: a escura no tema claro e a clara no escuro.
// Nunca redesenhar o logo: só estes SVGs.
export function Logo({ forma, alt = "", className = "" }: { forma: "simbolo" | "horizontal"; alt?: string; className?: string }) {
  const base = forma === "simbolo" ? "/brand/rumo-symbol" : "/brand/rumo-logo-horizontal";
  return (
    <>
      <img src={`${base}.svg`} alt={alt} className={`${className} logo-light`.trim()} />
      <img src={`${base}-light.svg`} alt={alt} className={`${className} logo-dark`.trim()} />
    </>
  );
}
