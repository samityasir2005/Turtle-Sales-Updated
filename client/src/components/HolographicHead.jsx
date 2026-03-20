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
import turtleLogo from "../assets/logo.png";

const TOP_COLOR = new THREE.Color("#4dff9a");
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
  uniform vec3 uBottomColor;
  uniform float uOpacity;
  varying float vY;
  varying float vDepth;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;
    float gradient = clamp(vY, 0.0, 1.0);
    vec3 base = mix(uBottomColor, uTopColor, gradient);
    float softEdge = smoothstep(0.5, 0.0, d);
    float glow = pow(softEdge, 2.0);
    float depthFade = clamp(1.4 - vDepth * 0.12, 0.35, 1.0);
    float alpha = uOpacity * glow * depthFade;
    gl_FragColor = vec4(base * (1.35 + glow * 1.1), alpha);
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
    eyeBlinkLeft: -1,
    eyeBlinkRight: -1,
  };
}

function setInfluence(influences, idx, value) {
  if (idx >= 0 && idx < influences.length) influences[idx] = value;
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
  const cloudRef = useRef(null);
  const smoothAudioRef = useRef(0);
  const morphMapRef = useRef(null);

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
      uBottomColor: { value: BOTTOM_COLOR.clone() },
      uOpacity: { value: 0.98 },
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
  }, [bounds, uniforms]);

  useEffect(() => {
    if (!pointsRef.current) return;
    pointsRef.current.updateMorphTargets();
    morphMapRef.current = resolveMorphIndices(pointsRef.current);
  }, [geometry]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    uniforms.uTime.value = t;

    let rawLevel = 0;
    if (
      isPlaying &&
      audioAnalyserRef?.current?.analyser &&
      audioAnalyserRef.current.dataArray
    ) {
      const { analyser, dataArray } = audioAnalyserRef.current;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      let count = 0;
      for (let i = 2; i < Math.floor(dataArray.length * 0.55); i += 1) {
        sum += dataArray[i];
        count += 1;
      }
      rawLevel = count ? sum / (count * 255) : 0;
    }
    smoothAudioRef.current += (rawLevel - smoothAudioRef.current) * 0.22;
    const audio = smoothAudioRef.current;

    const infl = pointsRef.current?.morphTargetInfluences;
    const mm = morphMapRef.current;
    if (infl && mm) {
      const jawTarget = isPlaying
        ? THREE.MathUtils.clamp((audio - 0.02) * 3.0, 0, 1)
        : 0;

      const variation = isPlaying
        ? Math.sin(t * 8) * 0.15 + Math.sin(t * 13) * 0.1
        : 0;
      const funnelTarget = isPlaying
        ? THREE.MathUtils.clamp(jawTarget * 0.55 + variation * 0.2, 0, 0.7)
        : 0;
      const lowerLipTarget = isPlaying
        ? THREE.MathUtils.clamp(jawTarget * 0.65, 0, 0.8)
        : 0;
      const upperLipTarget = isPlaying
        ? THREE.MathUtils.clamp(jawTarget * 0.3, 0, 0.5)
        : 0;
      const stretchTarget = isPlaying
        ? THREE.MathUtils.clamp(jawTarget * 0.25 + variation * 0.1, 0, 0.4)
        : 0;

      const lerpSpeed = 0.28;
      setInfluence(
        infl,
        mm.jawOpen,
        THREE.MathUtils.lerp(infl[mm.jawOpen] || 0, jawTarget, lerpSpeed),
      );
      setInfluence(
        infl,
        mm.mouthFunnel,
        THREE.MathUtils.lerp(infl[mm.mouthFunnel] || 0, funnelTarget, 0.2),
      );
      setInfluence(
        infl,
        mm.mouthPucker,
        THREE.MathUtils.lerp(
          infl[mm.mouthPucker] || 0,
          funnelTarget * 0.4,
          0.15,
        ),
      );
      setInfluence(
        infl,
        mm.mouthLowerDownLeft,
        THREE.MathUtils.lerp(
          infl[mm.mouthLowerDownLeft] || 0,
          lowerLipTarget,
          0.22,
        ),
      );
      setInfluence(
        infl,
        mm.mouthLowerDownRight,
        THREE.MathUtils.lerp(
          infl[mm.mouthLowerDownRight] || 0,
          lowerLipTarget,
          0.22,
        ),
      );
      setInfluence(
        infl,
        mm.mouthUpperUpLeft,
        THREE.MathUtils.lerp(
          infl[mm.mouthUpperUpLeft] || 0,
          upperLipTarget,
          0.18,
        ),
      );
      setInfluence(
        infl,
        mm.mouthUpperUpRight,
        THREE.MathUtils.lerp(
          infl[mm.mouthUpperUpRight] || 0,
          upperLipTarget,
          0.18,
        ),
      );
      setInfluence(
        infl,
        mm.mouthStretchLeft,
        THREE.MathUtils.lerp(
          infl[mm.mouthStretchLeft] || 0,
          stretchTarget,
          0.15,
        ),
      );
      setInfluence(
        infl,
        mm.mouthStretchRight,
        THREE.MathUtils.lerp(
          infl[mm.mouthStretchRight] || 0,
          stretchTarget,
          0.15,
        ),
      );

      setInfluence(infl, mm.eyeBlinkLeft, 0);
      setInfluence(infl, mm.eyeBlinkRight, 0);
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
      groupRef.current.position.y =
        baseY +
        Math.sin(t * (aiState === "speaking" ? 1.05 : 0.55)) * bobAmplitude;
      groupRef.current.rotation.y =
        Math.sin(t * 0.35) * (aiState === "thinking" ? 0.11 : 0.06);
      groupRef.current.rotation.x = Math.sin(t * 0.24 + 0.8) * 0.03;
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
      <ambientLight intensity={0.26} />
      <pointLight position={[0.5, 1.6, 2.2]} intensity={0.8} color="#59ff76" />
      <pointLight
        position={[-1.2, -1.1, 1.8]}
        intensity={0.55}
        color="#2aff6d"
      />
      <pointLight position={[0, 0, 2.8]} intensity={0.4} color="#8affa2" />
      <pointLight position={[0, 0.2, 1.4]} intensity={0.5} color="#e8fff1" />
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
      <div className="hologram-contrast-plate" aria-hidden="true" />
      <Canvas
        camera={{ position: [0, 0.1, 2.0], fov: 40 }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true, toneMapping: THREE.NoToneMapping }}
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
          <span className="hologram-subtitle-speaker">{subtitleSpeaker}</span>
          <p className="hologram-subtitle-text">{subtitle}</p>
        </div>
      )}
    </div>
  );
}
