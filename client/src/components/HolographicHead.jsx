import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import turtleLogo from "../assets/Turtle_logo.png";

const TOP_COLOR = new THREE.Color("#4dff9a");
const MID_COLOR = new THREE.Color("#1ee878");
const BOTTOM_COLOR = new THREE.Color("#00c25a");

const ARKIT_BLENDSHAPES = [
  "browDownLeft", // 0
  "browDownRight", // 1
  "browInnerUp", // 2
  "browOuterUpLeft", // 3
  "browOuterUpRight", // 4
  "cheekPuff", // 5
  "cheekSquintLeft", // 6
  "cheekSquintRight", // 7
  "eyeBlinkLeft", // 8
  "eyeBlinkRight", // 9
  "eyeLookDownLeft", // 10
  "eyeLookDownRight", // 11
  "eyeLookInLeft", // 12
  "eyeLookInRight", // 13
  "eyeLookOutLeft", // 14
  "eyeLookOutRight", // 15
  "eyeLookUpLeft", // 16
  "eyeLookUpRight", // 17
  "eyeSquintLeft", // 18
  "eyeSquintRight", // 19
  "eyeWideLeft", // 20
  "eyeWideRight", // 21
  "jawForward", // 22
  "jawLeft", // 23
  "jawOpen", // 24
  "jawRight", // 25
  "mouthClose", // 26
  "mouthDimpleLeft", // 27
  "mouthDimpleRight", // 28
  "mouthFrownLeft", // 29
  "mouthFrownRight", // 30
  "mouthFunnel", // 31
  "mouthLeft", // 32
  "mouthLowerDownLeft", // 33
  "mouthLowerDownRight", // 34
  "mouthPressLeft", // 35
  "mouthPressRight", // 36
  "mouthPucker", // 37
  "mouthRight", // 38
  "mouthRollLower", // 39
  "mouthRollUpper", // 40
  "mouthShrugLower", // 41
  "mouthShrugUpper", // 42
  "mouthSmileLeft", // 43
  "mouthSmileRight", // 44
  "mouthStretchLeft", // 45
  "mouthStretchRight", // 46
  "mouthUpperUpLeft", // 47
  "mouthUpperUpRight", // 48
  "noseSneerLeft", // 49
  "noseSneerRight", // 50
  "tongueOut", // 51
];

const IDX = {};
ARKIT_BLENDSHAPES.forEach((name, i) => {
  IDX[name] = i;
});

const pointVertexShader = `
  uniform float uTime;
  uniform float uPointSize;
  uniform float uMinY;
  uniform float uMaxY;
  varying float vY;
  varying float vDepth;
  #include <morphtarget_pars_vertex>

  void main() {
    #include <begin_vertex>
    #include <morphtarget_vertex>
    vec3 animated = transformed;
    animated.y += sin(uTime * 0.7 + transformed.x * 2.4) * 0.005;
    vec4 worldPos = modelMatrix * vec4(animated, 1.0);
    vY = (worldPos.y - uMinY) / max(0.0001, (uMaxY - uMinY));
    vec4 mvPosition = modelViewMatrix * vec4(animated, 1.0);
    vDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uPointSize * (1.0 / max(0.25, vDepth));
  }
`;

const pointFragmentShader = `
  uniform vec3 uTopColor;
  uniform vec3 uMidColor;
  uniform vec3 uBottomColor;
  uniform float uOpacity;
  varying float vY;
  varying float vDepth;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;
    float gradient = clamp(vY, 0.0, 1.0);
    vec3 lowToMid = mix(uBottomColor, uMidColor, smoothstep(0.0, 0.55, gradient));
    vec3 midToTop = mix(uMidColor, uTopColor, smoothstep(0.45, 1.0, gradient));
    vec3 base = mix(lowToMid, midToTop, smoothstep(0.25, 0.9, gradient));
    float softEdge = smoothstep(0.5, 0.0, d);
    float glow = pow(softEdge, 2.0);
    float depthFade = clamp(1.4 - vDepth * 0.12, 0.35, 1.0);
    float alpha = uOpacity * glow * depthFade;
    gl_FragColor = vec4(base * (1.35 + glow * 1.1), alpha);
  }
`;

const surfaceVertexShader = `
  uniform float uTime;
  uniform float uMinY;
  uniform float uMaxY;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying float vY;
  varying float vDepth;
  #include <morphtarget_pars_vertex>
  #include <morphtarget_pars_normal>

  void main() {
    #include <beginnormal_vertex>
    #include <morphnormal_vertex>
    #include <defaultnormal_vertex>
    #include <begin_vertex>
    #include <morphtarget_vertex>

    vec3 animated = transformed;
    animated.y += sin(uTime * 0.7 + transformed.x * 2.2) * 0.002;

    vec4 worldPos = modelMatrix * vec4(animated, 1.0);
    vWorldPos = worldPos.xyz;
    vY = (vWorldPos.y - uMinY) / max(0.0001, (uMaxY - uMinY));

    vec4 mvPosition = viewMatrix * worldPos;
    vDepth = -mvPosition.z;
    vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const surfaceFragmentShader = `
  uniform float uTime;
  uniform vec3 uBaseColor;
  uniform vec3 uRimColor;
  uniform vec3 uTopColor;
  uniform vec3 uBottomColor;
  uniform vec3 uLightDir;
  uniform float uOpacity;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying float vY;
  varying float vDepth;

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(uLightDir);

    float ndl = max(dot(N, L), 0.0);
    float rim = pow(1.0 - max(dot(N, V), 0.0), 2.6);

    float gradient = clamp(vY, 0.0, 1.0);
    vec3 verticalTint = mix(uBottomColor, uTopColor, smoothstep(0.12, 0.95, gradient));

    float scanline = 0.76 + 0.24 * sin(vWorldPos.y * 120.0 + uTime * 22.0);
    float contour = 0.9 + 0.1 * sin(vDepth * 18.0 - uTime * 9.0);

    vec3 lit = uBaseColor * (0.24 + ndl * 0.95);
    vec3 hologram = (lit + verticalTint * 0.6) * scanline * contour;
    hologram += uRimColor * rim * 1.65;

    float alpha = uOpacity * (0.42 + rim * 0.85) * clamp(1.35 - vDepth * 0.11, 0.3, 1.0);
    gl_FragColor = vec4(hologram, alpha);
  }
`;

function createFallbackGeometry() {
  const geo = new THREE.IcosahedronGeometry(0.9, 6);
  geo.computeBoundingBox();
  const c = new THREE.Vector3();
  geo.boundingBox.getCenter(c);
  geo.translate(-c.x, -c.y + 0.03, -c.z);
  return geo;
}

function normalizeGeometry(geometry) {
  const g = geometry.clone();
  g.computeBoundingBox();
  const c = new THREE.Vector3();
  g.boundingBox.getCenter(c);
  g.translate(-c.x, -c.y + 0.02, -c.z);

  g.computeBoundingBox();
  const h = Math.max(0.001, g.boundingBox.max.y - g.boundingBox.min.y);
  const s = 1.85 / h;
  g.scale(s, s, s);

  if (g.morphAttributes.position) {
    g.morphAttributes.position.forEach((attr) => {
      const arr = attr.array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] *= s;
        arr[i + 1] *= s;
        arr[i + 2] *= s;
      }
      attr.needsUpdate = true;
    });
  }

  g.computeBoundingBox();
  g.computeVertexNormals();
  return g;
}

function extractHeadMesh(scene) {
  let best = null;
  scene.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry?.attributes?.position) return;
    if (!best) {
      best = obj;
      return;
    }
    const m1 = obj.geometry.morphAttributes?.position?.length || 0;
    const m2 = best.geometry.morphAttributes?.position?.length || 0;
    const v1 = obj.geometry.attributes.position.count;
    const v2 = best.geometry.attributes.position.count;
    if (m1 > m2 || (m1 === m2 && v1 > v2)) best = obj;
  });
  return best;
}

function resolveMorphIndices(pointsObj) {
  const dict = pointsObj?.morphTargetDictionary;
  const count = pointsObj?.morphTargetInfluences?.length || 0;

  if (dict) {
    const named = {};
    Object.entries(dict).forEach(([name, index]) => {
      named[name.toLowerCase()] = index;
    });

    const jawIdx = named["jawopen"] ?? named["jaw_open"];
    if (jawIdx !== undefined) {
      return {
        jawOpen: jawIdx,
        mouthFunnel: named["mouthfunnel"] ?? named["mouth_funnel"] ?? -1,
        mouthPucker: named["mouthpucker"] ?? named["mouth_pucker"] ?? -1,
        mouthLowerDownLeft: named["mouthlowerdownleft"] ?? -1,
        mouthLowerDownRight: named["mouthlowerdownright"] ?? -1,
        mouthUpperUpLeft: named["mouthupperupleft"] ?? -1,
        mouthUpperUpRight: named["mouthupperupright"] ?? -1,
        mouthStretchLeft: named["mouthstretchleft"] ?? -1,
        mouthStretchRight: named["mouthstretchright"] ?? -1,
        mouthLeft: named["mouthleft"] ?? -1,
        mouthRight: named["mouthright"] ?? -1,
        eyeBlinkLeft: named["eyeblinkleft"] ?? -1,
        eyeBlinkRight: named["eyeblinkright"] ?? -1,
      };
    }
  }

  if (count === 52) {
    return {
      jawOpen: IDX.jawOpen,
      mouthFunnel: IDX.mouthFunnel,
      mouthPucker: IDX.mouthPucker,
      mouthLowerDownLeft: IDX.mouthLowerDownLeft,
      mouthLowerDownRight: IDX.mouthLowerDownRight,
      mouthUpperUpLeft: IDX.mouthUpperUpLeft,
      mouthUpperUpRight: IDX.mouthUpperUpRight,
      mouthStretchLeft: IDX.mouthStretchLeft,
      mouthStretchRight: IDX.mouthStretchRight,
      mouthLeft: IDX.mouthLeft,
      mouthRight: IDX.mouthRight,
      eyeBlinkLeft: IDX.eyeBlinkLeft,
      eyeBlinkRight: IDX.eyeBlinkRight,
    };
  }

  return {
    jawOpen: 0,
    mouthFunnel: -1,
    mouthPucker: -1,
    mouthLowerDownLeft: -1,
    mouthLowerDownRight: -1,
    mouthUpperUpLeft: -1,
    mouthUpperUpRight: -1,
    mouthStretchLeft: -1,
    mouthStretchRight: -1,
    mouthLeft: -1,
    mouthRight: -1,
    eyeBlinkLeft: -1,
    eyeBlinkRight: -1,
  };
}

function setInfluence(influences, idx, value) {
  if (idx >= 0 && idx < influences.length) influences[idx] = value;
}

function getBandEnergy(dataArray, sampleRate, fftSize, minHz, maxHz) {
  const nyquist = sampleRate * 0.5;
  const hzPerBin = nyquist / dataArray.length;
  const start = Math.max(0, Math.floor(minHz / hzPerBin));
  const end = Math.min(dataArray.length - 1, Math.ceil(maxHz / hzPerBin));
  if (end <= start) return 0;

  let sum = 0;
  for (let i = start; i <= end; i += 1) sum += dataArray[i];
  return sum / ((end - start + 1) * 255);
}

function smoothEnvelope(current, target, delta, attack = 28, release = 9) {
  const speed = target > current ? attack : release;
  const alpha = 1 - Math.exp(-delta * speed);
  return THREE.MathUtils.lerp(current, target, alpha);
}

function PointHead({
  modelUrl,
  isPlaying,
  isProcessing,
  isRecording,
  isLoading,
  conversationEnded,
  audioAnalyserRef,
  onModelState,
}) {
  const groupRef = useRef(null);
  const pointsRef = useRef(null);
  const detailPointsRef = useRef(null);
  const surfaceRef = useRef(null);
  const cloudRef = useRef(null);
  const audioStateRef = useRef({
    low: 0,
    mid: 0,
    high: 0,
    overall: 0,
    flux: 0,
    cadence: 0,
    noiseFloor: 0.01,
    speechGate: 0,
    prevMidRaw: 0,
  });
  const visemeStateRef = useRef({
    jawOpen: 0,
    mouthFunnel: 0,
    mouthPucker: 0,
    mouthLowerDownLeft: 0,
    mouthLowerDownRight: 0,
    mouthUpperUpLeft: 0,
    mouthUpperUpRight: 0,
    mouthStretchLeft: 0,
    mouthStretchRight: 0,
    mouthLeft: 0,
    mouthRight: 0,
  });
  const morphMapRef = useRef(null);
  const wasPlayingRef = useRef(false);
  const speechWarmupRef = useRef(0);
  const bobPhaseRef = useRef(0);
  const smoothedTransformRef = useRef({ y: 0.16, ry: 0, rx: 0 });

  const [geometry, setGeometry] = useState(() => createFallbackGeometry());
  const [bounds, setBounds] = useState({ minY: -1, maxY: 1 });

  const cloudPositions = useMemo(() => {
    const arr = new Float32Array(1600 * 3);
    for (let i = 0; i < 1600; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1.2 + Math.random() * 1.45;
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPointSize: { value: 10.0 },
      uMinY: { value: -1 },
      uMaxY: { value: 1 },
      uTopColor: { value: TOP_COLOR.clone() },
      uMidColor: { value: MID_COLOR.clone() },
      uBottomColor: { value: BOTTOM_COLOR.clone() },
      uOpacity: { value: 0.98 },
    }),
    [],
  );

  const detailUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPointSize: { value: 6.1 },
      uMinY: { value: -1 },
      uMaxY: { value: 1 },
      uTopColor: { value: new THREE.Color("#9dffcb") },
      uMidColor: { value: new THREE.Color("#46f59b") },
      uBottomColor: { value: new THREE.Color("#08b862") },
      uOpacity: { value: 0.5 },
    }),
    [],
  );

  const surfaceUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMinY: { value: -1 },
      uMaxY: { value: 1 },
      uBaseColor: { value: new THREE.Color("#2de88f") },
      uRimColor: { value: new THREE.Color("#c8ffe4") },
      uTopColor: { value: new THREE.Color("#8effcb") },
      uBottomColor: { value: new THREE.Color("#09ab61") },
      uLightDir: { value: new THREE.Vector3(0.65, 0.95, 0.55).normalize() },
      uOpacity: { value: 0.34 },
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    onModelState("loading");
    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        if (cancelled) return;
        const mesh = extractHeadMesh(gltf.scene);
        if (!mesh) {
          onModelState("fallback");
          return;
        }

        const norm = normalizeGeometry(mesh.geometry);
        setGeometry(norm);
        setBounds({
          minY: norm.boundingBox.min.y,
          maxY: norm.boundingBox.max.y,
        });
        onModelState("ready");
      },
      undefined,
      () => {
        if (!cancelled) onModelState("fallback");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [modelUrl, onModelState]);

  useEffect(() => {
    uniforms.uMinY.value = bounds.minY;
    uniforms.uMaxY.value = bounds.maxY;
    detailUniforms.uMinY.value = bounds.minY;
    detailUniforms.uMaxY.value = bounds.maxY;
    surfaceUniforms.uMinY.value = bounds.minY;
    surfaceUniforms.uMaxY.value = bounds.maxY;
  }, [bounds, uniforms, detailUniforms, surfaceUniforms]);

  useEffect(() => {
    if (!pointsRef.current) return;
    pointsRef.current.updateMorphTargets();
    detailPointsRef.current?.updateMorphTargets();
    surfaceRef.current?.updateMorphTargets();
    morphMapRef.current = resolveMorphIndices(pointsRef.current);
  }, [geometry]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    uniforms.uTime.value = t;
    detailUniforms.uTime.value = t;
    surfaceUniforms.uTime.value = t;

    if (isPlaying && !wasPlayingRef.current) {
      speechWarmupRef.current = 0;
      audioStateRef.current.speechGate = 0;
    }
    if (!isPlaying && wasPlayingRef.current) {
      speechWarmupRef.current = 0;
    }
    if (isPlaying) speechWarmupRef.current += delta;
    wasPlayingRef.current = isPlaying;

    let lowRaw = 0;
    let midRaw = 0;
    let highRaw = 0;
    let overallRaw = 0;
    if (
      isPlaying &&
      audioAnalyserRef?.current?.analyser &&
      audioAnalyserRef.current.dataArray
    ) {
      const { analyser, dataArray } = audioAnalyserRef.current;
      analyser.getByteFrequencyData(dataArray);
      const sampleRate = analyser.context?.sampleRate || 44100;
      const fftSize = analyser.fftSize || 2048;

      lowRaw = getBandEnergy(dataArray, sampleRate, fftSize, 80, 320);
      midRaw = getBandEnergy(dataArray, sampleRate, fftSize, 320, 2200);
      highRaw = getBandEnergy(dataArray, sampleRate, fftSize, 2200, 6000);
      overallRaw = lowRaw * 0.5 + midRaw * 0.35 + highRaw * 0.15;
    }

    const audioState = audioStateRef.current;
    audioState.low = smoothEnvelope(audioState.low, lowRaw, delta, 34, 9);
    audioState.mid = smoothEnvelope(audioState.mid, midRaw, delta, 32, 8);
    audioState.high = smoothEnvelope(audioState.high, highRaw, delta, 30, 7);
    audioState.overall = smoothEnvelope(
      audioState.overall,
      overallRaw,
      delta,
      28,
      7,
    );
    const fluxRaw = Math.abs(midRaw - audioState.prevMidRaw);
    audioState.prevMidRaw = midRaw;
    audioState.flux = smoothEnvelope(audioState.flux, fluxRaw, delta, 22, 14);
    const flux = audioState.flux;

    const floorTarget = isPlaying
      ? Math.min(audioState.noiseFloor, overallRaw)
      : 0.01;
    audioState.noiseFloor = smoothEnvelope(
      audioState.noiseFloor,
      floorTarget,
      delta,
      2.5,
      0.8,
    );

    const speechEnergy = THREE.MathUtils.clamp(
      (audioState.overall - audioState.noiseFloor - 0.01) * 6.2,
      0,
      1,
    );
    const cadenceTarget = THREE.MathUtils.clamp(
      flux * 12.0 + speechEnergy * 0.2,
      0,
      1,
    );
    audioState.cadence = smoothEnvelope(
      audioState.cadence,
      cadenceTarget,
      delta,
      22,
      15,
    );

    const warmup = THREE.MathUtils.smoothstep(
      speechWarmupRef.current,
      0.08,
      0.2,
    );
    const speechGateTarget = isPlaying
      ? THREE.MathUtils.clamp((speechEnergy - 0.03) * 2.2, 0, 1) * warmup
      : 0;
    audioState.speechGate = smoothEnvelope(
      audioState.speechGate,
      speechGateTarget,
      delta,
      18,
      6,
    );

    const infl = pointsRef.current?.morphTargetInfluences;
    const detailInfl = detailPointsRef.current?.morphTargetInfluences;
    const surfaceInfl = surfaceRef.current?.morphTargetInfluences;
    const mm = morphMapRef.current;
    if (infl && mm) {
      const speech = audioState.speechGate;
      const syllablePulse =
        0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 12.0 + audioState.mid * 10.0));
      const articulation = THREE.MathUtils.clamp(
        audioState.cadence * 0.78 + syllablePulse * 0.22,
        0,
        1,
      );
      const gatedEnergy = speechEnergy > 0.06 ? speechEnergy : 0;
      const jawTarget = isPlaying
        ? THREE.MathUtils.clamp(
            gatedEnergy * (0.04 + articulation * 0.92),
            0,
            0.68,
          ) * speech
        : 0;

      const funnelTarget = isPlaying
        ? THREE.MathUtils.clamp(
            audioState.mid * 0.5 + jawTarget * 0.18 - audioState.high * 0.08,
            0,
            0.5,
          ) * speech
        : 0;
      const puckerTarget = isPlaying
        ? THREE.MathUtils.clamp(
            audioState.high * 0.22 +
              (1 - jawTarget) * 0.04 -
              funnelTarget * 0.22,
            0,
            0.18,
          ) * speech
        : 0;
      const lowerLipTarget = isPlaying
        ? THREE.MathUtils.clamp(
            jawTarget * 0.55 + audioState.mid * 0.12,
            0,
            0.62,
          )
        : 0;
      const upperLipTarget = isPlaying
        ? THREE.MathUtils.clamp(funnelTarget * 0.22 + jawTarget * 0.12, 0, 0.36)
        : 0;
      const stretchTarget = isPlaying
        ? THREE.MathUtils.clamp(audioState.mid * 0.06 + flux * 0.04, 0, 0.12)
        : 0;

      const targets = {
        jawOpen: jawTarget,
        mouthFunnel: funnelTarget,
        mouthPucker: puckerTarget,
        mouthLowerDownLeft: lowerLipTarget,
        mouthLowerDownRight: lowerLipTarget,
        mouthUpperUpLeft: upperLipTarget,
        mouthUpperUpRight: upperLipTarget,
        mouthStretchLeft: stretchTarget,
        mouthStretchRight: stretchTarget,
        mouthLeft: 0,
        mouthRight: 0,
      };

      const states = visemeStateRef.current;
      Object.keys(targets).forEach((name) => {
        states[name] = smoothEnvelope(
          states[name],
          targets[name],
          delta,
          name === "jawOpen" ? 18 : 15,
          name === "jawOpen" ? 11 : 9,
        );
        states[name] = THREE.MathUtils.clamp(states[name], 0, 1);
      });

      setInfluence(infl, mm.jawOpen, states.jawOpen);
      setInfluence(infl, mm.mouthFunnel, states.mouthFunnel);
      setInfluence(infl, mm.mouthPucker, states.mouthPucker);
      setInfluence(infl, mm.mouthLowerDownLeft, states.mouthLowerDownLeft);
      setInfluence(infl, mm.mouthLowerDownRight, states.mouthLowerDownRight);
      setInfluence(infl, mm.mouthUpperUpLeft, states.mouthUpperUpLeft);
      setInfluence(infl, mm.mouthUpperUpRight, states.mouthUpperUpRight);
      setInfluence(infl, mm.mouthStretchLeft, states.mouthStretchLeft);
      setInfluence(infl, mm.mouthStretchRight, states.mouthStretchRight);
      setInfluence(infl, mm.mouthLeft, states.mouthLeft);
      setInfluence(infl, mm.mouthRight, states.mouthRight);

      setInfluence(infl, mm.eyeBlinkLeft, 0);
      setInfluence(infl, mm.eyeBlinkRight, 0);

      if (detailInfl) {
        const max = Math.min(infl.length, detailInfl.length);
        for (let i = 0; i < max; i += 1) {
          detailInfl[i] = infl[i];
        }
      }
      if (surfaceInfl) {
        const max = Math.min(infl.length, surfaceInfl.length);
        for (let i = 0; i < max; i += 1) {
          surfaceInfl[i] = infl[i];
        }
      }
    }

    const aiState = isLoading
      ? "loading"
      : conversationEnded
        ? "ended"
        : isPlaying
          ? "speaking"
          : isProcessing
            ? "thinking"
            : isRecording
              ? "listening"
              : "idle";

    if (groupRef.current) {
      const baseY = 0.16;
      const bobAmplitude = aiState === "speaking" ? 0.045 : 0.03;
      const bobSpeed = aiState === "speaking" ? 1.05 : 0.55;
      bobPhaseRef.current += bobSpeed * delta;

      const yTarget = baseY + Math.sin(bobPhaseRef.current) * bobAmplitude;
      const ryTarget =
        Math.sin(t * 0.35) * (aiState === "thinking" ? 0.11 : 0.06);
      const rxTarget = Math.sin(t * 0.24 + 0.8) * 0.03;

      const smooth = smoothedTransformRef.current;
      const s = 1 - Math.exp(-delta * 7.0);
      smooth.y = THREE.MathUtils.lerp(smooth.y, yTarget, s);
      smooth.ry = THREE.MathUtils.lerp(smooth.ry, ryTarget, s);
      smooth.rx = THREE.MathUtils.lerp(smooth.rx, rxTarget, s);

      groupRef.current.position.y = smooth.y;
      groupRef.current.rotation.y = smooth.ry;
      groupRef.current.rotation.x = smooth.rx;
    }
    if (cloudRef.current) {
      cloudRef.current.rotation.y = t * 0.1;
      cloudRef.current.rotation.x = Math.sin(t * 0.22) * 0.08;
    }

    const opacityTarget =
      aiState === "ended" ? 0.45 : aiState === "loading" ? 0.78 : 0.92;
    uniforms.uOpacity.value +=
      (opacityTarget - uniforms.uOpacity.value) * delta * 3;
    const pointSizeTarget = aiState === "speaking" ? 12.2 : 10.8;
    uniforms.uPointSize.value +=
      (pointSizeTarget - uniforms.uPointSize.value) * delta * 5;

    const detailPointSizeTarget = aiState === "speaking" ? 6.8 : 6.0;
    detailUniforms.uPointSize.value +=
      (detailPointSizeTarget - detailUniforms.uPointSize.value) * delta * 4;

    const surfaceOpacityTarget =
      aiState === "ended" ? 0.2 : aiState === "loading" ? 0.28 : 0.42;
    surfaceUniforms.uOpacity.value +=
      (surfaceOpacityTarget - surfaceUniforms.uOpacity.value) * delta * 3.8;
  });

  return (
    <group ref={groupRef} position={[0, 0.12, 0.12]}>
      <points ref={pointsRef} geometry={geometry}>
        <shaderMaterial
          vertexShader={pointVertexShader}
          fragmentShader={pointFragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          morphTargets
        />
      </points>

      <points ref={detailPointsRef} geometry={geometry}>
        <shaderMaterial
          vertexShader={pointVertexShader}
          fragmentShader={pointFragmentShader}
          uniforms={detailUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          morphTargets
        />
      </points>

      <mesh ref={surfaceRef} geometry={geometry}>
        <shaderMaterial
          vertexShader={surfaceVertexShader}
          fragmentShader={surfaceFragmentShader}
          uniforms={surfaceUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          morphTargets
        />
      </mesh>

      <mesh geometry={geometry}>
        <meshBasicMaterial
          color="#9fffd0"
          transparent
          opacity={0.06}
          wireframe
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <points ref={cloudRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={cloudPositions}
            count={1600}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#1b9e4b"
          size={0.012}
          transparent
          opacity={0.14}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

function Scene(props) {
  return (
    <>
      <ambientLight intensity={0.16} />
      <hemisphereLight intensity={0.4} color="#88ffd4" groundColor="#062417" />
      <directionalLight
        position={[1.3, 2.4, 2.1]}
        intensity={0.72}
        color="#7dffb5"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.1}
        shadow-camera-far={12}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />
      <pointLight position={[0.5, 1.6, 2.2]} intensity={0.74} color="#59ff76" />
      <pointLight
        position={[-1.2, -1.1, 1.8]}
        intensity={0.56}
        color="#2aff6d"
      />
      <pointLight position={[0, 0, 2.8]} intensity={0.33} color="#8affa2" />
      <pointLight position={[0, 0.2, 1.4]} intensity={0.43} color="#e8fff1" />
      <pointLight
        position={[-1.6, 0.5, -1.4]}
        intensity={0.52}
        color="#1cf18f"
      />
      <pointLight
        position={[1.5, -0.1, -1.6]}
        intensity={0.45}
        color="#7effcb"
      />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -1.35, -0.05]}
        receiveShadow
      >
        <planeGeometry args={[8, 8]} />
        <shadowMaterial transparent opacity={0.23} />
      </mesh>

      <PointHead {...props} />
    </>
  );
}

export default function HolographicHead({
  isPlaying,
  isProcessing,
  isRecording,
  isLoading,
  conversationEnded,
  audioAnalyserRef,
  messages,
  liveTranscript,
}) {
  const [modelState, setModelState] = useState("loading");
  const stableSetModelState = useCallback((s) => setModelState(s), []);

  const modelUrl = useMemo(
    () => new URL("../model/hologram-face.glb", import.meta.url).href,
    [],
  );

  const lastAssistantMsg = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "assistant") return messages[i].content;
    }
    return null;
  }, [messages]);

  let subtitle = null;
  let subtitleSpeaker = null;
  if (isPlaying && lastAssistantMsg) {
    subtitle = lastAssistantMsg;
    subtitleSpeaker = "Customer";
  } else if (liveTranscript) {
    subtitle = `"${liveTranscript}"`;
    subtitleSpeaker = "You";
  }

  let statusText = null;
  let statusClass = "";
  if (isLoading || modelState === "loading")
    statusText = "Preparing hologram...";
  else if (isRecording) {
    statusText = "Listening...";
    statusClass = "recording";
  } else if (isProcessing) statusText = "Thinking...";
  else if (isPlaying) {
    statusText = "Speaking...";
    statusClass = "speaking";
  } else if (conversationEnded) {
    statusText = "Session Complete";
    statusClass = "ended";
  } else if (modelState === "fallback")
    statusText = "Model not found - using fallback";

  return (
    <div className="hologram-panel">
      <div className="hologram-canvas-stage">
        <div className="hologram-canvas-frame">
          <div className="hologram-contrast-plate" aria-hidden="true" />
          <Canvas
            className="hologram-canvas"
            camera={{ position: [0, 0.1, 1.65], fov: 36 }}
            shadows
            dpr={[1, 1.5]}
            gl={{
              alpha: true,
              antialias: false,
              depth: true,
              stencil: false,
              powerPreference: "high-performance",
              preserveDrawingBuffer: false,
            }}
            onCreated={({ gl }) => {
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.08;
            }}
            style={{ background: "#191e22" }}
          >
            <fog attach="fog" args={["#242b30", 4, 11]} />
            <Scene
              modelUrl={modelUrl}
              isPlaying={isPlaying}
              isProcessing={isProcessing}
              isRecording={isRecording}
              isLoading={isLoading}
              conversationEnded={conversationEnded}
              audioAnalyserRef={audioAnalyserRef}
              onModelState={stableSetModelState}
            />
          </Canvas>
        </div>
      </div>

      <div className="hologram-watermark">
        <img src={turtleLogo} alt="" className="hologram-watermark-logo" />
        <span className="hologram-watermark-text">
          Turtle Sales AI Sales Trainer
        </span>
      </div>

      {(modelState === "loading" || isLoading) && (
        <div className="hologram-loading">
          <div className="hologram-loading-spinner" />
          <span>Loading 3D avatar...</span>
        </div>
      )}

      {statusText && (
        <div className="hologram-status">
          <span className={`hologram-status-dot ${statusClass}`} />
          <span>{statusText}</span>
        </div>
      )}

      {subtitle && (
        <div className="hologram-subtitle">
          <span
            className={`hologram-subtitle-speaker ${subtitleSpeaker === "You" ? "is-you" : "is-customer"}`}
          >
            {subtitleSpeaker}
          </span>
          <p className="hologram-subtitle-text">{subtitle}</p>
        </div>
      )}
    </div>
  );
}
