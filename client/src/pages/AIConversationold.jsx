import React, { useState, useEffect, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../usercontext/UserContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiMic,
  FiMicOff,
  FiRefreshCw,
  FiArrowLeft,
  FiVolume2,
  FiMessageSquare,
  FiAlertCircle,
  FiHelpCircle,
  FiClock,
  FiX,
  FiAward,
  FiZap,
  FiSettings,
  FiEye,
} from "react-icons/fi";
import HolographicHead from "../components/HolographicHead";
import "../styles/AIConversation.css";

const API_BASE_URL =
  import.meta.env.VITE_AI_API_URL || "http://localhost:5001/api";
const GLANCE_TIMEOUT_MS = 4500;
const DETECTION_THROTTLE_MS = 66;
const GAZE_HISTORY_SIZE = 5;

// ── Eye-Contact Detection Math ──────────────────────────────────

function dist2D(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function avgLandmark(landmarks, indices) {
  let sx = 0,
    sy = 0;
  for (const i of indices) {
    sx += landmarks[i].x;
    sy += landmarks[i].y;
  }
  const n = indices.length;
  return { x: sx / n, y: sy / n };
}

/**
 * Determines whether the user is making eye contact with the camera.
 * Three-tier pipeline: head-pose reject → blendshape gaze → geometric iris fallback.
 *
 * @param {Array<{x:number,y:number,z:number}>} landmarks  478 normalized face landmarks
 * @param {Array<{categoryName:string,score:number}>|null} blendshapes  52 ARKit blendshape scores
 * @returns {boolean} true when the user appears to be looking at the camera
 */
function checkEyeContact(landmarks, blendshapes) {
  if (!landmarks || landmarks.length < 468) return false;

  // ── Tier 1 ── Head Pose Quick Reject (yaw + pitch via nose position)
  const noseTip = landmarks[1];
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];
  const faceWidth = Math.abs(rightCheek.x - leftCheek.x);

  if (faceWidth > 0.01) {
    const faceCenterX = (leftCheek.x + rightCheek.x) / 2;
    const yawDeviation = Math.abs(noseTip.x - faceCenterX) / faceWidth;
    if (yawDeviation > 0.22) return false;
  }

  const forehead = landmarks[10];
  const chin = landmarks[152];
  const faceHeight = Math.abs(chin.y - forehead.y);

  if (faceHeight > 0.01) {
    const faceCenterY = (forehead.y + chin.y) / 2;
    const pitchDeviation = (noseTip.y - faceCenterY) / faceHeight;
    if (pitchDeviation > 0.38 || pitchDeviation < -0.22) return false;
  }

  // ── Tier 2 ── Blendshape Gaze Analysis (primary when available)
  if (blendshapes && blendshapes.length > 0) {
    const s = {};
    for (const b of blendshapes) s[b.categoryName] = b.score;

    const blinkL = s.eyeBlinkLeft || 0;
    const blinkR = s.eyeBlinkRight || 0;

    // Both eyes closed → natural blink, not gaze-aversion
    if (blinkL > 0.5 && blinkR > 0.5) return true;

    const THRESH = 0.2;
    const eyeOpen = { left: blinkL < 0.5, right: blinkR < 0.5 };

    // Only evaluate directional scores for open eyes (closed-eye scores are unreliable)
    if (eyeOpen.left) {
      if ((s.eyeLookInLeft || 0) > THRESH) return false;
      if ((s.eyeLookOutLeft || 0) > THRESH) return false;
      if ((s.eyeLookUpLeft || 0) > THRESH) return false;
      if ((s.eyeLookDownLeft || 0) > THRESH) return false;
    }

    if (eyeOpen.right) {
      if ((s.eyeLookInRight || 0) > THRESH) return false;
      if ((s.eyeLookOutRight || 0) > THRESH) return false;
      if ((s.eyeLookUpRight || 0) > THRESH) return false;
      if ((s.eyeLookDownRight || 0) > THRESH) return false;
    }

    return true;
  }

  // ── Tier 3 ── Geometric Iris Position Fallback (no blendshapes)
  if (landmarks.length < 478) return false;

  // Left iris center (468-472), eye corners (33=outer, 133=inner)
  const leftIris = avgLandmark(landmarks, [468, 469, 470, 471, 472]);
  const leftOuter = landmarks[33];
  const leftInner = landmarks[133];
  const leftWidth = dist2D(leftOuter, leftInner);
  const leftRatio =
    leftWidth > 0.001 ? dist2D(leftOuter, leftIris) / leftWidth : 0.5;

  // Right iris center (473-477), eye corners (362=inner, 263=outer)
  const rightIris = avgLandmark(landmarks, [473, 474, 475, 476, 477]);
  const rightInner = landmarks[362];
  const rightOuter = landmarks[263];
  const rightWidth = dist2D(rightOuter, rightInner);
  const rightRatio =
    rightWidth > 0.001 ? dist2D(rightOuter, rightIris) / rightWidth : 0.5;

  // Center deadzone: ratio ~0.5 when looking straight ahead
  const avgRatio = (leftRatio + rightRatio) / 2;
  return avgRatio >= 0.35 && avgRatio <= 0.65;
}

const AIConversation = () => {
  const { token } = useContext(UserContext);
  const navigate = useNavigate();

  // Session state
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Input state
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");

  const [onboardingStage, setOnboardingStage] = useState("greeting");
  const [tourStep, setTourStep] = useState(0);
  const [countdownNumber, setCountdownNumber] = useState(3);

  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const [showHint, setShowHint] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);

  const [conversationEnded, setConversationEnded] = useState(false);
  const [conversationOutcome, setConversationOutcome] = useState(null);
  const [scoreData, setScoreData] = useState(null);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [eyeContactEnabled, setEyeContactEnabled] = useState(false);
  const [eyeContactStatus, setEyeContactStatus] = useState(null);
  const [eyeContactLevel, setEyeContactLevel] = useState("good");
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const eyeRafRef = useRef(null);
  const lastFrameTimeRef = useRef(0);
  const lastGlanceTimeRef = useRef(Date.now());
  const gazeHistoryRef = useRef([]);
  const eyeLevelRef = useRef("good");
  const prevStatusRef = useRef({ faceDetected: false, looking: false });
  const serverReportTimeRef = useRef(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const messagesEndRef = useRef(null);
  const audioRef = useRef(null);
  const recordingStartTimeRef = useRef(null);
  const hasInitialized = useRef(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const greetingAudioRef = useRef(null);
  const hintTimerRef = useRef(null);
  const hintAutoCloseRef = useRef(null);
  const userHasSpokenRef = useRef(false);
  const audioAnalyserRef = useRef({ analyser: null, dataArray: null });

  useEffect(() => {
    if (!sessionStartTime || conversationEnded) return;
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - sessionStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime, conversationEnded]);

  useEffect(() => {
    if (
      sessionId &&
      !hintDismissed &&
      !userHasSpokenRef.current &&
      onboardingStage === "complete"
    ) {
      hintTimerRef.current = setTimeout(() => {
        if (!userHasSpokenRef.current) {
          setShowHint(true);
          hintAutoCloseRef.current = setTimeout(() => {
            setShowHint(false);
            setHintDismissed(true);
          }, 10000);
        }
      }, 60000);
    }
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      if (hintAutoCloseRef.current) clearTimeout(hintAutoCloseRef.current);
    };
  }, [sessionId, hintDismissed, onboardingStage]);

  const dismissHint = () => {
    setShowHint(false);
    setHintDismissed(true);
    if (hintAutoCloseRef.current) clearTimeout(hintAutoCloseRef.current);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getOutcomeLabel = (outcome) => {
    switch (outcome) {
      case "sale_closed":
        return "Sale Closed!";
      case "door_closed":
        return "Door Closed";
      case "took_info":
        return "Took Info";
      default:
        return "Session Complete";
    }
  };

  const getOutcomeColor = (outcome) => {
    switch (outcome) {
      case "sale_closed":
        return "#2e7d32";
      case "door_closed":
        return "#c62828";
      case "took_info":
        return "#f57c00";
      default:
        return "#666";
    }
  };

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    if (!token) {
      navigate("/login");
      return;
    }

    if (!hasInitialized.current) {
      hasInitialized.current = true;
      // Check if user has completed onboarding before
      const hasCompletedOnboarding = localStorage.getItem(
        "turtlesales_onboarding_complete",
      );
      if (hasCompletedOnboarding) {
        setOnboardingStage("complete");
        startNewSession();
      } else {
        // Start with greeting
        playGreetingAudio();
      }
    }
  }, [token, navigate]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const connectAnalyser = () => {
      if (audioAnalyserRef.current.analyser) return;
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === "suspended") ctx.resume();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.85;
        const source = ctx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(ctx.destination);
        audioAnalyserRef.current = {
          analyser,
          dataArray: new Uint8Array(analyser.frequencyBinCount),
        };
      } catch (e) {
        console.warn("Audio analyser setup failed:", e);
      }
    };

    audio.addEventListener("play", connectAnalyser);
    return () => audio.removeEventListener("play", connectAnalyser);
  }, []);

  const startNewSession = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setMessages([]);
      setLiveTranscript("");
      setConversationEnded(false);
      setConversationOutcome(null);
      setScoreData(null);
      setShowScoreModal(false);
      setIsEvaluating(false);
      setShowHint(false);
      setHintDismissed(false);
      userHasSpokenRef.current = false;
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      if (hintAutoCloseRef.current) clearTimeout(hintAutoCloseRef.current);

      const response = await fetch(`${API_BASE_URL}/session/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eye_contact_enabled: eyeContactEnabled }),
      });

      if (!response.ok) throw new Error("Failed to start session");

      const data = await response.json();
      setSessionId(data.session_id);
      setSessionStartTime(Date.now());
      setElapsedTime(0);

      // Add opening message from customer
      setMessages([
        {
          role: "assistant",
          content: data.opening_message,
          timestamp: new Date(),
        },
      ]);

      // Play opening audio
      playTextAsAudio(data.opening_message, data.session_id);
    } catch (err) {
      setError("Failed to start training session: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const playTextAsAudio = async (text, sid) => {
    try {
      const sessionIdToUse = sid || sessionId;
      if (!sessionIdToUse) return;

      setIsPlaying(true);

      const response = await fetch(
        `${API_BASE_URL}/session/${sessionIdToUse}/tts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        },
      );

      if (!response.ok) throw new Error("Failed to generate audio");

      const data = await response.json();
      const audioBlob = base64ToBlob(
        data.audio,
        data.mime_type || "audio/mpeg",
      );
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.onended = () => setIsPlaying(false);
        await audioRef.current.play();
      }
    } catch (err) {
      console.error("TTS error:", err);
      setIsPlaying(false);
    }
  };

  const base64ToBlob = (base64, mimeType) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  // ── Onboarding ──────────────────────────────────────────────────

  const playGreetingAudio = async () => {
    try {
      const greetingText =
        "Thanks for using TurtleSales AI sales learning agent";

      // Create TTS audio with male voice (echo)
      const response = await fetch(`${API_BASE_URL}/greeting/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: greetingText, voice: "echo" }),
      });

      if (response.ok) {
        const data = await response.json();
        const audioBlob = base64ToBlob(
          data.audio,
          data.mime_type || "audio/mpeg",
        );
        const audioUrl = URL.createObjectURL(audioBlob);

        if (greetingAudioRef.current) {
          greetingAudioRef.current.src = audioUrl;
          greetingAudioRef.current.onended = () => {
            setOnboardingStage("chooseTour");
          };
          await greetingAudioRef.current.play();
        }
      } else {
        // If TTS fails, just show the choice screen
        setOnboardingStage("chooseTour");
      }
    } catch (err) {
      console.error("Greeting TTS error:", err);
      setOnboardingStage("chooseTour");
    }
  };

  const handleTourChoice = (takeTour) => {
    if (takeTour) {
      setTourStep(0);
      setOnboardingStage("tour");
    } else {
      startCountdown();
    }
  };

  const handleTourNext = () => {
    if (tourStep < 2) {
      setTourStep(tourStep + 1);
    } else {
      setOnboardingStage("countdown");
      startCountdown();
    }
  };

  const handleTourBack = () => {
    if (tourStep > 0) {
      setTourStep(tourStep - 1);
    }
  };

  const handleSkipTour = () => {
    setOnboardingStage("countdown");
    startCountdown();
  };

  const startCountdown = () => {
    setCountdownNumber(3);
    setOnboardingStage("countdown");

    const countdownInterval = setInterval(() => {
      setCountdownNumber((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setTimeout(() => {
            setOnboardingStage("complete");
            localStorage.setItem("turtlesales_onboarding_complete", "true");
            startNewSession();
          }, 1000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startTourFromButton = () => {
    setTourStep(0);
    setOnboardingStage("tour");
  };

  // ── Recording ───────────────────────────────────────────────────

  const startRecording = async () => {
    try {
      setLiveTranscript("");

      // Request higher quality audio for better transcription
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
      });

      // Try different formats in order of preference for OpenAI Whisper
      let mimeType = "";
      const preferredTypes = [
        "audio/mp4",
        "audio/mpeg",
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ];

      for (const type of preferredTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          console.log("Using MIME type:", type);
          break;
        }
      }

      if (!mimeType) throw new Error("No supported audio format found");

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000,
      });

      audioChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log("Audio chunk received:", event.data.size, "bytes");
        }
      };

      mediaRecorder.onstop = async () => {
        const recordingDuration = Date.now() - recordingStartTimeRef.current;
        console.log("Recording stopped. Duration:", recordingDuration, "ms");
        console.log("Total chunks:", audioChunksRef.current.length);

        // Stop visualizer
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }

        if (recordingDuration < 300) {
          console.log("Recording too short, ignoring");
          setError("Recording too short. Hold the button longer.");
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        if (audioChunksRef.current.length === 0) {
          console.log("No audio data recorded");
          setError("No audio recorded. Please try again.");
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeType,
        });
        console.log(
          "Audio blob created:",
          audioBlob.size,
          "bytes, type:",
          audioBlob.type,
        );
        await transcribeAndSend(audioBlob, mimeType);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      // Start recording - don't pass timeslice to get one complete valid audio file
      mediaRecorder.start();
      setIsRecording(true);
      console.log("Recording started with mimeType:", mimeType);

      // Setup audio visualizer AFTER MediaRecorder is started
      try {
        const audioContext = new (
          window.AudioContext || window.webkitAudioContext
        )();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
      } catch (vizError) {
        console.log("Visualizer setup failed (non-critical):", vizError);
      }
    } catch (err) {
      setError(
        "Microphone access denied. Please allow microphone permissions.",
      );
      console.error("Recording error:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log("✋ Stopping recording...");
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Push-to-talk event handlers - using pointer events for reliable cross-device support
  const handlePressStart = (e) => {
    e.preventDefault();
    if (
      isProcessing ||
      isLoading ||
      !sessionId ||
      isPlaying ||
      conversationEnded
    )
      return;

    console.log("🎤 Starting recording...");
    startRecording();
  };

  const handlePressEnd = (e) => {
    console.log(
      "🟢 Press END event:",
      e.type,
      "pointerType:",
      e.pointerType,
      "isRecording:",
      isRecording,
    );

    e.preventDefault();
    if (isRecording) stopRecording();
  };

  const handleContextMenu = (e) => {
    // Prevent right-click menu on Windows 11 touchscreens
    console.log("🚫 Context menu prevented");
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  const transcribeAndSend = async (audioBlob, mimeType) => {
    try {
      setIsProcessing(true);
      console.log(
        "Starting transcription for blob:",
        audioBlob.size,
        "bytes, type:",
        mimeType,
      );

      const formData = new FormData();
      // Determine file extension based on MIME type
      let extension = "webm";
      if (mimeType.includes("mp4")) extension = "mp4";
      else if (mimeType.includes("mpeg")) extension = "mp3";
      else if (mimeType.includes("ogg")) extension = "ogg";

      formData.append("audio", audioBlob, `recording.${extension}`);

      const transcribeResponse = await fetch(
        `${API_BASE_URL}/session/${sessionId}/transcribe`,
        { method: "POST", body: formData },
      );

      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json();
        console.error("Transcription error:", errorData);
        throw new Error(errorData.error || "Failed to transcribe audio");
      }

      const transcribeData = await transcribeResponse.json();
      const transcript = transcribeData.transcript;
      console.log("Transcription result:", transcript);

      // Show transcript immediately
      setLiveTranscript(transcript);

      if (transcript && transcript.trim()) {
        await sendMessage(transcript);
      } else {
        setError(
          "Could not understand audio. Please try speaking louder and clearer.",
        );
      }
    } catch (err) {
      console.error("Transcription error:", err);
      setLiveTranscript("");
      setError("Failed to process audio: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Messaging ───────────────────────────────────────────────────

  const sendMessage = async (message) => {
    if (!message.trim() || !sessionId) return;

    userHasSpokenRef.current = true;
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    if (showHint) {
      setShowHint(false);
      setHintDismissed(true);
      if (hintAutoCloseRef.current) clearTimeout(hintAutoCloseRef.current);
    }

    const userMessage = {
      role: "user",
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputText("");

    try {
      setIsProcessing(true);

      const response = await fetch(
        `${API_BASE_URL}/session/${sessionId}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        },
      );

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();

      // Add assistant message to UI
      const assistantMessage = {
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Play audio response
      playTextAsAudio(data.response);

      if (data.conversation_ended) {
        setConversationEnded(true);
        setConversationOutcome(data.outcome);
        evaluateSession();
      }
    } catch (err) {
      setError("Failed to send message: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const evaluateSession = async () => {
    try {
      setIsEvaluating(true);
      const response = await fetch(
        `${API_BASE_URL}/session/${sessionId}/evaluate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (response.ok) {
        const data = await response.json();
        setScoreData(data);
      }
    } catch (err) {
      console.error("Evaluation error:", err);
    } finally {
      setIsEvaluating(false);
      setTimeout(() => setShowScoreModal(true), 1500);
    }
  };

  // ── Eye Contact ─────────────────────────────────────────────────

  const [showCameraPreview, setShowCameraPreview] = useState(false);
  const sessionIdRef = useRef(null);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const initFaceLandmarker = async () => {
    const { FaceLandmarker, FilesetResolver } =
      await import("@mediapipe/tasks-vision");
    const resolver = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
    );
    return FaceLandmarker.createFromOptions(resolver, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU",
      },
      outputFaceBlendshapes: true,
      runningMode: "VIDEO",
      numFaces: 1,
    });
  };

  const startEyeContactTracking = async () => {
    try {
      if (eyeRafRef.current) {
        cancelAnimationFrame(eyeRafRef.current);
        eyeRafRef.current = null;
      }
      setEyeContactStatus({ face_detected: false, looking: false });
      setEyeContactLevel("good");
      eyeLevelRef.current = "good";
      lastGlanceTimeRef.current = Date.now();
      gazeHistoryRef.current = [];
      setShowCameraPreview(true);
      await new Promise((r) => setTimeout(r, 80));

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
      });
      cameraStreamRef.current = stream;

      if (!videoRef.current) {
        await new Promise((r) => setTimeout(r, 120));
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      } else {
        throw new Error("Camera preview failed to initialize.");
      }

      if (!faceLandmarkerRef.current) {
        faceLandmarkerRef.current = await initFaceLandmarker();
      }

      // ── Core Frame-Processing Loop ──────────────────────────
      const processFrame = () => {
        if (
          !videoRef.current ||
          !faceLandmarkerRef.current ||
          !cameraStreamRef.current
        )
          return;

        const video = videoRef.current;
        if (video.readyState < 2) {
          eyeRafRef.current = requestAnimationFrame(processFrame);
          return;
        }

        const now = performance.now();
        if (now - lastFrameTimeRef.current < DETECTION_THROTTLE_MS) {
          eyeRafRef.current = requestAnimationFrame(processFrame);
          return;
        }
        lastFrameTimeRef.current = now;

        let results;
        try {
          results = faceLandmarkerRef.current.detectForVideo(video, now);
        } catch {
          eyeRafRef.current = requestAnimationFrame(processFrame);
          return;
        }

        const lm = results.faceLandmarks?.[0] || null;
        const bs = results.faceBlendshapes?.[0]?.categories || null;
        const faceDetected = !!lm;
        const rawLooking = faceDetected && checkEyeContact(lm, bs);

        // 5-frame majority-vote smoothing (eliminates single-frame noise)
        const history = gazeHistoryRef.current;
        history.push(rawLooking);
        if (history.length > GAZE_HISTORY_SIZE) history.shift();
        const votes = history.filter(Boolean).length;
        const isLooking = votes >= Math.ceil(GAZE_HISTORY_SIZE / 2);

        // ── 4.5-Second Glance Timer State Machine ──
        const nowMs = Date.now();

        if (isLooking) {
          lastGlanceTimeRef.current = nowMs;
          if (eyeLevelRef.current !== "good") {
            eyeLevelRef.current = "good";
            setEyeContactLevel("good");
          }
        } else {
          const timeAway = nowMs - lastGlanceTimeRef.current;
          if (timeAway > GLANCE_TIMEOUT_MS) {
            if (eyeLevelRef.current !== "warning") {
              eyeLevelRef.current = "warning";
              setEyeContactLevel("warning");
            }
          } else if (eyeLevelRef.current === "good") {
            eyeLevelRef.current = "away";
            setEyeContactLevel("away");
          }
        }

        // Only push React state when face/looking status actually changes
        const prev = prevStatusRef.current;
        if (prev.faceDetected !== faceDetected || prev.looking !== isLooking) {
          prevStatusRef.current = { faceDetected, looking: isLooking };
          setEyeContactStatus({
            face_detected: faceDetected,
            looking: isLooking,
          });
        }

        // Throttled server report (once per second)
        const sid = sessionIdRef.current;
        if (sid && nowMs - serverReportTimeRef.current > 1000) {
          serverReportTimeRef.current = nowMs;
          fetch(`${API_BASE_URL}/session/${sid}/eye-contact`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ looking: isLooking }),
          }).catch(() => {});
        }

        eyeRafRef.current = requestAnimationFrame(processFrame);
      };

      eyeRafRef.current = requestAnimationFrame(processFrame);
    } catch (err) {
      console.error("Eye tracking init error:", err);
      setError(
        "Camera or model failed to load. Eye contact tracking unavailable.",
      );
      setEyeContactEnabled(false);
    }
  };

  const stopEyeContactTracking = () => {
    if (eyeRafRef.current) {
      cancelAnimationFrame(eyeRafRef.current);
      eyeRafRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    if (faceLandmarkerRef.current) {
      faceLandmarkerRef.current.close();
      faceLandmarkerRef.current = null;
    }
    setEyeContactStatus(null);
    setEyeContactLevel("good");
    eyeLevelRef.current = "good";
    lastGlanceTimeRef.current = Date.now();
    gazeHistoryRef.current = [];
    setShowCameraPreview(false);
  };

  const handleEyeContactToggle = async (enabled) => {
    setEyeContactEnabled(enabled);
    setShowSettings(false);

    if (enabled) {
      await startEyeContactTracking();
    } else {
      stopEyeContactTracking();
    }

    if (sessionId) {
      handleReset(enabled);
    }
  };

  useEffect(() => {
    return () => {
      stopEyeContactTracking();
    };
  }, []);

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (inputText.trim() && !isProcessing) {
      sendMessage(inputText);
    }
  };

  const handleReset = async (eyeContactOverride) => {
    if (
      eyeContactOverride === undefined &&
      !showScoreModal &&
      !conversationEnded
    ) {
      if (
        !window.confirm("Start a new conversation with a different customer?")
      ) {
        return;
      }
    }
    setShowScoreModal(false);
    hasInitialized.current = false;
    await startNewSession();
    hasInitialized.current = true;
  };

  // ── Audio Visualizer ────────────────────────────────────────────

  const AudioVisualizer = () => {
    const canvasRef = useRef(null);
    const particlesRef = useRef([]);

    useEffect(() => {
      if (!isRecording || !analyserRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Initialize particles
      const numParticles = 40;
      if (particlesRef.current.length === 0) {
        for (let i = 0; i < numParticles; i++) {
          const angle = (Math.PI * 2 * i) / numParticles;
          particlesRef.current.push({
            angle: angle,
            baseRadius: 30 + Math.random() * 15,
            offset: Math.random() * Math.PI * 2,
            speed: 0.008 + Math.random() * 0.012,
            size: 2.5 + Math.random() * 2.5,
          });
        }
      }

      const draw = () => {
        if (!analyserRef.current) return;

        animationFrameRef.current = requestAnimationFrame(draw);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalizedVolume = average / 255;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw particles
        particlesRef.current.forEach((particle, index) => {
          // Update particle angle
          particle.angle += particle.speed;

          // Calculate distance from center based on volume (more sensitive)
          const distance = particle.baseRadius + normalizedVolume * 40;

          // Calculate position
          const x =
            centerX + Math.cos(particle.angle + particle.offset) * distance;
          const y =
            centerY + Math.sin(particle.angle + particle.offset) * distance;

          // Get frequency data for this particle
          const freqIndex = Math.floor((index / numParticles) * bufferLength);
          const freqValue = dataArray[freqIndex] / 255;

          // Particle opacity based on volume (brighter)
          const opacity = 0.6 + freqValue * 0.4;

          // Draw particle
          ctx.fillStyle = `rgba(67, 160, 71, ${opacity})`;
          ctx.beginPath();
          ctx.arc(x, y, particle.size + freqValue * 3, 0, Math.PI * 2);
          ctx.fill();

          // Draw connecting lines to nearby particles
          if (index < numParticles - 1) {
            const nextParticle = particlesRef.current[index + 1];
            const nextDistance =
              nextParticle.baseRadius + normalizedVolume * 40;
            const nextX =
              centerX +
              Math.cos(nextParticle.angle + nextParticle.offset) * nextDistance;
            const nextY =
              centerY +
              Math.sin(nextParticle.angle + nextParticle.offset) * nextDistance;

            ctx.strokeStyle = `rgba(67, 160, 71, ${opacity * 0.4})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(nextX, nextY);
            ctx.stroke();
          }
        });

        // Connect last particle to first
        const firstParticle = particlesRef.current[0];
        const lastParticle = particlesRef.current[numParticles - 1];
        const firstDistance = firstParticle.baseRadius + normalizedVolume * 40;
        const lastDistance = lastParticle.baseRadius + normalizedVolume * 40;
        const firstX =
          centerX +
          Math.cos(firstParticle.angle + firstParticle.offset) * firstDistance;
        const firstY =
          centerY +
          Math.sin(firstParticle.angle + firstParticle.offset) * firstDistance;
        const lastX =
          centerX +
          Math.cos(lastParticle.angle + lastParticle.offset) * lastDistance;
        const lastY =
          centerY +
          Math.sin(lastParticle.angle + lastParticle.offset) * lastDistance;

        ctx.strokeStyle = `rgba(67, 160, 71, ${(0.6 + normalizedVolume * 0.4) * 0.4})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(firstX, firstY);
        ctx.stroke();
      };

      draw();

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }, [isRecording]);

    return (
      <canvas
        ref={canvasRef}
        width={160}
        height={160}
        className="audio-visualizer-canvas"
      />
    );
  };

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="ai-conversation-container">
      {/* Onboarding Overlays */}
      <AnimatePresence>
        {/* Greeting Screen */}
        {onboardingStage === "greeting" && (
          <motion.div
            className="onboarding-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="onboarding-content">
              <div className="onboarding-logo">
                <FiVolume2 size={60} />
              </div>
              <h1 className="onboarding-title">Welcome to TurtleSales AI</h1>
              <p className="onboarding-text">
                Thanks for using TurtleSales AI sales learning agent
              </p>
              <div className="onboarding-spinner">
                <div className="spinner"></div>
                <p>Loading...</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Choice Screen */}
        {onboardingStage === "chooseTour" && (
          <motion.div
            className="onboarding-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="onboarding-content">
              <div className="onboarding-logo">
                <FiVolume2 size={60} />
              </div>
              <h1 className="onboarding-title">
                Thanks for using TurtleSales AI sales learning agent
              </h1>
              <p className="onboarding-text">
                Practice realistic door-to-door sales scenarios with AI-powered
                customers.
              </p>
              <div className="onboarding-buttons">
                <button
                  className="onboarding-btn secondary how-it-works-btn"
                  onClick={() => handleTourChoice(true)}
                >
                  How it Works
                </button>
                <button
                  className="onboarding-btn primary"
                  onClick={() => handleTourChoice(false)}
                >
                  Start Training
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Countdown Screen */}
        {onboardingStage === "countdown" && (
          <motion.div
            className="onboarding-overlay countdown"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="countdown-number"
              key={countdownNumber}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              {countdownNumber > 0 ? countdownNumber : "GO!"}
            </motion.div>
          </motion.div>
        )}

        {/* Tour Tooltips */}
        {onboardingStage === "tour" && (
          <motion.div
            className="tour-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="tour-backdrop" onClick={handleSkipTour} />

            {tourStep === 0 && (
              <motion.div
                className="tour-tooltip chat-area-tooltip"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <button className="tour-close" onClick={handleSkipTour}>
                  ×
                </button>
                <div className="tour-content">
                  <h3>Chat Area</h3>
                  <p>
                    This is where your conversation with the AI customer
                    appears. You'll see their responses and your messages in
                    real-time.
                  </p>
                </div>
                <div className="tour-footer">
                  <span className="tour-progress">1 of 3</span>
                  <div className="tour-nav">
                    <button className="tour-btn" onClick={handleSkipTour}>
                      Skip Tour
                    </button>
                    <button
                      className="tour-btn primary"
                      onClick={handleTourNext}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {tourStep === 1 && (
              <motion.div
                className="tour-tooltip push-to-talk-tooltip"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <button className="tour-close" onClick={handleSkipTour}>
                  ×
                </button>
                <div className="tour-content">
                  <h3>Push to Talk</h3>
                  <p>
                    Hold this button to record your sales pitch using your
                    voice. Release to send. This creates realistic training
                    scenarios.
                  </p>
                </div>
                <div className="tour-footer">
                  <span className="tour-progress">2 of 3</span>
                  <div className="tour-nav">
                    <button className="tour-btn" onClick={handleTourBack}>
                      ← Back
                    </button>
                    <button
                      className="tour-btn primary"
                      onClick={handleTourNext}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {tourStep === 2 && (
              <motion.div
                className="tour-tooltip purpose-tooltip"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <button className="tour-close" onClick={handleSkipTour}>
                  ×
                </button>
                <div className="tour-content">
                  <h3>Realistic Training</h3>
                  <p>
                    Each session features unique AI personas with specific
                    objections and personalities. Practice handling real-world
                    door-to-door sales scenarios to improve your skills.
                  </p>
                </div>
                <div className="tour-footer">
                  <span className="tour-progress">3 of 3</span>
                  <div className="tour-nav">
                    <button className="tour-btn" onClick={handleTourBack}>
                      ← Back
                    </button>
                    <button
                      className="tour-btn primary"
                      onClick={handleTourNext}
                    >
                      Start Training →
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="conversation-header">
        <button
          className="back-button"
          onClick={() => navigate("/ai-sales-training")}
        >
          <FiArrowLeft />
          <span>Back</span>
        </button>
        <div className="header-center">
          <div className="session-meta">
            {eyeContactEnabled && sessionId && (
              <span
                className={`eye-contact-indicator ${
                  eyeContactLevel === "good"
                    ? "looking"
                    : eyeContactLevel === "away"
                      ? "away"
                      : "not-looking"
                }`}
              >
                <span className="eye-contact-dot"></span>
                <FiEye size={10} />
                <span className="eye-contact-label">
                  {eyeContactLevel === "good"
                    ? "Good eye contact"
                    : eyeContactLevel === "away"
                      ? "Look at screen"
                      : "No eye contact!"}
                </span>
                {eyeContactLevel === "away" && (
                  <span className="eye-contact-timer-bar">
                    <span className="eye-contact-timer-fill" />
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
        <div className="header-right-actions">
          <button
            className="reset-button"
            onClick={() => handleReset()}
            disabled={isLoading || isEvaluating}
          >
            <FiRefreshCw />
            <span>New Door</span>
          </button>
          <button
            className="settings-button"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <FiSettings />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="error-banner"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <FiAlertCircle />
            <span>{error}</span>
            <button onClick={() => setError(null)}>×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="split-container">
        {/* 3D Holographic Head Panel */}
        <HolographicHead
          isPlaying={isPlaying}
          isProcessing={isProcessing}
          isRecording={isRecording}
          isLoading={isLoading}
          conversationEnded={conversationEnded}
          audioAnalyserRef={audioAnalyserRef}
          messages={messages}
          liveTranscript={liveTranscript}
        />
        <div ref={messagesEndRef} style={{ display: "none" }} />

        {/* Recording Panel */}
        <div className="recording-panel">
          <div className="recording-inner">
            <div className="panel-header">
              <div className="panel-title-group">
                <FiMic className="panel-icon" />
                <h3>Voice Controls</h3>
              </div>
              <div className="panel-header-actions">
                {sessionId && (
                  <span className="panel-timer-badge">
                    <FiClock size={11} />
                    {formatTime(elapsedTime)}
                  </span>
                )}
                <button
                  className="help-button"
                  onClick={startTourFromButton}
                  title="How it Works"
                >
                  <FiHelpCircle />
                </button>
              </div>
            </div>

            <div className="status-area">
              {isRecording && (
                <motion.div
                  className="status-pill recording"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <div className="recording-pulse"></div>
                  <span>Recording...</span>
                </motion.div>
              )}
              {isProcessing && (
                <motion.div
                  className="status-pill processing"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <div className="spinner-small"></div>
                  <span>Processing...</span>
                </motion.div>
              )}
              {isPlaying && (
                <motion.div
                  className="status-pill playing"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <FiVolume2 size={14} />
                  <span>Customer speaking...</span>
                </motion.div>
              )}
              {conversationEnded && (
                <motion.div
                  className="status-pill ended"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <FiAward size={14} />
                  <span>Session Complete</span>
                </motion.div>
              )}
              {!isRecording &&
                !isProcessing &&
                !isPlaying &&
                !conversationEnded &&
                sessionId && (
                  <div className="status-pill ready">
                    <span>Ready — hold mic to speak</span>
                  </div>
                )}
            </div>

            <div className="mic-area">
              <div className="mic-btn-wrapper">
                <div className="visualizer-slot">
                  <AnimatePresence>
                    {isRecording && (
                      <motion.div
                        className="visualizer-wrapper"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                      >
                        <AudioVisualizer />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button
                  className={`mic-btn ${isRecording ? "active" : ""} ${isPlaying || conversationEnded ? "disabled-state" : ""}`}
                  onPointerDown={handlePressStart}
                  onPointerUp={handlePressEnd}
                  onPointerLeave={handlePressEnd}
                  onPointerCancel={handlePressEnd}
                  onContextMenu={handleContextMenu}
                  disabled={
                    isProcessing ||
                    isLoading ||
                    !sessionId ||
                    isPlaying ||
                    conversationEnded
                  }
                  title="Hold to record your voice"
                  style={{
                    touchAction: "none",
                    userSelect: "none",
                    WebkitTouchCallout: "none",
                  }}
                >
                  <div className="mic-btn-icon">
                    {isRecording ? <FiMic /> : <FiMicOff />}
                  </div>
                </button>
              </div>
              <p className="mic-label">
                {conversationEnded
                  ? "Session Ended"
                  : isRecording
                    ? "Release to Send"
                    : "Hold to Speak"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Hint Popup */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            className="hint-popup"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
          >
            <button className="hint-close" onClick={dismissHint}>
              <FiX size={16} />
            </button>
            <div className="hint-header">
              <div className="hint-icon-wrap">
                <FiZap size={18} />
              </div>
              <h4>Feeling stuck? Need a hook? Try this:</h4>
            </div>
            <p className="hint-script">
              "I'm with TurtleSales, and we're the ones providing [Product Name]
              to your neighbors this week. Do you currently have a system in
              place for that, or are you looking to get something set up?"
            </p>
            <div className="hint-timer-bar">
              <motion.div
                className="hint-timer-fill"
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 10, ease: "linear" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Score Modal */}
      <AnimatePresence>
        {showScoreModal && (
          <motion.div
            className="score-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="score-card"
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <div className="score-header">
                <div className="score-icon-wrap">
                  <FiAward size={28} />
                </div>
                <h2>Session Complete</h2>
                <div
                  className="outcome-badge"
                  style={{
                    background: getOutcomeColor(conversationOutcome) + "12",
                    color: getOutcomeColor(conversationOutcome),
                    borderColor: getOutcomeColor(conversationOutcome) + "30",
                  }}
                >
                  {getOutcomeLabel(conversationOutcome)}
                </div>
              </div>

              <div className="score-stats">
                <div className="stat-item">
                  <FiClock size={16} />
                  <div className="stat-data">
                    <span className="stat-val">{formatTime(elapsedTime)}</span>
                    <span className="stat-lbl">Duration</span>
                  </div>
                </div>
                <div className="stat-item">
                  <FiMessageSquare size={16} />
                  <div className="stat-data">
                    <span className="stat-val">
                      {messages.filter((m) => m.role === "user").length}
                    </span>
                    <span className="stat-lbl">Your Turns</span>
                  </div>
                </div>
                <div className="stat-item highlight">
                  <FiAward size={16} />
                  <div className="stat-data">
                    <span className="stat-val">
                      {scoreData ? `${scoreData.overall_score}/10` : "..."}
                    </span>
                    <span className="stat-lbl">Overall Score</span>
                  </div>
                </div>
              </div>

              {isEvaluating ? (
                <div className="evaluating-state">
                  <div className="spinner"></div>
                  <p>Analyzing your performance...</p>
                </div>
              ) : scoreData ? (
                <div className="score-details">
                  <div className="score-categories">
                    {scoreData.categories &&
                      Object.entries(scoreData.categories).map(([key, cat]) => (
                        <div className="category-row" key={key}>
                          <div className="category-top">
                            <span className="category-name">
                              {key
                                .replace(/_/g, " ")
                                .replace(/\b\w/g, (l) => l.toUpperCase())}
                            </span>
                            <span className="category-score">
                              {cat.score}/10
                            </span>
                          </div>
                          <div className="category-bar">
                            <motion.div
                              className="category-bar-fill"
                              initial={{ width: 0 }}
                              animate={{
                                width: `${cat.score * 10}%`,
                              }}
                              transition={{
                                duration: 0.8,
                                delay: 0.2,
                              }}
                            />
                          </div>
                          <p className="category-note">{cat.feedback}</p>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="no-score">
                  <p>Score evaluation unavailable for this session.</p>
                </div>
              )}

              <div className="score-actions">
                <button
                  className="action-btn secondary"
                  onClick={() => navigate("/ai-sales-training")}
                >
                  Back to Training
                </button>
                <button className="action-btn primary" onClick={handleReset}>
                  <FiRefreshCw size={16} />
                  New Conversation
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="settings-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              className="settings-panel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="settings-header">
                <FiSettings size={18} />
                <h3>Settings</h3>
                <button
                  className="settings-close"
                  onClick={() => setShowSettings(false)}
                >
                  <FiX size={16} />
                </button>
              </div>
              <div className="settings-body">
                <div className="settings-item">
                  <div className="settings-item-info">
                    <div className="settings-item-label">
                      <FiEye size={16} />
                      <span>Eye Contact Tracking</span>
                    </div>
                    <p className="settings-item-desc">
                      Uses your camera to track eye contact. Makes the AI
                      customer a bit harder to close. Your face must be visible
                      on camera.
                    </p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={eyeContactEnabled}
                      onChange={(e) => handleEyeContactToggle(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera preview for eye contact */}
      {showCameraPreview && eyeContactEnabled && (
        <div className="camera-preview-window">
          <div className="camera-preview-header">
            <FiEye size={12} />
            <span>Camera</span>
          </div>
          <video
            ref={videoRef}
            className="camera-preview-video"
            playsInline
            muted
            autoPlay
          />
          <div
            className={`camera-preview-border ${
              eyeContactStatus?.face_detected
                ? eyeContactStatus.looking
                  ? "looking"
                  : "not-looking"
                : "no-face"
            }`}
          />
        </div>
      )}
      <audio ref={audioRef} style={{ display: "none" }} />
      <audio ref={greetingAudioRef} style={{ display: "none" }} />
    </div>
  );
};

export default AIConversation;
