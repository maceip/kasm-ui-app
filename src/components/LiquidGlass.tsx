// ============================================================
// LiquidGlass - Apple-style frosted glass wrapper component
// SolidJS port
// ============================================================

import { createSignal, createEffect, onCleanup, type JSX } from 'solid-js';
import { ShaderDisplacementGenerator, fragmentShaders } from './liquidGlassShaderUtils';
import { displacementMap, polarDisplacementMap, prominentDisplacementMap } from './liquidGlassUtils';

type GlassMode = 'standard' | 'polar' | 'prominent' | 'shader';

export interface LiquidGlassProps {
  children: JSX.Element;
  displacementScale?: number;
  blurAmount?: number;
  saturation?: number;
  aberrationIntensity?: number;
  elasticity?: number;
  cornerRadius?: number;
  mode?: GlassMode;
  className?: string;
  style?: JSX.CSSProperties;
  padding?: string;
  overLight?: boolean;
  onClick?: () => void;
  ref?: HTMLDivElement | ((el: HTMLDivElement) => void);
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

let nextGlassId = 0;

function GlassFilter(props: {
  id: string; scale: number; aberration: number; w: number; h: number; mode: GlassMode; shaderUrl?: string;
}) {
  return (
    <svg style={{ position: 'absolute', width: '0px', height: '0px' }} aria-hidden="true">
      <defs>
        <filter id={props.id} x="-35%" y="-35%" width="170%" height="170%" color-interpolation-filters="sRGB">
          <feImage x="0" y="0" width="100%" height="100%" result="DMAP" href={getMap(props.mode, props.shaderUrl)} preserveAspectRatio="xMidYMid slice" />
          <feColorMatrix in="DMAP" type="matrix" values="0.3 0.3 0.3 0 0 0.3 0.3 0.3 0 0 0.3 0.3 0.3 0 0 0 0 0 1 0" result="EDGE" />
          <feComponentTransfer in="EDGE" result="EMASK">
            <feFuncA type="discrete" tableValues={`0 ${props.aberration * 0.05} 1`} />
          </feComponentTransfer>
          <feOffset in="SourceGraphic" dx="0" dy="0" result="CENTER" />
          <feDisplacementMap in="SourceGraphic" in2="DMAP" scale={props.scale * (props.mode === 'shader' ? 1 : -1)} xChannelSelector="R" yChannelSelector="B" result="RD" />
          <feColorMatrix in="RD" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="RC" />
          <feDisplacementMap in="SourceGraphic" in2="DMAP" scale={props.scale * ((props.mode === 'shader' ? 1 : -1) - props.aberration * 0.05)} xChannelSelector="R" yChannelSelector="B" result="GD" />
          <feColorMatrix in="GD" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="GC" />
          <feDisplacementMap in="SourceGraphic" in2="DMAP" scale={props.scale * ((props.mode === 'shader' ? 1 : -1) - props.aberration * 0.1)} xChannelSelector="R" yChannelSelector="B" result="BD" />
          <feColorMatrix in="BD" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="BC" />
          <feBlend in="GC" in2="BC" mode="screen" result="GB" />
          <feBlend in="RC" in2="GB" mode="screen" result="RGB" />
          <feGaussianBlur in="RGB" stdDeviation={Math.max(0.1, 0.5 - props.aberration * 0.1)} result="AB" />
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

export function LiquidGlass(props: LiquidGlassProps) {
  const displacementScale = () => props.displacementScale ?? 40;
  const blurAmount = () => props.blurAmount ?? 0.06;
  const saturation = () => props.saturation ?? 140;
  const aberrationIntensity = () => props.aberrationIntensity ?? 1.5;
  const elasticity = () => props.elasticity ?? 0.1;
  const cornerRadius = () => props.cornerRadius ?? 12;
  const mode = () => props.mode ?? 'standard';
  const padding = () => props.padding ?? '12px 16px';
  const overLight = () => props.overLight ?? false;

  const filterId = `glass-${++nextGlassId}`;
  let glassRef: HTMLDivElement | undefined;
  const [glassSize, setGlassSize] = createSignal({ width: 200, height: 60 });
  const [mouseOffset, setMouseOffset] = createSignal({ x: 0, y: 0 });
  const [hovered, setHovered] = createSignal(false);
  const [active, setActive] = createSignal(false);
  const [shaderUrl, setShaderUrl] = createSignal('');

  const setRefs = (node: HTMLDivElement) => {
    glassRef = node;
    if (typeof props.ref === 'function') props.ref(node);
  };

  // Measure size
  createEffect(() => {
    if (!glassRef) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setGlassSize({ width, height });
    });
    ro.observe(glassRef);
    onCleanup(() => ro.disconnect());
  });

  // Generate shader map
  createEffect(() => {
    if (mode() === 'shader' && glassSize().width > 0) {
      const url = generateShaderMap(glassSize().width, glassSize().height);
      setShaderUrl(url);
    }
  });

  const handleMouseMove = (e: MouseEvent) => {
    if (!glassRef) return;
    const rect = glassRef.getBoundingClientRect();
    setMouseOffset({
      x: ((e.clientX - rect.left - rect.width / 2) / rect.width) * 100,
      y: ((e.clientY - rect.top - rect.height / 2) / rect.height) * 100,
    });
  };

  const isFirefox = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);
  const isTouchDevice = typeof navigator !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  const transform = () => {
    if (active() && props.onClick) return 'scale(0.97)';
    const mo = mouseOffset();
    const el = elasticity();
    const tx = hovered() ? mo.x * el * 0.05 : 0;
    const ty = hovered() ? mo.y * el * 0.05 : 0;
    const sx = hovered() ? 1 + Math.abs(mo.x / 100) * el * 0.1 : 1;
    const sy = hovered() ? 1 + Math.abs(mo.y / 100) * el * 0.1 : 1;
    return `translate(${tx}px, ${ty}px) scaleX(${sx.toFixed(4)}) scaleY(${sy.toFixed(4)})`;
  };

  const borderAngle = () => 135 + mouseOffset().x * 1.2;
  const borderOpacity = () => 0.15 + Math.abs(mouseOffset().x) * 0.003;

  return (
    <div
      ref={setRefs}
      class={`kasm-liquid-glass ${props.className || ''}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        "border-radius": `${cornerRadius()}px`,
        transform: transform(),
        transition: 'transform 0.2s ease-out',
        "will-change": 'transform',
        cursor: props.onClick ? 'pointer' : undefined,
        ...props.style,
      }}
      onMouseMove={!isTouchDevice ? handleMouseMove : undefined}
      onMouseEnter={!isTouchDevice ? () => setHovered(true) : undefined}
      onMouseLeave={!isTouchDevice ? () => { setHovered(false); setMouseOffset({ x: 0, y: 0 }); } : undefined}
      onPointerDown={() => setActive(true)}
      onPointerUp={() => setActive(false)}
      onClick={props.onClick}
    >
      {!isTouchDevice && <GlassFilter
        id={filterId}
        scale={overLight() ? displacementScale() * 0.5 : displacementScale()}
        aberration={aberrationIntensity()}
        w={glassSize().width}
        h={glassSize().height}
        mode={mode()}
        shaderUrl={shaderUrl()}
      />}

      <span
        style={{
          position: 'absolute',
          inset: '0',
          "border-radius": `${cornerRadius()}px`,
          filter: (isFirefox || isTouchDevice) ? undefined : `url(#${filterId})`,
          "backdrop-filter": `blur(${(overLight() ? 12 : 4) + blurAmount() * 32}px) saturate(${saturation()}%)`,
          "-webkit-backdrop-filter": `blur(${(overLight() ? 12 : 4) + blurAmount() * 32}px) saturate(${saturation()}%)`,
          overflow: 'hidden',
          "pointer-events": 'none',
        }}
      />

      <span
        style={{
          position: 'absolute',
          inset: '0',
          "border-radius": `${cornerRadius()}px`,
          "pointer-events": 'none',
          "mix-blend-mode": 'screen',
          opacity: 0.25,
          padding: '1.5px',
          "-webkit-mask": 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          "-webkit-mask-composite": 'xor',
          "mask-composite": 'exclude',
          "box-shadow": '0 0 0 0.5px rgba(255,255,255,0.4) inset, 0 1px 3px rgba(255,255,255,0.2) inset',
          background: `linear-gradient(${borderAngle()}deg, rgba(255,255,255,0) 0%, rgba(255,255,255,${borderOpacity()}) 50%, rgba(255,255,255,0) 100%)`,
        }}
      />

      <span
        style={{
          position: 'absolute',
          inset: '0',
          "border-radius": `${cornerRadius()}px`,
          "pointer-events": 'none',
          "box-shadow": overLight()
            ? '0 16px 70px rgba(0,0,0,0.5)'
            : '0 4px 20px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)',
        }}
      />

      <div
        style={{
          position: 'relative',
          "z-index": 1,
          padding: padding(),
        }}
      >
        {props.children}
      </div>
    </div>
  );
}

export default LiquidGlass;
