"use client";

import { useState, useRef, useCallback, useTransition, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import {
  Camera,
  Upload,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Star,
  Check,
  X,
  Lock,
  ScanFace,
} from "lucide-react";
import {
  FACE_SHAPE_INFO,
  classifyFaceShape,
  type FaceShape,
} from "@/lib/ai/face-shape";
// Types come via `import type` (erased at build time — no bundler cost)
// so the runtime import can stay dynamic and load the WASM on demand.
import type {
  Results as MPResults,
  NormalizedLandmark as MPLandmark,
} from "@mediapipe/face_mesh";

// ── Face detector ────────────────────────────────────────────────
// Landmark point in frame coordinates (pixels, not normalized).
type Landmark = { x: number; y: number };

// Uniform detector interface: give it a video/image, get back an
// array of absolute-pixel landmarks (or null if no face was found).
// Callers don't need to care which underlying engine is in use.
type FaceDetector = {
  runtime: "mediapipe-direct" | "tfjs";
  detect: (
    source: HTMLVideoElement | HTMLImageElement,
  ) => Promise<Landmark[] | null>;
};

// Primary path: use @mediapipe/face_mesh DIRECTLY. This is the exact
// C++ runtime Google ships in Meet, compiled to WASM. Going around the
// @tensorflow-models wrapper removes a whole class of failure modes
// (WebGL init, mismatched model-zoo versions, silent CPU fallback).
//
// The WASM + model binaries load from the jsDelivr CDN at the version
// pinned in package.json — no bundler static-analysis issues.
//
// Fallback path: @tensorflow-models tfjs port, for environments where
// the WASM CDN is blocked by CSP/network.
async function createFaceDetector(): Promise<FaceDetector> {
  // Attempt 1: direct MediaPipe WASM runtime.
  try {
    const mp = await import("@mediapipe/face_mesh");
    const fm = new mp.FaceMesh({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`,
    });
    fm.setOptions({
      maxNumFaces: 1,
      refineLandmarks: false,
      // Thresholds tuned to favor sensitivity over precision — we'd
      // rather detect a slightly ambiguous face than silently return
      // nothing. The stability window downstream filters out noise.
      minDetectionConfidence: 0.4,
      minTrackingConfidence: 0.4,
    });

    // FaceMesh pushes results through a callback. Capture the latest
    // result in a closure-local variable that the per-tick detect()
    // can read after send() resolves.
    let latest: MPResults | null = null;
    fm.onResults((r) => {
      latest = r;
    });

    // Warm up the WASM + graph before first use. This is what the
    // user waits on during "Warming up detector…".
    await fm.initialize();

    return {
      runtime: "mediapipe-direct",
      async detect(source) {
        latest = null;
        await fm.send({ image: source });
        // Narrow manually: TS sees `latest` as `null` here because the
        // onResults callback is declared above and control flow can't
        // prove the mutation yet. Re-read as MPResults after the null
        // guard to get back the fields.
        const snap = latest as MPResults | null;
        if (!snap) return null;
        const lists = snap.multiFaceLandmarks;
        if (!lists || lists.length === 0) return null;
        const w =
          source instanceof HTMLVideoElement ? source.videoWidth : source.width;
        const h =
          source instanceof HTMLVideoElement
            ? source.videoHeight
            : source.height;
        // MediaPipe returns normalized [0,1] coords — expand to pixels
        // so downstream shape classification (which uses pixel ratios)
        // gets the right input.
        return lists[0].map((p: MPLandmark) => ({ x: p.x * w, y: p.y * h }));
      },
    };
  } catch (mpError) {
    console.warn(
      "[face-mesh] direct mediapipe init failed, falling back to tfjs:",
      mpError,
    );
  }

  // Attempt 2: tfjs fallback.
  const tf = await import("@tensorflow/tfjs");
  await tf.ready();
  const fld = await import("@tensorflow-models/face-landmarks-detection");
  const detector = await fld.createDetector(
    fld.SupportedModels.MediaPipeFaceMesh,
    { runtime: "tfjs", refineLandmarks: false, maxFaces: 1 },
  );
  return {
    runtime: "tfjs",
    async detect(source) {
      const faces = await detector.estimateFaces(source);
      if (faces.length === 0) return null;
      return faces[0].keypoints.map((k) => ({ x: k.x, y: k.y }));
    },
  };
}

// Detection loop cadence + stability window.
const DETECT_INTERVAL_MS = 450;   // ~2 FPS; enough to feel live, light on CPU
const STABILITY_WINDOW = 5;       // last N classifications kept
const STABILITY_THRESHOLD = 3;    // this many agreeing classifications -> lock
import type {
  HairType,
  DesiredLength,
  StyleVibe,
  StyleRecommendation,
} from "@/lib/ai/style-rules";
import type { Service } from "@/types/database";

type Step = "detect" | "preferences" | "results";

interface RecommendationResult {
  faceShape: FaceShape;
  styles: StyleRecommendation[];
  tips: string[];
  avoid: string[];
  services: Service[];
  portfolio: { id: string; image_url: string; title: string | null; tags: string[] | null; stylist: { id: string; user: { full_name: string } | null } | null }[];
}

export default function AIRecommendPage() {
  const [, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("detect");
  const [faceShape, setFaceShape] = useState<FaceShape | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectionError, setDetectionError] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Preferences
  const [hairType, setHairType] = useState<HairType>("straight");
  const [desiredLength, setDesiredLength] = useState<DesiredLength>("medium");
  const [styleVibe, setStyleVibe] = useState<StyleVibe>("modern");

  // Results
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Shared detector — warmed up by the first user flow that needs it
  // (upload or camera) and reused thereafter.
  const detectorRef = useRef<FaceDetector | null>(null);
  const ensureDetector = useCallback(async (): Promise<FaceDetector> => {
    if (!detectorRef.current) {
      try {
        detectorRef.current = await createFaceDetector();
        setDebug((d) => ({
          ...d,
          runtime: detectorRef.current!.runtime,
          initError: "",
        }));
      } catch (e) {
        setDebug((d) => ({
          ...d,
          runtime: "failed",
          initError: e instanceof Error ? e.message : String(e),
        }));
        throw e;
      }
    }
    return detectorRef.current;
  }, []);

  // Live camera state. `cameraStatus` drives which UI block renders;
  // `liveShape` + `stabilityCount` + `locked` are the real-time readout.
  const [cameraStatus, setCameraStatus] = useState<
    "idle" | "starting" | "running" | "error"
  >("idle");
  const [liveShape, setLiveShape] = useState<FaceShape | null>(null);
  const [stabilityCount, setStabilityCount] = useState(0);
  const [locked, setLocked] = useState(false);

  // Detection loop + history buffer live in refs so they survive
  // re-renders without firing them. The interval is strictly owned
  // by start/stopCamera.
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const historyRef = useRef<FaceShape[]>([]);
  // Prevents overlapping estimateFaces() calls when a tick is still
  // pending — without this, slow devices stack up promises and stall.
  const isTickingRef = useRef(false);
  // Offscreen canvas reused across ticks for brightness sampling. Creating
  // it once and resizing it cheaply is much faster than spawning a fresh
  // canvas every 450ms.
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // How many frames in a row have returned zero faces. Used to escalate
  // coaching hints from "looking for you" → "can't see you, try X".
  const noFaceStreakRef = useRef(0);

  // Live coaching message shown under the camera preview. Updated every
  // tick based on: frame brightness, whether a face was found, and how
  // well that face fills + centers in the oval.
  const [liveHint, setLiveHint] = useState<string>("Starting camera…");
  // After ~8s (18 ticks @ 450ms) of no face, show a prominent escape
  // CTA — upload instead, or pick manually. Keeps the user unstuck.
  const [showFallbackHelp, setShowFallbackHelp] = useState(false);

  // Diagnostics panel — exposes exactly what the detector is seeing.
  // Invaluable when a user reports "it's not working" because it
  // removes the guesswork of guessing why detection failed.
  const [showDebug, setShowDebug] = useState(false);
  const [debug, setDebug] = useState({
    runtime: "pending" as "pending" | "mediapipe-direct" | "tfjs" | "failed",
    initError: "",
    ticks: 0,
    facesFound: 0,
    lastBrightness: 0,
    videoW: 0,
    videoH: 0,
  });

  const goTo = useCallback((s: Step) => startTransition(() => setStep(s)), [startTransition]);

  // ── Photo Upload Handler ──
  const handlePhotoUpload = useCallback(async (file: File) => {
    setDetectionError("");
    setDetecting(true);

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const detector = await ensureDetector();

      // Create image element from file
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
      });

      const landmarks = await detector.detect(img);
      URL.revokeObjectURL(img.src);

      if (!landmarks) {
        setDetectionError("No face detected. Please try a clearer photo or select manually below.");
        setDetecting(false);
        return;
      }

      const shape = classifyFaceShape(landmarks);
      setFaceShape(shape);
      setDetecting(false);
      goTo("preferences");
    } catch {
      setDetectionError("Face detection failed. Please select your face shape manually.");
      setDetecting(false);
    }
  }, [goTo, ensureDetector]);

  // ── Live Camera Handlers ──

  const stopCamera = useCallback(() => {
    if (loopRef.current != null) {
      clearInterval(loopRef.current);
      loopRef.current = null;
    }
    const video = videoRef.current;
    if (video?.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
    historyRef.current = [];
    noFaceStreakRef.current = 0;
    isTickingRef.current = false;
    setLiveShape(null);
    setStabilityCount(0);
    setLocked(false);
    setShowFallbackHelp(false);
    setLiveHint("Starting camera…");
    setCameraStatus("idle");
  }, []);

  const startCamera = useCallback(async () => {
    setDetectionError("");
    setCameraStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();

      // Kick off detector load alongside the stream so the first
      // frame is ready to classify as soon as possible.
      const detector = await ensureDetector();

      setCameraStatus("running");
      setLiveHint("Warming up detector…");

      // Detection loop. Each tick:
      //   1. Sanity-check the video frame (ready, non-zero dimensions)
      //   2. Sample frame brightness — if too dark, tell the user
      //   3. Run estimateFaces; if empty, coach escalates with streak
      //   4. If found, measure face size + position → coach accordingly
      //   5. Classify + push into the stability window → lock when stable
      // The isTickingRef guard prevents overlapping estimateFaces calls,
      // which would otherwise queue up on slow machines and make the
      // UI feel frozen.
      loopRef.current = setInterval(async () => {
        if (isTickingRef.current) return;
        isTickingRef.current = true;

        try {
          const v = videoRef.current;
          if (!v || v.readyState < 2 || v.videoWidth === 0) {
            setLiveHint("Camera warming up…");
            return;
          }

          // ── Brightness sample ─────────────────────────────────
          // Draw a tiny version of the frame and average luminance.
          // 32×24 is coarse enough to be cheap (<1ms) and accurate
          // enough to detect a covered lens or a dark room.
          const SAMPLE_W = 32;
          const SAMPLE_H = 24;
          let canvas = sampleCanvasRef.current;
          if (!canvas) {
            canvas = document.createElement("canvas");
            canvas.width = SAMPLE_W;
            canvas.height = SAMPLE_H;
            sampleCanvasRef.current = canvas;
          }
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          let avgLum = 255;
          if (ctx) {
            ctx.drawImage(v, 0, 0, SAMPLE_W, SAMPLE_H);
            const { data } = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);
            let sum = 0;
            for (let i = 0; i < data.length; i += 4) {
              // Rec. 601 luma approximation — good enough for a
              // "is there any light in the frame?" check.
              sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            }
            avgLum = sum / (SAMPLE_W * SAMPLE_H);
          }
          if (avgLum < 25) {
            setLiveHint("It's quite dark — turn on a light or face a window.");
            // Don't wipe history on transient misses. A single dark frame
            // shouldn't undo a half-built stability window.
            noFaceStreakRef.current++;
            if (noFaceStreakRef.current >= 18) setShowFallbackHelp(true);
            return;
          }

          // ── Face estimation ──────────────────────────────────
          const landmarks = await detector.detect(v);

          // Publish diagnostics (one setState per tick keeps React
          // re-render volume bounded even at 2 FPS).
          setDebug((d) => ({
            ...d,
            ticks: d.ticks + 1,
            facesFound: d.facesFound + (landmarks ? 1 : 0),
            lastBrightness: Math.round(avgLum),
            videoW: v.videoWidth,
            videoH: v.videoHeight,
          }));

          if (!landmarks) {
            noFaceStreakRef.current++;
            // Keep the stability history: a single missed frame shouldn't
            // invalidate the last four good classifications. Only reset
            // after a sustained streak suggests the user has left frame.
            if (noFaceStreakRef.current >= 4) {
              historyRef.current = [];
              setLiveShape(null);
              setStabilityCount(0);
              setLocked(false);
            }
            // Escalate the hint as frustration mounts.
            if (noFaceStreakRef.current < 3) {
              setLiveHint("Looking for your face — center it in the oval.");
            } else if (noFaceStreakRef.current < 8) {
              setLiveHint("Move closer and face the camera straight on.");
            } else if (noFaceStreakRef.current < 14) {
              setLiveHint("Try better lighting, remove glasses, or tie hair back.");
            } else {
              setLiveHint("Still can't see a face. Pick another method below.");
              setShowFallbackHelp(true);
            }
            return;
          }

          // Found a face — reset the frustration counter.
          noFaceStreakRef.current = 0;
          setShowFallbackHelp(false);

          // ── Frame metrics ────────────────────────────────────
          // Compute the face's bounding box to gauge whether the
          // user is too far, too close, or off-center. `landmarks` is
          // already pixel-space thanks to createFaceDetector().
          let minX = Infinity;
          let maxX = -Infinity;
          let minY = Infinity;
          let maxY = -Infinity;
          for (const p of landmarks) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          }
          const vW = v.videoWidth;
          const vH = v.videoHeight;
          const faceArea = ((maxX - minX) * (maxY - minY)) / (vW * vH);
          const cx = (minX + maxX) / 2 / vW;
          const cy = (minY + maxY) / 2 / vH;

          // Positioning is the strongest signal for the user — tell
          // them that before worrying about classification quality.
          // Thresholds are deliberately generous so the user isn't
          // fighting the oval — "in frame and reasonably centered" is
          // plenty for FaceMesh to produce stable ratios.
          let hint: string;
          let goodFraming = false;
          if (faceArea < 0.035) {
            hint = "Move closer — fill the oval with your face.";
          } else if (faceArea > 0.65) {
            hint = "Move back a little — you're too close.";
          } else if (cx < 0.2 || cx > 0.8 || cy < 0.2 || cy > 0.8) {
            hint = "Re-center your face in the oval.";
          } else {
            hint = locked
              ? "Locked in — confirm below."
              : "Looking good — hold still.";
            goodFraming = true;
          }
          setLiveHint(hint);

          // Only feed well-framed frames into the classifier; bad
          // framing produces noisy ratios and makes the shape flicker.
          // But DO keep the existing history — a single off-frame
          // shouldn't undo progress. The history decays naturally as
          // the sliding window slides.
          if (!goodFraming) return;

          const shape = classifyFaceShape(landmarks);

          historyRef.current.push(shape);
          if (historyRef.current.length > STABILITY_WINDOW) historyRef.current.shift();

          const matching = historyRef.current.filter((s) => s === shape).length;
          setLiveShape(shape);
          setStabilityCount(matching);
          setLocked(matching >= STABILITY_THRESHOLD);
        } catch {
          // swallow per-frame errors; the loop will recover on the next tick
        } finally {
          isTickingRef.current = false;
        }
      }, DETECT_INTERVAL_MS);
    } catch {
      setCameraStatus("error");
      setDetectionError("Camera access denied. Please upload a photo or pick your face shape manually.");
    }
  }, [ensureDetector]);

  const acceptLiveResult = useCallback(() => {
    if (!liveShape || !locked) return;
    const accepted = liveShape;
    stopCamera();
    setFaceShape(accepted);
    goTo("preferences");
  }, [liveShape, locked, stopCamera, goTo]);

  // Guarantee cleanup: stop camera when step leaves "detect" and on unmount.
  useEffect(() => {
    if (step !== "detect" && cameraStatus !== "idle") {
      stopCamera();
    }
  }, [step, cameraStatus, stopCamera]);

  useEffect(() => {
    return () => stopCamera();
    // stopCamera is stable (empty deps), safe to depend on once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Manual Face Shape Selection ──
  const selectManualShape = useCallback(
    (shape: FaceShape) => {
      setFaceShape(shape);
      goTo("preferences");
    },
    [goTo]
  );

  // ── Get Recommendations ──
  const getRecommendations = useCallback(async () => {
    if (!faceShape) return;
    setLoading(true);

    const res = await fetch("/api/ai-recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        faceShape,
        preferences: { hairType, desiredLength, styleVibe },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setResult(data);
      goTo("results");
    }
    setLoading(false);
  }, [faceShape, hairType, desiredLength, styleVibe, goTo]);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-gold">
          <Sparkles className="h-5 w-5" />
          <span className="text-xs tracking-[0.4em] uppercase">AI Styling</span>
        </div>
        <h1 className="text-3xl font-bold font-heading">
          Find Your Perfect <span className="text-crimson italic">Style</span>
        </h1>
        <p className="text-muted-foreground">
          Upload a photo or select your face shape, set your preferences, and get personalized hairstyle recommendations.
        </p>
      </div>

      {/* Step Indicators */}
      <div className="flex justify-center gap-2">
        {(["detect", "preferences", "results"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                step === s
                  ? "bg-primary text-primary-foreground"
                  : (s === "preferences" && step === "results") || (s === "detect" && step !== "detect")
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {(s === "detect" && step !== "detect") || (s === "preferences" && step === "results") ? (
                <Check className="h-4 w-4" />
              ) : (
                i + 1
              )}
            </div>
            <span className="text-sm hidden sm:inline capitalize">
              {s === "detect" ? "Face Shape" : s}
            </span>
            {i < 2 && <div className="w-8 h-px bg-border hidden sm:block" />}
          </div>
        ))}
      </div>

      {/* ═══ STEP 1: Face Shape Detection ═══ */}
      {step === "detect" && (
        <div className="space-y-6">
          {/* Photo Upload / Camera */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-gold" />
                Auto-Detect Face Shape
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload a clear, front-facing photo. Our AI will analyze your facial proportions to determine your face shape.
              </p>

              {/* Photo preview (upload flow) */}
              {photoPreview && cameraStatus === "idle" && (
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreview}
                    alt="Your photo"
                    className="w-48 h-48 object-cover rounded-lg border border-border"
                  />
                </div>
              )}

              {/* ── Live Camera View ── */}
              {cameraStatus !== "idle" && (
                <div className="space-y-3">
                  <div className="relative mx-auto w-full max-w-md aspect-[4/3] overflow-hidden rounded-lg border border-border bg-black">
                    {/* scale-x-[-1] mirrors the video like a bathroom mirror,
                        so the user's movements match what they'd expect. The
                        detector reads raw pixel data, so face-shape ratios
                        are rotation/reflection invariant — classification is
                        unaffected. */}
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-full w-full object-cover scale-x-[-1]"
                    />

                    {/* Center alignment guide — a faint oval the user
                        centers their face in. Pointer-events-none so
                        it never blocks interaction. */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div
                        className={`h-[78%] w-[58%] rounded-[50%] border-2 border-dashed transition-colors ${
                          locked
                            ? "border-gold"
                            : liveShape
                              ? "border-primary/60"
                              : "border-white/30"
                        }`}
                      />
                    </div>

                    {/* Top-left: live status pill */}
                    <div className="absolute left-3 top-3">
                      {cameraStatus === "starting" ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-xs text-white backdrop-blur">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Starting camera…
                        </span>
                      ) : locked ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-gold/90 px-3 py-1 text-xs font-semibold text-black backdrop-blur">
                          <Lock className="h-3 w-3" />
                          Locked in
                        </span>
                      ) : liveShape ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-xs text-white backdrop-blur">
                          <ScanFace className="h-3 w-3 text-primary" />
                          Analyzing…
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-xs text-white/80 backdrop-blur">
                          <ScanFace className="h-3 w-3" />
                          Looking for your face
                        </span>
                      )}
                    </div>

                    {/* Top-right: close */}
                    <button
                      type="button"
                      onClick={stopCamera}
                      aria-label="Stop camera"
                      className="absolute right-3 top-3 rounded-full bg-black/70 p-1.5 text-white backdrop-blur transition hover:bg-black/90"
                    >
                      <X className="h-4 w-4" />
                    </button>

                    {/* Bottom: current shape + stability bar */}
                    {cameraStatus === "running" && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                        <div className="flex items-center justify-between text-xs text-white">
                          <span className="flex items-center gap-1.5">
                            <span className="text-white/70">Detected:</span>
                            {liveShape ? (
                              <span className="inline-flex items-center gap-1 font-semibold capitalize">
                                {FACE_SHAPE_INFO[liveShape].icon}
                                {FACE_SHAPE_INFO[liveShape].label}
                              </span>
                            ) : (
                              <span className="text-white/50">—</span>
                            )}
                          </span>
                          <span className="text-white/70">
                            Stability {stabilityCount}/{STABILITY_THRESHOLD}
                          </span>
                        </div>
                        <div className="mt-1.5 flex gap-1">
                          {Array.from({ length: STABILITY_THRESHOLD }).map((_, i) => (
                            <span
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-colors ${
                                i < stabilityCount
                                  ? locked
                                    ? "bg-gold"
                                    : "bg-primary"
                                  : "bg-white/20"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Helper text — drives directly off the detection
                      loop's liveHint state so the message reflects
                      what the model is actually seeing each tick. */}
                  <p
                    className={`text-center text-sm transition-colors ${
                      locked
                        ? "text-gold font-medium"
                        : liveShape
                          ? "text-primary"
                          : "text-muted-foreground"
                    }`}
                  >
                    {locked
                      ? "Locked in — confirm below or retry."
                      : liveHint}
                  </p>

                  {/* Always-visible "having trouble?" row. Gives the user
                      an explicit exit without having to wait for the 8s
                      timeout. When showFallbackHelp is true (auto-raised
                      after ~8s with no face, OR toggled manually), the
                      expanded panel with three equal choices renders. */}
                  {!locked && (
                    <div className="space-y-2">
                      {!showFallbackHelp && (
                        <div className="flex items-center justify-center gap-4">
                          <button
                            type="button"
                            onClick={() => setShowFallbackHelp(true)}
                            className="text-xs text-muted-foreground underline-offset-4 hover:text-gold hover:underline"
                          >
                            Having trouble? Pick another method →
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowDebug((v) => !v)}
                            className="text-xs text-muted-foreground underline-offset-4 hover:text-gold hover:underline"
                          >
                            {showDebug ? "Hide" : "Show"} diagnostics
                          </button>
                        </div>
                      )}

                      {/* Diagnostics readout. Tells you (and me) exactly
                          what the detector is seeing each tick, so "it
                          doesn't detect my face" becomes debuggable
                          instead of mysterious. */}
                      {showDebug && (
                        <div className="rounded-md border border-[#2a2520] bg-[#141414]/80 p-3 font-mono text-[11px] text-[#8a8478] leading-relaxed">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                            <span>runtime:</span>
                            <span
                              className={
                                debug.runtime === "mediapipe-direct"
                                  ? "text-gold"
                                  : debug.runtime === "tfjs"
                                    ? "text-yellow-500"
                                    : debug.runtime === "failed"
                                      ? "text-red-500"
                                      : "text-[#8a8478]"
                              }
                            >
                              {debug.runtime}
                              {debug.runtime === "tfjs" && " (slow fallback)"}
                            </span>
                            <span>video:</span>
                            <span>
                              {debug.videoW || "—"}×{debug.videoH || "—"}
                            </span>
                            <span>brightness:</span>
                            <span>{debug.lastBrightness}/255</span>
                            <span>ticks:</span>
                            <span>{debug.ticks}</span>
                            <span>faces detected:</span>
                            <span>
                              {debug.facesFound} ·{" "}
                              {debug.ticks > 0
                                ? Math.round(
                                    (debug.facesFound / debug.ticks) * 100,
                                  )
                                : 0}
                              %
                            </span>
                          </div>
                          {debug.initError && (
                            <p className="mt-2 text-red-500 break-words">
                              init error: {debug.initError}
                            </p>
                          )}
                        </div>
                      )}

                      {showFallbackHelp && (
                        <div className="space-y-3 rounded-md border border-gold/30 bg-gold/5 p-4">
                          <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gold">
                              Choose how to continue
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Improve detection: face a light source, move so
                              your face fills the oval, remove glasses, tie
                              hair back so your jawline is visible.
                            </p>
                          </div>
                          {/* Three equal-priority options. We present them
                              side-by-side so the user is never forced into
                              one path — retry is just as first-class as
                              upload or manual pick. */}
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Soft-reset the streak and hint so the
                                // loop gets a fresh attempt without
                                // restarting the camera stream.
                                noFaceStreakRef.current = 0;
                                setShowFallbackHelp(false);
                                setLiveHint("Retrying — look at the camera.");
                              }}
                            >
                              <Camera className="mr-2 h-3.5 w-3.5" />
                              Retry camera
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                stopCamera();
                                fileInputRef.current?.click();
                              }}
                            >
                              <Upload className="mr-2 h-3.5 w-3.5" />
                              Upload photo
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={stopCamera}
                            >
                              Pick manually
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action row */}
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      onClick={acceptLiveResult}
                      disabled={!locked}
                      className="min-w-[140px]"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Use This Result
                    </Button>
                    <Button variant="outline" onClick={stopCamera}>
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {detecting && (
                <div className="flex items-center justify-center gap-2 text-primary py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Analyzing facial features...</span>
                </div>
              )}

              {detectionError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  {detectionError}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoUpload(file);
                }}
              />

              {cameraStatus === "idle" && !detecting && (
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Photo
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={startCamera}>
                    <Camera className="mr-2 h-4 w-4" />
                    Use Camera
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Manual Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Or Select Your Face Shape</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(Object.entries(FACE_SHAPE_INFO) as [FaceShape, typeof FACE_SHAPE_INFO["oval"]][]).map(
                  ([shape, info]) => (
                    <button
                      key={shape}
                      onClick={() => selectManualShape(shape)}
                      className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-center"
                    >
                      <span className="text-2xl">{info.icon}</span>
                      <span className="font-medium text-sm">{info.label}</span>
                      <span className="text-xs text-muted-foreground leading-tight">
                        {info.description.split(".")[0]}
                      </span>
                    </button>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══ STEP 2: Preferences ═══ */}
      {step === "preferences" && faceShape && (
        <div className="space-y-6">
          {/* Selected face shape display */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-4 flex items-center gap-4">
              <span className="text-3xl">{FACE_SHAPE_INFO[faceShape].icon}</span>
              <div>
                <p className="font-medium">
                  Your face shape: <span className="text-primary">{FACE_SHAPE_INFO[faceShape].label}</span>
                </p>
                <p className="text-sm text-muted-foreground">{FACE_SHAPE_INFO[faceShape].description}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Hair Type */}
              <div className="space-y-2">
                <Label>Hair Type</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["straight", "wavy", "curly", "coily"] as HairType[]).map((type) => (
                    <Button
                      key={type}
                      variant={hairType === type ? "default" : "outline"}
                      size="sm"
                      onClick={() => setHairType(type)}
                      className="capitalize"
                    >
                      {type}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Desired Length */}
              <div className="space-y-2">
                <Label>Desired Length</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["short", "medium", "long"] as DesiredLength[]).map((len) => (
                    <Button
                      key={len}
                      variant={desiredLength === len ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDesiredLength(len)}
                      className="capitalize"
                    >
                      {len}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Style Vibe */}
              <div className="space-y-2">
                <Label>Style Vibe</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["classic", "modern", "bold", "natural"] as StyleVibe[]).map((vibe) => (
                    <Button
                      key={vibe}
                      variant={styleVibe === vibe ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStyleVibe(vibe)}
                      className="capitalize"
                    >
                      {vibe}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => goTo("detect")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button className="flex-1" onClick={getRecommendations} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Get Recommendations
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: Results ═══ */}
      {step === "results" && result && (
        <div className="space-y-6">
          {/* Face shape badge */}
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl">{FACE_SHAPE_INFO[result.faceShape].icon}</span>
            <Badge variant="default" className="text-sm px-3 py-1">
              {FACE_SHAPE_INFO[result.faceShape].label} Face
            </Badge>
          </div>

          {/* Recommended Styles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-gold" />
                Recommended Styles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.styles.map((style, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm flex-shrink-0">
                    {style.matchScore}%
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{style.styleName}</p>
                    <p className="text-sm text-muted-foreground">{style.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {style.categories.map((cat) => (
                        <Badge key={cat} variant="outline" className="text-xs capitalize">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Styling Tips */}
          <Card>
            <CardHeader>
              <CardTitle>Styling Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {result.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">{tip}</p>
                </div>
              ))}
              {result.avoid.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border">
                  <p className="text-sm font-medium text-destructive mb-2">Better to Avoid</p>
                  {result.avoid.map((note, i) => (
                    <p key={i} className="text-sm text-muted-foreground">• {note}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Matching Services */}
          {result.services.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Available Services</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {result.services.map((service) => (
                    <div key={service.id} className="p-3 rounded-lg border border-border space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">{service.name}</p>
                          <p className="text-xs text-muted-foreground">{service.duration_minutes} min</p>
                        </div>
                        <span className="font-semibold text-sm">P{Number(service.price).toFixed(0)}</span>
                      </div>
                      <Link href={`/book?service=${service.id}`}>
                        <Button size="sm" className="w-full text-xs">
                          Book This Service
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => goTo("preferences")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Adjust Preferences
            </Button>
            <Link href="/book" className="flex-1">
              <Button className="w-full">
                <ArrowRight className="mr-2 h-4 w-4" />
                Book an Appointment
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
