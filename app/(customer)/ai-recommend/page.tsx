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

// Lazy-loaded face detector. TF.js + MediaPipe weights are ~20 MB, so
// load on demand and cache in a ref — the same instance handles both
// the one-shot upload flow and the continuous live-camera flow.
async function createFaceDetector() {
  const tf = await import("@tensorflow/tfjs");
  await tf.ready();
  const fld = await import("@tensorflow-models/face-landmarks-detection");
  return fld.createDetector(fld.SupportedModels.MediaPipeFaceMesh, {
    runtime: "tfjs",
    refineLandmarks: true,
    maxFaces: 1,
  });
}
type FaceDetector = Awaited<ReturnType<typeof createFaceDetector>>;

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
      detectorRef.current = await createFaceDetector();
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

      const faces = await detector.estimateFaces(img);
      URL.revokeObjectURL(img.src);

      if (faces.length === 0) {
        setDetectionError("No face detected. Please try a clearer photo or select manually below.");
        setDetecting(false);
        return;
      }

      const landmarks = faces[0].keypoints.map((kp) => ({ x: kp.x, y: kp.y }));
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
    setLiveShape(null);
    setStabilityCount(0);
    setLocked(false);
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

      // Detection loop. Each tick: run estimateFaces on the current
      // video frame, classify, push into the sliding history buffer,
      // and update the stability count. Lock when STABILITY_THRESHOLD
      // of the last STABILITY_WINDOW classifications agree.
      loopRef.current = setInterval(async () => {
        const v = videoRef.current;
        if (!v || v.readyState < 2) return;

        try {
          const faces = await detector.estimateFaces(v);
          if (faces.length === 0) {
            historyRef.current = [];
            setLiveShape(null);
            setStabilityCount(0);
            setLocked(false);
            return;
          }

          const landmarks = faces[0].keypoints.map((kp) => ({ x: kp.x, y: kp.y }));
          const shape = classifyFaceShape(landmarks);

          historyRef.current.push(shape);
          if (historyRef.current.length > STABILITY_WINDOW) historyRef.current.shift();

          const matching = historyRef.current.filter((s) => s === shape).length;
          setLiveShape(shape);
          setStabilityCount(matching);
          setLocked(matching >= STABILITY_THRESHOLD);
        } catch {
          // swallow per-frame errors; the loop will recover on the next tick
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
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-full w-full object-cover"
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

                  {/* Helper text */}
                  <p className="text-center text-xs text-muted-foreground">
                    {locked
                      ? "Great! Your face shape is locked in. Confirm below or retry."
                      : "Center your face inside the oval and hold still for a second."}
                  </p>

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
