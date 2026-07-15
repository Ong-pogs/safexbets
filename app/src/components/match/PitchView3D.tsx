"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Button } from "@/components/ui/Button";
import type { PlaybackClock } from "./MatchCenter";

/**
 * PITCHVIEW — the 3D tracking visualization layer, ported from the vanilla Three.js prototype.
 *
 * Honesty note (design spec §3): the clip is **Metrica Sports open tracking data from a different
 * match** — a demo feed, clearly labeled. All match *facts* (score, banner, ticker) live upstream
 * in MatchCenter; this component only renders bodies on grass. It follows the page's master clock
 * (`clock.progressRef`), mapping progress -> clipTime = progress × clipDuration.
 *
 * Loaded via `next/dynamic` (`ssr: false`) and sized to its container with a ResizeObserver —
 * never to the window. Everything Three-side is disposed on unmount.
 */

interface MetricaClip {
  fps: number;
  pitch: { length: number; width: number };
  homeJerseys: string[];
  awayJerseys: string[];
  events: { t: number; team: string; type: string; player: string }[];
  /** Frame layout: [ballX, ballY, ...homePairs, ...awayPairs], 0–1000 normalized, -1 = hidden. */
  frames: number[][];
}

type ViewMode = "broadcast" | "top" | "follow";

const VIEWS: { mode: ViewMode; label: string }[] = [
  { mode: "broadcast", label: "Broadcast" },
  { mode: "top", label: "Top-down" },
  { mode: "follow", label: "Ballcam" },
];

// Team identity matches the app's market semantics: home <-> Yes (mint), away <-> No (amber).
const HOME_COL = 0x2fe39a;
const AWAY_COL = 0xff9a3d;
const HOME_CSS = "#2fe39a";
const AWAY_CSS = "#ff9a3d";
const HOME_LABEL_CSS = "#aef5d8";
const AWAY_LABEL_CSS = "#ffd2a3";
const TRAIL_RGB: [number, number, number] = [0.796, 1.0, 0.243]; // floodlight lime

export default function PitchView3D({
  clock,
  reducedMotion,
}: {
  clock: PlaybackClock;
  reducedMotion: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const telemetryRef = useRef<{ speed: HTMLElement | null; x: HTMLElement | null; y: HTMLElement | null }>({
    speed: null,
    x: null,
    y: null,
  });

  const [clip, setClip] = useState<MetricaClip | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [retryKey, setRetryKey] = useState(0);
  const [view, setView] = useState<ViewMode>("broadcast");
  const viewRef = useRef<ViewMode>("broadcast");
  const resetCameraRef = useRef<() => void>(() => {});

  // ---- fetch the demo clip on mount (1.9 MB — only ever loaded on this page) ----
  useEffect(() => {
    const ctrl = new AbortController();
    setStatus("loading");
    fetch("/replay/metrica-clip.json", { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`clip fetch failed: ${res.status}`);
        return res.json() as Promise<MetricaClip>;
      })
      .then((data) => {
        setClip(data);
        setStatus("ready");
      })
      .catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) setStatus("error");
      });
    return () => ctrl.abort();
  }, [retryKey]);

  // ---- build the Three.js world once the clip lands ----
  useEffect(() => {
    const container = containerRef.current;
    const minimap = minimapRef.current;
    if (!clip || !container || !minimap) return;

    const world = createPitchWorld({ container, minimap, clip, reducedMotion });
    resetCameraRef.current = world.resetBroadcastCamera;

    const ro = new ResizeObserver(() => {
      world.resize(container.clientWidth, container.clientHeight);
    });
    ro.observe(container);

    let raf = 0;
    let last = performance.now();
    let telemetryTick = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const t = world.update(
        clock.progressRef.current,
        clock.playingRef.current,
        dt,
        viewRef.current,
        clock.liveRef.current,
      );
      telemetryTick -= dt;
      if (telemetryTick <= 0) {
        telemetryTick = 0.15;
        const tel = telemetryRef.current;
        if (tel.speed) tel.speed.textContent = `${t.speedKmh.toFixed(1)} km/h`;
        if (tel.x) tel.x.textContent = `${t.x.toFixed(1)} m`;
        if (tel.y) tel.y.textContent = `${t.y.toFixed(1)} m`;
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      world.dispose();
    };
  }, [clip, reducedMotion, clock]);

  const selectView = (mode: ViewMode) => {
    viewRef.current = mode;
    setView(mode);
    if (mode === "broadcast") resetCameraRef.current();
  };

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-pitch-900">
      {/* broadcast-monitor atmosphere over the canvas */}
      <div
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{ background: "radial-gradient(ellipse at 50% 38%, transparent 52%, rgba(0,0,0,0.5) 100%)" }}
        aria-hidden
      />
      <div className="grain pointer-events-none absolute inset-0 z-[2]" aria-hidden />

      {/* honesty label — the 3D layer is a demo feed, and says so up front */}
      <div className="absolute left-3 top-3 z-10 max-w-[75%]">
        <span className="kit-label inline-block rounded border border-no/40 bg-pitch-900/80 px-2 py-1 text-[9px] leading-tight text-no backdrop-blur-sm">
          Tracking visualization · Metrica open data
          <span className="text-chalk-dim"> (demo feed — not this fixture)</span>
        </span>
      </div>

      {/* view switch */}
      <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1.5">
        {VIEWS.map((v) => (
          <button
            key={v.mode}
            type="button"
            aria-pressed={view === v.mode}
            onClick={() => selectView(v.mode)}
            className={clsx(
              "kit-label rounded-lg border px-2.5 py-1.5 text-[10px] transition-all",
              view === v.mode
                ? "border-flood bg-flood text-pitch-900 shadow-[0_0_18px_-4px_var(--flood)]"
                : "border-white/10 bg-pitch-900/70 text-mist backdrop-blur-sm hover:border-flood/40 hover:text-chalk",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* minimap */}
      <div className="absolute bottom-3 left-3 z-10 rounded-lg border border-white/10 bg-pitch-900/75 p-1.5 backdrop-blur-sm">
        <canvas ref={minimapRef} width={252} height={172} className="block h-auto w-[110px] sm:w-[150px]" aria-hidden />
      </div>

      {/* telemetry — a broadcast readout, honest about its source */}
      <div className="led absolute bottom-3 right-3 z-10 hidden min-w-[168px] flex-col gap-0.5 rounded-lg border border-white/10 bg-pitch-900/75 px-3 py-2 text-[10px] text-mist backdrop-blur-sm sm:flex">
        <TelemetryRow label="Ball speed">
          <b
            ref={(el) => {
              telemetryRef.current.speed = el;
            }}
            className="font-medium text-flood"
          >
            0.0 km/h
          </b>
        </TelemetryRow>
        <TelemetryRow label="Position X">
          <b
            ref={(el) => {
              telemetryRef.current.x = el;
            }}
            className="font-medium text-flood"
          >
            0.0 m
          </b>
        </TelemetryRow>
        <TelemetryRow label="Position Y">
          <b
            ref={(el) => {
              telemetryRef.current.y = el;
            }}
            className="font-medium text-flood"
          >
            0.0 m
          </b>
        </TelemetryRow>
        <TelemetryRow label="Feed">
          <b className="font-medium text-no">DEMO FEED · METRICA</b>
        </TelemetryRow>
      </div>

      {/* loading / error states */}
      {status === "loading" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-pitch-900">
          <div className="font-display text-lg font-bold uppercase tracking-[0.3em] text-chalk">
            Pitch<span className="text-flood">view</span>
          </div>
          <div className="h-0.5 w-48 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-2/5 animate-[slide_1.1s_ease-in-out_infinite] bg-flood" />
          </div>
          <p className="led text-[10px] tracking-[0.2em] text-mist">INGESTING TRACKING FEED · 12.5 HZ</p>
          <style>{`@keyframes slide { 0% { transform: translateX(-100%);} 100% { transform: translateX(320%);} }`}</style>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-pitch-900 px-6 text-center">
          <p className="font-display text-base uppercase tracking-wide text-chalk">Tracking feed unavailable</p>
          <p className="max-w-xs text-xs text-mist">
            The demo clip failed to load. The match facts above are unaffected — retry to bring the
            pitch back.
          </p>
          <Button variant="outline" size="sm" onClick={() => setRetryKey((k) => k + 1)}>
            Retry feed
          </Button>
        </div>
      )}
    </div>
  );
}

function TelemetryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="kit-label text-[9px] tracking-[0.12em]">{label}</span>
      {children}
    </div>
  );
}

// ===========================================================================
// Three.js world — a straight port of the prototype scene, adjusted to:
// container sizing, master-clock playback, app palette, full disposal.
// ===========================================================================

interface WorldTelemetry {
  speedKmh: number;
  x: number;
  y: number;
}

interface PitchWorld {
  update: (progress: number, playing: boolean, dt: number, view: ViewMode, live: boolean) => WorldTelemetry;
  resize: (w: number, h: number) => void;
  resetBroadcastCamera: () => void;
  dispose: () => void;
}

function createPitchWorld({
  container,
  minimap,
  clip,
  reducedMotion,
}: {
  container: HTMLDivElement;
  minimap: HTMLCanvasElement;
  clip: MetricaClip;
  reducedMotion: boolean;
}): PitchWorld {
  const FPS = clip.fps;
  const LEN = clip.pitch.length; // 105 m
  const WID = clip.pitch.width; // 68 m
  const N_HOME = clip.homeJerseys.length;
  const N_AWAY = clip.awayJerseys.length;
  const FRAMES = clip.frames;
  const DURATION = FRAMES.length / FPS;

  // value layout per frame: [ballX, ballY, home pairs..., away pairs...]
  const IDX_BALL = 0;
  const IDX_HOME = 2;
  const IDX_AWAY = 2 + N_HOME * 2;

  const toX = (v: number) => (v / 1000 - 0.5) * LEN;
  const toZ = (v: number) => (v / 1000 - 0.5) * WID;

  /* ---------------- precompute ball speed + synthetic height ----------------
     Source data is 2D; height is synthesized from ball speed for visual effect only. */
  const ballSpeed = new Float32Array(FRAMES.length); // m/s
  for (let i = 1; i < FRAMES.length; i++) {
    const a = FRAMES[i - 1];
    const b = FRAMES[i];
    if (a[0] < 0 || b[0] < 0) {
      ballSpeed[i] = ballSpeed[i - 1];
      continue;
    }
    const dx = toX(b[0]) - toX(a[0]);
    const dz = toZ(b[1]) - toZ(a[1]);
    const rawSpeed = Math.hypot(dx, dz) * FPS;
    ballSpeed[i] = ballSpeed[i - 1] * 0.6 + Math.min(rawSpeed, 40) * 0.4; // smooth, clamp glitches
  }
  const ballHeight = new Float32Array(FRAMES.length);
  {
    let h = 0;
    for (let i = 0; i < FRAMES.length; i++) {
      const target = Math.pow(Math.max(0, (ballSpeed[i] - 7) / 20), 1.3) * 3.2;
      h += (target - h) * (target > h ? 0.25 : 0.08);
      ballHeight[i] = h;
    }
  }

  /* ---------------- renderer / scene ---------------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.domElement.classList.add("absolute", "inset-0");
  // The canvas is the image; overlaid controls stay in the a11y tree.
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute(
    "aria-label",
    "3D pitch tracking visualization — Metrica open-data demo feed, not this fixture",
  );
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04110a); // app pitch-900 — same night as the page
  scene.fog = new THREE.Fog(0x04110a, 140, 340);

  /* ---------------- cameras ---------------- */
  const aspect = () => (container.clientWidth || 1) / (container.clientHeight || 1);
  const persp = new THREE.PerspectiveCamera(42, aspect(), 0.1, 600);
  const BROADCAST_POS = new THREE.Vector3(0, 52, 74);
  persp.position.copy(BROADCAST_POS);

  const ORTHO_PAD = 8;
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  function orthoFrustum() {
    const a = aspect();
    const halfW = LEN / 2 + ORTHO_PAD;
    const halfH = WID / 2 + ORTHO_PAD;
    if (a > halfW / halfH) {
      ortho.top = halfH;
      ortho.bottom = -halfH;
      ortho.left = -halfH * a;
      ortho.right = halfH * a;
    } else {
      ortho.left = -halfW;
      ortho.right = halfW;
      ortho.top = halfW / a;
      ortho.bottom = -halfW / a;
    }
    ortho.updateProjectionMatrix();
  }
  orthoFrustum();
  ortho.position.set(0, 120, 0);
  ortho.up.set(0, 0, -1);
  ortho.lookAt(0, 0, 0);

  const controls = new OrbitControls(persp, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.minDistance = 15;
  controls.maxDistance = 220;
  controls.enableDamping = true;

  /* ---------------- lights (night-match floodlighting) ---------------- */
  scene.add(new THREE.HemisphereLight(0x9fc4e8, 0x0a2416, 0.7));
  const floodPositions: [number, number, number][] = [
    [-70, 60, -55],
    [70, 60, -55],
    [-70, 60, 55],
    [70, 60, 55],
  ];
  for (const [x, y, z] of floodPositions) {
    const spot = new THREE.SpotLight(0xdcefff, 900, 320, 0.55, 0.55, 1.6);
    spot.position.set(x, y, z);
    spot.target.position.set(0, 0, 0);
    scene.add(spot, spot.target);
  }
  const keyLight = new THREE.DirectionalLight(0xe8f4ff, 1.1);
  keyLight.position.set(-40, 70, 30);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  const sc = keyLight.shadow.camera;
  sc.left = -70;
  sc.right = 70;
  sc.top = 50;
  sc.bottom = -50;
  sc.far = 200;
  scene.add(keyLight);

  /* ---------------- pitch (canvas texture: mow stripes + chalk lines) ---------------- */
  function makePitchTexture(): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    const M = 20; // px per metre
    c.width = (LEN + 10) * M;
    c.height = (WID + 10) * M;
    const g = c.getContext("2d")!;
    const ox = 5 * M;
    const oy = 5 * M;

    // grass base + mow stripes, hue-matched to the app's turf palette
    g.fillStyle = "#0d321f";
    g.fillRect(0, 0, c.width, c.height);
    const stripes = 14;
    const sw = (LEN * M) / stripes;
    for (let i = 0; i < stripes; i++) {
      g.fillStyle = i % 2 ? "#0f3823" : "#0c2e1d";
      g.fillRect(ox + i * sw, 0, sw, c.height);
    }
    // subtle noise so the turf never reads flat
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = `rgba(${Math.random() > 0.5 ? "23,90,52" : "6,34,20"},0.25)`;
      g.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2);
    }

    g.strokeStyle = "rgba(238,251,241,0.85)"; // chalk
    g.lineWidth = 0.15 * M;
    const line = (x1: number, y1: number, x2: number, y2: number) => {
      g.beginPath();
      g.moveTo(ox + x1 * M, oy + y1 * M);
      g.lineTo(ox + x2 * M, oy + y2 * M);
      g.stroke();
    };
    const rect = (x: number, y: number, w: number, h: number) =>
      g.strokeRect(ox + x * M, oy + y * M, w * M, h * M);
    const circle = (x: number, y: number, r: number, a0 = 0, a1 = Math.PI * 2) => {
      g.beginPath();
      g.arc(ox + x * M, oy + y * M, r * M, a0, a1);
      g.stroke();
    };

    rect(0, 0, LEN, WID); // boundary
    line(LEN / 2, 0, LEN / 2, WID); // halfway
    circle(LEN / 2, WID / 2, 9.15); // centre circle
    g.fillStyle = "rgba(238,251,241,0.85)";
    g.beginPath();
    g.arc(ox + (LEN / 2) * M, oy + (WID / 2) * M, 0.18 * M, 0, 7);
    g.fill();

    for (const side of [0, 1]) {
      const dir = side ? -1 : 1;
      const x0 = side ? LEN : 0;
      rect(side ? LEN - 16.5 : 0, WID / 2 - 20.16, 16.5, 40.32); // penalty area
      rect(side ? LEN - 5.5 : 0, WID / 2 - 9.16, 5.5, 18.32); // six-yard box
      g.beginPath();
      g.arc(ox + (x0 + dir * 11) * M, oy + (WID / 2) * M, 0.18 * M, 0, 7);
      g.fill(); // spot
      const a = Math.acos((16.5 - 11) / 9.15);
      circle(x0 + dir * 11, WID / 2, 9.15, side ? Math.PI - a : -a, side ? Math.PI + a : a); // arc
    }
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const pitchTexture = makePitchTexture();
  const pitch = new THREE.Mesh(
    new THREE.PlaneGeometry(LEN + 10, WID + 10),
    new THREE.MeshStandardMaterial({ map: pitchTexture, roughness: 0.95 }),
  );
  pitch.rotation.x = -Math.PI / 2;
  pitch.receiveShadow = true;
  scene.add(pitch);

  // surrounding void floor
  const apron = new THREE.Mesh(
    new THREE.CircleGeometry(320, 48),
    new THREE.MeshStandardMaterial({ color: 0x030d08, roughness: 1 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.05;
  scene.add(apron);

  /* ---------------- goals ---------------- */
  function makeGoal(side: number): THREE.Group {
    const grp = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xf2f6f4, roughness: 0.4 });
    const r = 0.08;
    const W = 7.32;
    const H = 2.44;
    const DEEP = 1.6;
    const post = () => new THREE.Mesh(new THREE.CylinderGeometry(r, r, H, 10), mat);
    const p1 = post();
    p1.position.set(0, H / 2, -W / 2);
    const p2 = post();
    p2.position.set(0, H / 2, W / 2);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(r, r, W, 10), mat);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(0, H, 0);
    grp.add(p1, p2, bar);
    const netMat = new THREE.MeshBasicMaterial({
      color: 0xbcd4c6,
      wireframe: true,
      transparent: true,
      opacity: 0.18,
    });
    const net = new THREE.Mesh(new THREE.BoxGeometry(DEEP, H, W, 3, 6, 14), netMat);
    net.position.set((side * DEEP) / 2, H / 2, 0);
    grp.add(net);
    grp.position.x = (side * LEN) / 2;
    return grp;
  }
  scene.add(makeGoal(-1), makeGoal(1));

  /* ---------------- players ---------------- */
  const monoFont =
    getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim() || "monospace";

  function numberSprite(num: string, color: string): THREE.Sprite {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    g.font = `700 64px ${monoFont}, monospace`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.shadowColor = "rgba(0,0,0,0.9)";
    g.shadowBlur = 10;
    g.fillStyle = color;
    g.fillText(num, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    spr.scale.set(2.6, 2.6, 1);
    return spr;
  }

  const playerGeo = new THREE.CapsuleGeometry(0.55, 1.05, 4, 12);
  const ringGeo = new THREE.RingGeometry(0.75, 1.0, 24);

  function makePlayer(jersey: string, colHex: number, cssCol: string): THREE.Group {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(
      playerGeo,
      new THREE.MeshStandardMaterial({
        color: colHex,
        roughness: 0.55,
        emissive: colHex,
        emissiveIntensity: 0.12,
      }),
    );
    body.position.y = 1.05;
    body.castShadow = true;
    const ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: colHex, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    const label = numberSprite(jersey, cssCol);
    label.position.y = 3.1;
    grp.add(body, ring, label);
    grp.visible = false;
    scene.add(grp);
    return grp;
  }
  const homeMeshes = clip.homeJerseys.map((j) => makePlayer(j, HOME_COL, HOME_LABEL_CSS));
  const awayMeshes = clip.awayJerseys.map((j) => makePlayer(j, AWAY_COL, AWAY_LABEL_CSS));

  /* ---------------- ball + trail ----------------
     The ball must never be swallowed by player capsules: it is oversized and bright, and it
     carries two depthTest:false markers (an additive halo sprite + a lime ground ring) that
     render straight through occluding bodies — the broadcast "puck glow" trick. */
  const BALL_R = 0.55;
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 20, 16),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xf5fff9,
      emissiveIntensity: 0.85,
      roughness: 0.3,
    }),
  );
  ball.castShadow = true;
  scene.add(ball);
  const ballGlow = new THREE.PointLight(0xd8ff8a, 10, 16, 2);
  scene.add(ballGlow);

  function makeHaloTexture(): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 64, 6, 64, 64, 60);
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.35, "rgba(203,255,62,0.55)");
    grad.addColorStop(1, "rgba(203,255,62,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const ballHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeHaloTexture(),
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  ballHalo.scale.set(2.6, 2.6, 1);
  ballHalo.renderOrder = 999;
  scene.add(ballHalo);

  const ballRing = new THREE.Mesh(
    new THREE.RingGeometry(BALL_R, BALL_R + 0.28, 28),
    new THREE.MeshBasicMaterial({
      color: 0xcbff3e,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthTest: false,
    }),
  );
  ballRing.rotation.x = -Math.PI / 2;
  ballRing.renderOrder = 998;
  scene.add(ballRing);

  const TRAIL_N = 90;
  const trailPos = new Float32Array(TRAIL_N * 3);
  const trailCols = new Float32Array(TRAIL_N * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute("color", new THREE.BufferAttribute(trailCols, 3));
  const trail = new THREE.Line(
    trailGeo,
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }),
  );
  trail.frustumCulled = false;
  trail.visible = !reducedMotion; // reduced motion: no streaking effects
  scene.add(trail);
  let trailInit = false;

  /* ---------------- frame sampling ---------------- */
  const tmp = { x: 0, z: 0, hidden: false };
  function sample(fi: number, offset: number, out: typeof tmp): typeof tmp {
    const i0 = Math.min(Math.floor(fi), FRAMES.length - 1);
    const i1 = Math.min(i0 + 1, FRAMES.length - 1);
    const f = fi - i0;
    const a = FRAMES[i0];
    const b = FRAMES[i1];
    const ax = a[offset];
    const ay = a[offset + 1];
    const bx = b[offset];
    const by = b[offset + 1];
    if (ax < 0 || bx < 0) {
      out.hidden = true;
      return out;
    }
    out.hidden = false;
    out.x = toX(ax + (bx - ax) * f);
    out.z = toZ(ay + (by - ay) * f);
    return out;
  }

  /* ---------------- minimap ---------------- */
  const mg = minimap.getContext("2d")!;
  const MMW = minimap.width;
  const MMH = minimap.height;
  const mmx = (x: number) => (x / LEN + 0.5) * (MMW - 16) + 8;
  const mmz = (z: number) => (z / WID + 0.5) * (MMH - 16) + 8;
  function drawMinimap(fi: number) {
    mg.clearRect(0, 0, MMW, MMH);
    mg.strokeStyle = "rgba(238,251,241,0.3)";
    mg.lineWidth = 1;
    mg.strokeRect(8, 8, MMW - 16, MMH - 16);
    mg.beginPath();
    mg.moveTo(MMW / 2, 8);
    mg.lineTo(MMW / 2, MMH - 8);
    mg.stroke();
    mg.beginPath();
    mg.arc(MMW / 2, MMH / 2, (9.15 / LEN) * (MMW - 16), 0, 7);
    mg.stroke();
    const dot = (x: number, z: number, col: string, r = 3) => {
      mg.fillStyle = col;
      mg.beginPath();
      mg.arc(mmx(x), mmz(z), r, 0, 7);
      mg.fill();
    };
    for (let p = 0; p < N_HOME; p++) {
      sample(fi, IDX_HOME + p * 2, tmp);
      if (!tmp.hidden) dot(tmp.x, tmp.z, HOME_CSS);
    }
    for (let p = 0; p < N_AWAY; p++) {
      sample(fi, IDX_AWAY + p * 2, tmp);
      if (!tmp.hidden) dot(tmp.x, tmp.z, AWAY_CSS);
    }
    sample(fi, IDX_BALL, tmp);
    if (!tmp.hidden) {
      dot(tmp.x, tmp.z, "rgba(203,255,62,0.4)", 9);
      dot(tmp.x, tmp.z, "#ffffff", 5);
    }
  }

  /* ---------------- per-frame update, driven by the page's master clock ---------------- */
  let lastFi = 0;
  let liveClipT = 0; // live pace: the clip advances at its natural speed and loops
  const followTarget = new THREE.Vector3();
  const followGoal = new THREE.Vector3();

  function update(progress: number, playing: boolean, dt: number, view: ViewMode, live: boolean): WorldTelemetry {
    let clipT: number;
    if (live) {
      // Real match pace: progress-mapping would stretch a 12-min clip into slow motion, so the
      // ambience plays 1:1 and loops instead. Facts upstream still follow the master progress.
      if (playing) liveClipT = (liveClipT + dt) % DURATION;
      clipT = liveClipT;
    } else {
      clipT = Math.max(0, Math.min(1, progress)) * DURATION;
      liveClipT = clipT % DURATION;
    }
    const fi = Math.min(clipT * FPS, FRAMES.length - 1);
    const jumped = Math.abs(fi - lastFi) > FPS * 0.5; // scrub — restart the trail, no streak
    lastFi = fi;

    for (let p = 0; p < N_HOME; p++) {
      sample(fi, IDX_HOME + p * 2, tmp);
      homeMeshes[p].visible = !tmp.hidden;
      if (!tmp.hidden) homeMeshes[p].position.set(tmp.x, 0, tmp.z);
    }
    for (let p = 0; p < N_AWAY; p++) {
      sample(fi, IDX_AWAY + p * 2, tmp);
      awayMeshes[p].visible = !tmp.hidden;
      if (!tmp.hidden) awayMeshes[p].position.set(tmp.x, 0, tmp.z);
    }

    sample(fi, IDX_BALL, tmp);
    const i0 = Math.floor(fi);
    const h = ballHeight[i0] + (ballHeight[Math.min(i0 + 1, FRAMES.length - 1)] - ballHeight[i0]) * (fi - i0);
    if (!tmp.hidden) {
      ball.visible = true;
      ballHalo.visible = true;
      ballRing.visible = true;
      ball.position.set(tmp.x, BALL_R + h, tmp.z);
      if (playing) ball.rotation.x += ballSpeed[i0] * dt * 2;
      ballGlow.position.copy(ball.position);
      ballGlow.position.y += 1;
      ballHalo.position.copy(ball.position);
      ballRing.position.set(tmp.x, 0.03, tmp.z);
    } else {
      ball.visible = false;
      ballHalo.visible = false;
      ballRing.visible = false;
    }

    if (!reducedMotion) {
      if (!trailInit || jumped) {
        for (let i = 0; i < TRAIL_N; i++)
          trailPos.set([ball.position.x, ball.position.y, ball.position.z], i * 3);
        trailGeo.attributes.position.needsUpdate = true;
        trailInit = true;
      }
      if (playing) {
        trailPos.copyWithin(0, 3);
        trailPos.set([ball.position.x, ball.position.y, ball.position.z], (TRAIL_N - 1) * 3);
        for (let i = 0; i < TRAIL_N; i++) {
          const k = i / TRAIL_N;
          trailCols[i * 3] = TRAIL_RGB[0] * k;
          trailCols[i * 3 + 1] = TRAIL_RGB[1] * k;
          trailCols[i * 3 + 2] = TRAIL_RGB[2] * k;
        }
        trailGeo.attributes.position.needsUpdate = true;
        trailGeo.attributes.color.needsUpdate = true;
      }
    }

    /* camera */
    let cam: THREE.Camera = persp;
    controls.enabled = view === "broadcast";
    if (view === "top") {
      cam = ortho;
    } else if (view === "follow") {
      followTarget.set(ball.position.x, 0, ball.position.z);
      followGoal.set(ball.position.x * 0.85, 16, ball.position.z + 30);
      persp.position.lerp(followGoal, 0.04);
      persp.lookAt(followTarget);
    } else {
      controls.update();
    }

    drawMinimap(fi);
    renderer.render(scene, cam);

    return { speedKmh: ballSpeed[i0] * 3.6, x: ball.position.x, y: ball.position.z };
  }

  function resize(w: number, h: number) {
    if (w <= 0 || h <= 0) return;
    persp.aspect = w / h;
    persp.updateProjectionMatrix();
    orthoFrustum();
    renderer.setSize(w, h);
  }

  function resetBroadcastCamera() {
    persp.position.copy(BROADCAST_POS);
    controls.target.set(0, 0, 0);
  }

  function dispose() {
    controls.dispose();
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (material) {
        for (const m of Array.isArray(material) ? material : [material]) {
          const mapped = m as THREE.Material & { map?: THREE.Texture | null };
          mapped.map?.dispose();
          m.dispose();
        }
      }
    });
    pitchTexture.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }

  return { update, resize, resetBroadcastCamera, dispose };
}
