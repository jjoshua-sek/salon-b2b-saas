"use client";

import { useState, useRef, useCallback, useTransition } from "react";
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
} from "lucide-react";
import {
  FACE_SHAPE_INFO,
  type FaceShape,
} from "@/lib/ai/face-shape";
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
  const [cameraActive, setCameraActive] = useState(false);

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
      // Dynamically import TF.js (heavy — only load when needed)
      const tf = await import("@tensorflow/tfjs");
      await tf.ready();

      const faceLandmarksDetection = await import("@tensorflow-models/face-landmarks-detection");
      const { classifyFaceShape } = await import("@/lib/ai/face-shape");

      const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
      const detector = await faceLandmarksDetection.createDetector(model, {
        runtime: "tfjs",
        refineLandmarks: true,
        maxFaces: 1,
      });

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
  }, [goTo]);

  // ── Camera Handler ──
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch {
      setDetectionError("Camera access denied. Please upload a photo instead.");
    }
  }, []);

  const captureFromCamera = useCallback(async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);

    // Stop camera
    const stream = videoRef.current.srcObject as MediaStream;
    stream?.getTracks().forEach((t) => t.stop());
    setCameraActive(false);

    canvas.toBlob((blob) => {
      if (blob) handlePhotoUpload(new File([blob], "camera-capture.jpg", { type: "image/jpeg" }));
    }, "image/jpeg");
  }, [handlePhotoUpload]);

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

              {/* Photo preview */}
              {photoPreview && (
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreview}
                    alt="Your photo"
                    className="w-48 h-48 object-cover rounded-lg border border-border"
                  />
                </div>
              )}

              {/* Camera view */}
              {cameraActive && (
                <div className="flex flex-col items-center gap-3">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-64 h-48 object-cover rounded-lg border border-border"
                  />
                  <Button onClick={captureFromCamera}>
                    <Camera className="mr-2 h-4 w-4" />
                    Capture Photo
                  </Button>
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

              {!cameraActive && !detecting && (
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
