// ============================================================
// LiquidGlass - Apple-style frosted glass wrapper component
// Based on liquid-glass-react, optimized for Kasm UI
// Wrap any content: <LiquidGlass>...</LiquidGlass>
// ============================================================

import { type CSSProperties, forwardRef, useCallback, useEffect, useId, useRef, useState } from 'react';
import { ShaderDisplacementGenerator, fragmentShaders } from './liquidGlassShaderUtils';
import { displacementMap, polarDisplacementMap, prominentDisplacementMap } from './liquidGlassUtils';

type GlassMode = 'standard' | 'polar' | 'prominent' | 'shader';

export interface LiquidGlassProps {
  children: React.ReactNode;
  /** Refraction intensity (default: 40) */
  displacementScale?: number;
  /** Backdrop blur in rem units (default: 0.06) */
  blurAmount?: number;
  /** Backdrop saturation % (default: 140) */
  saturation?: number;
  /** Chromatic aberration strength (default: 1.5) */
  aberrationIntensity?: number;
  /** Elastic squish on hover (default: 0.1, 0 = off) */
  elasticity?: number;
  /** Border radius in px (default: 12) */
  cornerRadius?: number;
  /** Refraction algorithm (default: 'standard') */
  mode?: GlassMode;
  /** Extra CSS class */
  className?: string;
  /** Inline style overrides */
  style?: CSSProperties;
  /** Override padding (default: '12px 16px') */
  padding?: string;
  /** Light overlay behind mouse (default: false) */
  overLight?: boolean;
  onClick?: () => void;
}

const getMap = (mode: GlassMode, shaderMapUrl?: string) => {
  switch (mode) {
    case 'polar': return polarDisplacementMap;
    case 'prominent': return prominentDisplacementMap;
    case 'shader': return shaderMapUrl || displacementMap;
    default: return displacementMap;
  }
};

const generateShaderMap = (w: number, h: number): string => {
  const gen = new ShaderDisplacementGenerator({ width: w, height: h, fragment: fragmentShaders.liquidGlass });
  const url = gen.updateShader();
  gen.destroy();
  return url;
};

/* ---------- SVG filter ---------- */
function GlassFilter({ id, scale, aberration, w, h, mode, shaderUrl }: {
  id: string; scale: number; aberration: number; w: number; h: number; mode: GlassMode; shaderUrl?: string;
}) {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
      <defs>
        <filter id={id} x="-35%" y="-35%" width="170%" height="170%" colorInterpolationFilters="sRGB">
          <feImage x="0" y="0" width="100%" height="100%" result="DMAP" href={getMap(mode, shaderUrl)} preserveAspectRatio="xMidYMid slice" />
          <feColorMatrix in="DMAP" type="matrix" values="0.3 0.3 0.3 0 0 0.3 0.3 0.3 0 0 0.3 0.3 0.3 0 0 0 0 0 1 0" result="EDGE" />
          <feComponentTransfer in="EDGE" result="EMASK">
            <feFuncA type="discrete" tableValues={`0 ${aberration * 0.05} 1`} />
          </feComponentTransfer>
          <feOffset in="SourceGraphic" dx="0" dy="0" result="CENTER" />
          <feDisplacementMap in="SourceGraphic" in2="DMAP" scale={scale * (mode === 'shader' ? 1 : -1)} xChannelSelector="R" yChannelSelector="B" result="RD" />
          <feColorMatrix in="RD" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="RC" />
          <feDisplacementMap in="SourceGraphic" in2="DMAP" scale={scale * ((mode === 'shader' ? 1 : -1) - aberration * 0.05)} xChannelSelector="R" yChannelSelector="B" result="GD" />
          <feColorMatrix in="GD" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="GC" />
          <feDisplacementMap in="SourceGraphic" in2="DMAP" scale={scale * ((mode === 'shader' ? 1 : -1) - aberration * 0.1)} xChannelSelector="R" yChannelSelector="B" result="BD" />
          <feColorMatrix in="BD" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="BC" />
          <feBlend in="GC" in2="BC" mode="screen" result="GB" />
          <feBlend in="RC" in2="GB" mode="screen" result="RGB" />
          <feGaussianBlur in="RGB" stdDeviation={Math.max(0.1, 0.5 - aberration * 0.1)} result="AB" />
          <feComposite in="AB" in2="EMASK" operator="in" result="EA" />
          <feComponentTransfer in="EMASK" result="INV">
            <feFuncA type="table" tableValues="1 0" />
          </feComponentTransfer>
          <feComposite in="CENTER" in2="INV" operator="in" result="CC" />
          <feComposite in="EA" in2="CC" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}

/* ---------- Main component ---------- */
const LiquidGlass = forwardRef<HTMLDivElement, LiquidGlassProps>((props, externalRef) => {
  const {
    children,
    displacementScale = 40,
    blurAmount = 0.06,
    saturation = 140,
    aberrationIntensity = 1.5,
    elasticity = 0.1,
    cornerRadius = 12,
    mode = 'standard',
    className = '',
    style = {},
    padding = '12px 16px',
    overLight = false,
    onClick,
  } = props;

  const filterId = useId();
  const glassRef = useRef<HTMLDivElement>(null);
  const [glassSize, setGlassSize] = useState({ width: 200, height: 60 });
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);
  const [shaderUrl, setShaderUrl] = useState('');

  // Merge refs
  const setRefs = useCallback((node: HTMLDivElement | null) => {
    (glassRef as any).current = node;
    if (typeof externalRef === 'function') externalRef(node);
    else if (externalRef) (externalRef as any).current = node;
  }, [externalRef]);

  // Measure size
  useEffect(() => {
    const el = glassRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setGlassSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Generate shader map
  useEffect(() => {
    if (mode === 'shader' && glassSize.width > 0) {
      setShaderUrl(generateShaderMap(glassSize.width, glassSize.height));
    }
  }, [mode, glassSize.width, glassSize.height]);

  // Mouse tracking
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = glassRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMouseOffset({
      x: ((e.clientX - rect.left - rect.width / 2) / rect.width) * 100,
      y: ((e.clientY - rect.top - rect.height / 2) / rect.height) * 100,
    });
  }, []);

  const isFirefox = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);

  // Elastic transform
  const tx = hovered ? mouseOffset.x * elasticity * 0.05 : 0;
  const ty = hovered ? mouseOffset.y * elasticity * 0.05 : 0;
  const sx = hovered ? 1 + Math.abs(mouseOffset.x / 100) * elasticity * 0.1 : 1;
  const sy = hovered ? 1 + Math.abs(mouseOffset.y / 100) * elasticity * 0.1 : 1;
  const transform = active && onClick
    ? 'scale(0.97)'
    : `translate(${tx}px, ${ty}px) scaleX(${sx.toFixed(4)}) scaleY(${sy.toFixed(4)})`;

  // Specular border gradient angle follows mouse
  const borderAngle = 135 + mouseOffset.x * 1.2;
  const borderOpacity = 0.15 + Math.abs(mouseOffset.x) * 0.003;

  return (
    <div
      ref={setRefs}
      className={`kasm-liquid-glass ${className}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        borderRadius: cornerRadius,
        transform,
        transition: 'transform 0.2s ease-out',
        willChange: 'transform',
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMouseOffset({ x: 0, y: 0 }); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      onClick={onClick}
    >
      {/* SVG filter definition (zero-size, hidden) */}
      <GlassFilter id={filterId} scale={overLight ? displacementScale * 0.5 : displacementScale} aberration={aberrationIntensity} w={glassSize.width} h={glassSize.height} mode={mode} shaderUrl={shaderUrl} />

      {/* Backdrop warp layer (gets the glass effect) */}
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: cornerRadius,
          filter: isFirefox ? undefined : `url(#${filterId})`,
          backdropFilter: `blur(${(overLight ? 12 : 4) + blurAmount * 32}px) saturate(${saturation}%)`,
          WebkitBackdropFilter: `blur(${(overLight ? 12 : 4) + blurAmount * 32}px) saturate(${saturation}%)`,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      />

      {/* Specular border highlight */}
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: cornerRadius,
          pointerEvents: 'none',
          mixBlendMode: 'screen',
          opacity: 0.25,
          padding: '1.5px',
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude' as any,
          boxShadow: '0 0 0 0.5px rgba(255,255,255,0.4) inset, 0 1px 3px rgba(255,255,255,0.2) inset',
          background: `linear-gradient(${borderAngle}deg, rgba(255,255,255,0) 0%, rgba(255,255,255,${borderOpacity}) 50%, rgba(255,255,255,0) 100%)`,
        }}
      />

      {/* Outer shadow */}
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: cornerRadius,
          pointerEvents: 'none',
          boxShadow: overLight
            ? '0 16px 70px rgba(0,0,0,0.5)'
            : '0 4px 20px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)',
        }}
      />

      {/* Children stay sharp above all glass layers */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding,
        }}
      >
        {children}
      </div>
    </div>
  );
});

LiquidGlass.displayName = 'LiquidGlass';
export default LiquidGlass;
export { LiquidGlass };
