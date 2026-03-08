import React, { useState, useEffect, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../usercontext/UserContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiMic,
  FiMicOff,
  FiSend,
  FiRefreshCw,
  FiArrowLeft,
  FiVolume2,
  FiUser,
  FiMessageSquare,
  FiAlertCircle,
  FiHelpCircle,
} from "react-icons/fi";
import "../styles/AIConversation.css";

const API_BASE_URL = "http://localhost:5001/api";

const AIConversation = () => {
  const { token } = useContext(UserContext);
  const navigate = useNavigate();

  // Session state
  const [sessionId, setSessionId] = useState(null);
  const [personaName, setPersonaName] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Input state
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");

  // Onboarding state
  const [onboardingStage, setOnboardingStage] = useState("greeting"); // 'greeting' | 'chooseTour' | 'tour' | 'countdown' | 'complete'
  const [tourStep, setTourStep] = useState(0);
  const [countdownNumber, setCountdownNumber] = useState(3);

  // Refs
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

  useEffect(() => {
    // Force scroll to top immediately
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    if (!token) {
      navigate("/login");
      return;
    }
    // Only start onboarding once on mount
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
      block: "nearest", // Only scroll within container, not entire page
      inline: "nearest",
    });
  };

  const startNewSession = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setMessages([]);
      setLiveTranscript(""); // Clear live transcription

      const response = await fetch(`${API_BASE_URL}/session/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error("Failed to start session");
      }

      const data = await response.json();
      setSessionId(data.session_id);
      setPersonaName(data.persona_name);

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
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to generate audio");
      }

      const data = await response.json();
      const audioBlob = base64ToBlob(data.audio, "audio/mpeg");
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

  // Onboarding Functions
  const playGreetingAudio = async () => {
    try {
      const greetingText =
        "Thanks for using TurtleSales AI sales learning agent";

      // Create TTS audio with male voice (echo)
      const response = await fetch(`${API_BASE_URL}/greeting/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: greetingText,
          voice: "echo", // Male voice
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const audioBlob = base64ToBlob(data.audio, "audio/mpeg");
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

  const startRecording = async () => {
    try {
      setLiveTranscript(""); // Reset live transcript

      // Request higher quality audio for better transcription
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000, // Higher sample rate for better quality
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

      if (!mimeType) {
        throw new Error("No supported audio format found");
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000, // Higher bitrate for better quality
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
    console.log("🔴 Press START event:", e.type, "pointerType:", e.pointerType);
    
    e.preventDefault(); // Prevent default to avoid scrolling/right-click
    
    if (isProcessing || isLoading || !sessionId) {
      console.log("❌ Cannot start - isProcessing:", isProcessing, "isLoading:", isLoading, "sessionId:", sessionId);
      return;
    }
    
    console.log("🎤 Starting recording...");
    startRecording();
  };

  const handlePressEnd = (e) => {
    console.log("🟢 Press END event:", e.type, "pointerType:", e.pointerType, "isRecording:", isRecording);
    
    e.preventDefault();
    
    if (isRecording) {
      console.log("✅ Stopping recording via", e.type);
      stopRecording();
    } else {
      console.log("⚠️ Not recording, ignoring", e.type);
    }
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
      if (mimeType.includes("mp4")) {
        extension = "mp4";
      } else if (mimeType.includes("mpeg")) {
        extension = "mp3";
      } else if (mimeType.includes("ogg")) {
        extension = "ogg";
      } else if (mimeType.includes("webm")) {
        extension = "webm";
      }

      console.log("Using file extension:", extension);
      formData.append("audio", audioBlob, `recording.${extension}`);

      const transcribeResponse = await fetch(
        `${API_BASE_URL}/session/${sessionId}/transcribe`,
        {
          method: "POST",
          body: formData,
        },
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
      console.error("Full transcription error:", err);
      // Clear the live transcript on error
      setLiveTranscript("");
      setError("Failed to process audio: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const sendMessage = async (message) => {
    if (!message.trim() || !sessionId) return;

    // Add user message to UI
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
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

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
    } catch (err) {
      setError("Failed to send message: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (inputText.trim() && !isProcessing) {
      sendMessage(inputText);
    }
  };

  const handleReset = async () => {
    if (window.confirm("Start a new conversation with a different customer?")) {
      hasInitialized.current = false;
      await startNewSession();
      hasInitialized.current = true;
    }
  };

  // Audio Visualizer Component - Particles
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

        ctx.strokeStyle = `rgba(67, 160, 71, ${0.6 + normalizedVolume * 0.4 * 0.4})`;
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
        <div className="header-info">
          <h2>AI Sales Training</h2>
        </div>
        <button
          className="reset-button"
          onClick={handleReset}
          disabled={isLoading}
        >
          <FiRefreshCw />
          <span>New Door</span>
        </button>
      </div>

      {/* Error Banner */}
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

      {/* Split Screen Layout */}
      <div className="split-container">
        {/* Left Side: Chat Messages */}
        <div className="chat-panel">
          <div className="chat-header">
            <div className="header-left">
              <FiMessageSquare />
              <h3>Conversation</h3>
            </div>
          </div>
          <div className="messages-container">
            {isLoading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Starting new training session...</p>
              </div>
            ) : (
              <AnimatePresence>
                {messages.map((msg, index) => (
                  <motion.div
                    key={index}
                    className={`message ${msg.role}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="message-icon">
                      {msg.role === "user" ? <FiUser /> : <FiMessageSquare />}
                    </div>
                    <div className="message-content">
                      <div className="message-header">
                        <span className="message-role">
                          {msg.role === "user" ? "You" : "Customer"}
                        </span>
                        <span className="message-time">
                          {msg.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="message-text">{msg.content}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Right Side: Recording Panel */}
        <div className="recording-panel">
          <div className="recording-header">
            <div className="header-left">
              <FiMic />
              <h3>Push to Talk</h3>
            </div>
            <button
              className="help-button"
              onClick={startTourFromButton}
              title="How it Works"
            >
              <FiHelpCircle />
            </button>
          </div>

          <div className="recording-content">
            {/* Status Indicator */}
            <div className="status-section">
              {isRecording && (
                <motion.div
                  className="status-indicator recording"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="recording-pulse"></div>
                  <span>Recording...</span>
                </motion.div>
              )}
              {isProcessing && (
                <motion.div
                  className="status-indicator processing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="spinner-small"></div>
                  <span>Processing...</span>
                </motion.div>
              )}
              {isPlaying && (
                <motion.div
                  className="status-indicator playing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <FiVolume2 />
                  <span>Customer speaking...</span>
                </motion.div>
              )}
            </div>

            {/* Push to Talk Button */}
            <div className="mic-button-section">
              <button
                className={`mic-button-large ${isRecording ? "recording" : ""}`}
                onPointerDown={handlePressStart}
                onPointerUp={handlePressEnd}
                onPointerLeave={handlePressEnd}
                onPointerCancel={handlePressEnd}
                onContextMenu={handleContextMenu}
                disabled={isProcessing || isLoading || !sessionId}
                title="Hold to record your voice"
                style={{
                  touchAction: "none",
                  userSelect: "none",
                  WebkitTouchCallout: "none",
                }}
              >
                <div className="mic-icon">
                  {isRecording ? <FiMic /> : <FiMicOff />}
                </div>
              </button>
              <p className="mic-instruction">
                {isRecording ? "Release to Send" : "Hold to Speak"}
              </p>
            </div>

            {/* Audio Visualizer */}
            {isRecording && (
              <motion.div
                className="visualizer-section"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <AudioVisualizer />
              </motion.div>
            )}

            {/* Live Transcription */}
            <div className="transcript-section">
              {liveTranscript && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="transcript-text"
                >
                  "{liveTranscript}"
                </motion.p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden audio elements for playback */}
      <audio ref={audioRef} style={{ display: "none" }} />
      <audio ref={greetingAudioRef} style={{ display: "none" }} />
    </div>
  );
};

export default AIConversation;
