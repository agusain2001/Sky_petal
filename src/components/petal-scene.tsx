"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  PerformanceMonitor,
  useTexture,
} from "@react-three/drei";
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DoubleSide,
  DataTexture,
  BufferAttribute,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  PlaneGeometry,
  MathUtils,
  type Group,
  type Mesh,
  type MeshPhysicalMaterial,
  type ShaderMaterial,
} from "three";

type Mode = "flower" | "silk" | "petals" | "hero";
type ScrollProgress = { get: () => number };
type AnimationControl = { current: boolean };

function makeSilkTexture() {
  const width = 128,
    height = 128;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const grain = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const value =
        140 +
        Math.sin(x * 1.7 + y * 0.04) * 28 +
        (grain - Math.floor(grain) - 0.5) * 35;
      const index = (y * width + x) * 4;
      pixels[index] = pixels[index + 1] = pixels[index + 2] = value;
      pixels[index + 3] = 255;
    }
  }
  const texture = new DataTexture(pixels, width, height, RGBAFormat);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(2, 5);
  texture.needsUpdate = true;
  return texture;
}

// A high-detail image-backed relief keeps the hero's art direction intact while
// adding genuine mesh depth, cursor perspective and a scroll-controlled bloom.
// The separate bloom viewer uses fully procedural petal geometry.
function HeroRelief({ control }: { control: AnimationControl }) {
  const texture = useTexture("/images/hero-softness-v2.webp");
  useEffect(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
  }, [texture]);
  const material = useRef<ShaderMaterial>(null);
  const mesh = useRef<Mesh>(null);
  const { viewport, size, invalidate } = useThree();
  const elapsed = useRef(0);
  const scroll = useRef(0);
  const uniforms = useMemo(
    () => ({
      uImage: { value: texture },
      uAspect: { value: 1.5 },
      uImageAspect: { value: texture.image.width / texture.image.height },
      uDepth: { value: 0.06 },
      uTime: { value: 0 },
    }),
    [texture],
  );
  useEffect(() => {
    uniforms.uAspect.value = size.width / size.height;
    invalidate();
  }, [size.width, size.height, uniforms, invalidate]);
  useEffect(() => {
    const update = () => {
      scroll.current = Math.min(
        window.scrollY / Math.max(window.innerHeight, 1),
        1,
      );
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  useFrame(({ pointer }, delta) => {
    if (!mesh.current || !material.current || control.current) return;
    elapsed.current += Math.min(delta, 0.04);
    uniforms.uAspect.value = size.width / size.height;
    uniforms.uTime.value = elapsed.current;
    uniforms.uDepth.value = 0.06 + scroll.current * 0.06;
    mesh.current.rotation.y = MathUtils.damp(
      mesh.current.rotation.y,
      pointer.x * 0.008 + scroll.current * 0.006,
      2,
      delta,
    );
    mesh.current.rotation.x = MathUtils.damp(
      mesh.current.rotation.x,
      pointer.y * 0.006,
      2,
      delta,
    );
  });
  return (
    <mesh
      ref={mesh}
      scale={[viewport.width * 1.015, viewport.height * 1.015, 1]}
    >
      <planeGeometry args={[1, 1, 100, 70]} />
      <shaderMaterial
        toneMapped={false}
        ref={material}
        transparent
        uniforms={uniforms}
        vertexShader={`
    uniform sampler2D uImage;
    uniform float uAspect;
    uniform float uImageAspect;
    uniform float uDepth;
    uniform float uTime;
    varying vec2 vUv;
    vec2 cover(vec2 p) {
      if(uAspect > uImageAspect) p.y = (p.y - 0.5) * (uImageAspect / uAspect) + 0.5;
      else {
        float scale = uAspect / uImageAspect;
        p.x = p.x * scale + (1.0 - scale) * 0.75;
      }
      return p;
    }
    void main() {
      vUv = cover(uv);
      vec3 p = position;
      vec3 color = texture2D(uImage, vUv).rgb;
      float depth = (1.0 - dot(color, vec3(0.299,0.587,0.114))) * smoothstep(0.28,0.58,uv.x);
      p.z += depth * uDepth + sin(uTime * 0.35 + uv.y * 4.0) * depth * 0.012;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
    }`}
        fragmentShader={`
    uniform sampler2D uImage;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(uImage,vUv);
      float alpha = smoothstep(0.28,0.45,vUv.x);
      gl_FragColor = vec4(color.rgb,alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`}
      />
    </mesh>
  );
}

function makePetal() {
  const geometry = new PlaneGeometry(2, 1, 32, 40);
  const positions = geometry.attributes.position;
  const shades = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const u = positions.getX(i);
    const v = positions.getY(i) + 0.5;
    const width = Math.pow(Math.sin(Math.PI * v), 0.65) * 0.84 + 0.035;
    const shade = 0.58 + Math.pow(v, 0.45) * 0.42;
    shades[i * 3] = shades[i * 3 + 1] = shades[i * 3 + 2] = shade;
    positions.setXYZ(
      i,
      u * width,
      v * 2.25 + Math.cos(u * Math.PI) * 0.1 * v,
      0.9 * v * v +
        Math.sin(v * Math.PI * 2) * 0.21 +
        u * u * 0.42 * Math.sin(Math.PI * v) +
        Math.sin(v * 9 + u * 3) * 0.065 * v +
        Math.pow(Math.abs(u), 4) * Math.sin(v * 19) * 0.055,
    );
  }
  geometry.setAttribute("color", new BufferAttribute(shades, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function Bloom({
  control,
  progress,
}: {
  control: AnimationControl;
  progress?: ScrollProgress;
}) {
  const group = useRef<Group>(null);
  const petals = useRef<Group>(null);
  const time = useRef(0);
  const geometry = useMemo(makePetal, []);
  const silkTexture = useMemo(makeSilkTexture, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => silkTexture.dispose(), [silkTexture]);
  useFrame(({ pointer }, delta) => {
    if (!group.current || !petals.current || control.current) return;
    time.current += Math.min(delta, 0.04);
    const t = time.current;
    const bloom = Math.min(t / 2.4, 1);
    const unfold = progress?.get() ?? 0;
    group.current.rotation.x = MathUtils.damp(
      group.current.rotation.x,
      -0.38 + pointer.y * 0.18,
      2.5,
      delta,
    );
    group.current.rotation.y = MathUtils.damp(
      group.current.rotation.y,
      -0.15 + pointer.x * 0.28,
      2.5,
      delta,
    );
    group.current.rotation.z = Math.sin(t * 0.09) * 0.07 - 0.2 + unfold * 0.4;
    group.current.position.y = Math.sin(t * 0.45) * 0.09;
    petals.current.scale.setScalar(
      (0.72 + 0.28 * (1 - Math.pow(1 - bloom, 3))) * (0.94 + unfold * 0.12),
    );
    petals.current.children.forEach((child, i) => {
      child.rotation.x =
        -0.12 +
        Math.sin(t * 0.35 + i * 0.8) * 0.075 +
        (1 - bloom) * 0.6 -
        unfold * 0.12;
    });
  });
  return (
    <group ref={group}>
      <group ref={petals}>
        {Array.from({ length: 36 }, (_, i) => {
          const ring = Math.floor(i / 9);
          const angle = ((i % 9) / 9) * Math.PI * 2 + ring * 0.43;
          const size = [1.2, 0.93, 0.66, 0.39][ring];
          return (
            <group
              key={i}
              rotation={[0, 0, angle]}
              position={[0, 0, ring * 0.23]}
            >
              <mesh
                geometry={geometry}
                scale={[size, size, size]}
                rotation={[ring * 0.13, Math.sin(i * 3) * 0.18, 0]}
              >
                <meshPhysicalMaterial
                  vertexColors
                  color={["#ddb0a8", "#d89ca2", "#c98291", "#b96c80"][ring]}
                  roughness={0.57}
                  metalness={0.05}
                  sheen={1}
                  sheenRoughness={0.55}
                  sheenColor="#fff4de"
                  clearcoat={0.025}
                  bumpMap={silkTexture}
                  bumpScale={0.025}
                  side={DoubleSide}
                />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}

function LoosePetals({
  control,
  progress,
}: {
  control: AnimationControl;
  progress?: ScrollProgress;
}) {
  const group = useRef<Group>(null);
  const time = useRef(0);
  const geometry = useMemo(makePetal, []);
  const silkTexture = useMemo(makeSilkTexture, []);
  const { viewport, size } = useThree();
  const anchors =
    size.width < 600
      ? [
          [0.32, -0.12, 0.4, 0.2],
          [-0.33, -0.27, 0.3, 0.22],
          [0.17, -0.38, 0.8, 0.2],
        ]
      : [
          [0.08, 0.27, 0.8, 0.4],
          [0.34, 0.1, 0.3, 0.48],
          [0.32, -0.31, 1.0, 0.31],
          [0.02, -0.32, 0.7, 0.38],
          [0.42, 0.33, 0.2, 0.25],
        ];
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => silkTexture.dispose(), [silkTexture]);
  useFrame(({ pointer }, delta) => {
    if (!group.current || control.current) return;
    time.current += Math.min(delta, 0.04);
    group.current.children.forEach((p, i) => {
      const anchor = anchors[i];
      if (!anchor) return;
      p.position.y =
        anchor[1] * viewport.height +
        Math.sin(time.current * 0.6 + i * 2) * 0.18 -
        (progress?.get() ?? 0) * 0.8;
      p.position.x =
        anchor[0] * viewport.width +
        Math.sin(time.current * 0.4 + i) * 0.1 +
        pointer.x * 0.14;
      p.position.z = anchor[2] + Math.sin(time.current * 0.4 + i) * 0.12;
      p.rotation.x =
        0.5 + Math.sin(time.current * 0.4 + i) * 0.3 + pointer.y * 0.12;
      p.rotation.y = Math.sin(time.current * 0.35 + i) * 0.6;
      p.rotation.z = i * 1.8 + Math.sin(time.current * 0.3 + i) * 0.25;
    });
  });
  return (
    <group ref={group}>
      {anchors.map((anchor, i) => (
        <mesh
          key={i}
          geometry={geometry}
          scale={anchor[3]}
          position={[
            anchor[0] * viewport.width,
            anchor[1] * viewport.height,
            anchor[2],
          ]}
          rotation={[0.3, i * 0.6, i * 2]}
        >
          <meshPhysicalMaterial
            vertexColors
            side={DoubleSide}
            color={["#b97687", "#d4a08d", "#e7b9b5"][i % 3]}
            roughness={0.52}
            metalness={0.04}
            bumpMap={silkTexture}
            bumpScale={0.02}
            sheen={1}
            sheenColor="#fff2e3"
          />
        </mesh>
      ))}
    </group>
  );
}

function Silk({ control }: { control: AnimationControl }) {
  const mesh = useRef<Mesh>(null);
  const material = useRef<MeshPhysicalMaterial>(null);
  const time = useMemo(() => ({ value: 0 }), []);
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(8.5, 2.9, 100, 32);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i);
      p.setXYZ(
        i,
        x,
        y * (0.62 + Math.sin(x * 0.75) * 0.25),
        Math.sin(x * 1.1 + y * 0.65) * 0.65 +
          Math.sin(x * 2.5 - y * 1.5) * 0.12,
      );
    }
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ pointer }, delta) => {
    if (!mesh.current || control.current) return;
    time.value += Math.min(delta, 0.04);
    mesh.current.rotation.x = MathUtils.damp(
      mesh.current.rotation.x,
      -0.15 + pointer.y * 0.18,
      3,
      delta,
    );
    mesh.current.rotation.y = MathUtils.damp(
      mesh.current.rotation.y,
      pointer.x * 0.16,
      3,
      delta,
    );
    mesh.current.position.y = Math.sin(time.value * 0.3) * 0.12;
  });
  return (
    <mesh ref={mesh} geometry={geometry} rotation={[0, 0, -0.35]}>
      <meshPhysicalMaterial
        ref={material}
        color="#c88d99"
        metalness={0.17}
        roughness={0.3}
        sheen={1}
        sheenColor="#ffebd4"
        side={DoubleSide}
        onBeforeCompile={(shader) => {
          shader.uniforms.uTime = time;
          shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\ntransformed.z += sin(position.x * 1.5 + uTime * 0.5) * 0.16 + sin(position.y * 2.0 + uTime * 0.35) * 0.08;",
          );
        }}
      />
    </mesh>
  );
}

function Ready({ onReady }: { onReady?: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const id = requestAnimationFrame(() => onReady?.());
    const canvas = gl.domElement;
    const lose = (e: Event) => e.preventDefault();
    canvas.addEventListener("webglcontextlost", lose);
    return () => {
      cancelAnimationFrame(id);
      canvas.removeEventListener("webglcontextlost", lose);
    };
  }, [gl, onReady]);
  return null;
}
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function PetalScene({
  paused,
  mode = "petals",
  onReady,
  progress,
}: {
  paused: boolean;
  mode?: Mode;
  onReady?: () => void;
  progress?: ScrollProgress;
}) {
  const [ok, setOk] = useState(false);
  const [visible, setVisible] = useState(true);
  const [quality, setQuality] = useState(1.4);
  const holder = useRef<HTMLDivElement>(null);
  const animationPaused = useRef(paused);
  animationPaused.current = paused || !visible;
  const setRenderMode = useRef<((mode: "demand" | "always") => void) | null>(
    null,
  );
  useEffect(() => {
    setRenderMode.current?.(paused || !visible ? "demand" : "always");
  }, [paused, visible]);
  useEffect(
    () => () => {
      setRenderMode.current = null;
    },
    [],
  );
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      const ctx = c.getContext("webgl2");
      setOk(Boolean(ctx));
      ctx?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      setOk(false);
    }
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  useEffect(() => {
    if (!holder.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting && !document.hidden),
      { rootMargin: "80px" },
    );
    observer.observe(holder.current);
    return () => observer.disconnect();
  }, [ok]);
  if (!ok) return null;
  return (
    <Boundary>
      <div
        ref={holder}
        className={`petal-canvas sculpture-${mode}`}
        aria-hidden="true"
      >
        <Canvas
          onCreated={(state) => {
            setRenderMode.current = state.setFrameloop;
            state.setFrameloop(animationPaused.current ? "demand" : "always");
          }}
          dpr={[1, quality]}
          frameloop={paused || !visible ? "demand" : "always"}
          camera={{ position: [0, 0, mode === "silk" ? 7.6 : 7.8], fov: 43 }}
          gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
          eventSource={
            mode === "hero" || mode === "petals" ? document.body : undefined
          }
          eventPrefix={
            mode === "hero" || mode === "petals" ? "client" : "offset"
          }
        >
          <PerformanceMonitor
            onDecline={() => setQuality(1)}
            flipflops={2}
            onFallback={() => setQuality(1)}
          />
          <Environment resolution={64} frames={1} environmentIntensity={0.5}>
            <Lightformer
              form="rect"
              intensity={2}
              color="#fff4e8"
              position={[-4, 3, 5]}
              target={[0, 0, 0]}
              scale={[7, 5, 1]}
            />
            <Lightformer
              form="rect"
              intensity={1}
              color="#f0ced8"
              position={[4, 0, 3]}
              target={[0, 0, 0]}
              scale={[4, 6, 1]}
            />
          </Environment>
          <ambientLight intensity={0.95} />
          <directionalLight
            position={[-3, 5, 6]}
            intensity={1.9}
            color="#fff0da"
          />
          <directionalLight
            position={[4, -2, 4]}
            intensity={1.05}
            color="#f4c9d1"
          />
          <pointLight position={[-3, -1, -2]} intensity={7} color="#ffd5c3" />
          {mode === "flower" && (
            <Bloom control={animationPaused} progress={progress} />
          )}
          {mode === "hero" && <HeroRelief control={animationPaused} />}
          {mode !== "silk" && mode !== "hero" && (
            <LoosePetals control={animationPaused} progress={progress} />
          )}
          {mode === "silk" && <Silk control={animationPaused} />}
          <Ready onReady={onReady} />
        </Canvas>
      </div>
    </Boundary>
  );
}
