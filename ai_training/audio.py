"""
Audio I/O — push-to-talk microphone recording, OpenAI Whisper
transcription, and OpenAI TTS playback.
"""

from __future__ import annotations

import io
import tempfile
import sys
import threading

import numpy as np
import sounddevice as sd
import soundfile as sf
from openai import OpenAI

import config

# ── Defaults ──────────────────────────────────────────────────────────
SAMPLE_RATE = 16_000          # 16 kHz — Whisper's native rate
CHANNELS = 1
BLOCK_DURATION = 0.05         # 50 ms chunks
MAX_RECORD_SECONDS = 120      # hard cap (2 minutes)


# ── Recording ─────────────────────────────────────────────────────────

def record_speech(
    sample_rate: int = SAMPLE_RATE,
) -> bytes:
    """
    Push-to-talk recording: starts immediately and records until the user
    presses Enter. Returns raw WAV bytes ready for the Whisper API.
    """
    block_size = int(sample_rate * BLOCK_DURATION)
    frames: list[np.ndarray] = []
    max_blocks = int(MAX_RECORD_SECONDS / BLOCK_DURATION)
    stop_event = threading.Event()

    # Background thread waits for Enter key to signal stop
    def _wait_for_enter():
        try:
            input()
        except EOFError:
            pass
        stop_event.set()

    enter_thread = threading.Thread(target=_wait_for_enter, daemon=True)
    enter_thread.start()

    print("  Recording... press [ENTER] to stop", flush=True)

    try:
        with sd.InputStream(samplerate=sample_rate, channels=CHANNELS,
                            dtype="float32", blocksize=block_size) as stream:
            for _ in range(max_blocks):
                if stop_event.is_set():
                    break
                data, _ = stream.read(block_size)
                frames.append(data.copy())
    except sd.PortAudioError as e:
        print(f"\n  Microphone error: {e}")
        print("  Make sure a mic is connected and not in use by another app.")
        return b""

    if not frames:
        return b""

    audio_np = np.concatenate(frames, axis=0)
    # Convert to WAV bytes in memory
    buf = io.BytesIO()
    sf.write(buf, audio_np, sample_rate, format="WAV", subtype="PCM_16")
    buf.seek(0)
    return buf.read()


# ── Transcription (Whisper) ───────────────────────────────────────────

def transcribe(wav_bytes: bytes) -> str:
    """Send WAV audio to OpenAI Whisper and return the transcript."""
    if not wav_bytes:
        return ""

    client = OpenAI(api_key=config.OPENAI_API_KEY)

    # Whisper expects a file-like object with a name ending in .wav
    audio_file = io.BytesIO(wav_bytes)
    audio_file.name = "recording.wav"

    result = client.audio.transcriptions.create(
        model="whisper-1",
        file=audio_file,
        language="en",
    )
    return result.text.strip()


# ── Text-to-Speech (OpenAI TTS) ──────────────────────────────────────

def speak(text: str, voice: str = "onyx") -> None:
    """Convert text to speech via OpenAI TTS and play it through speakers."""
    if not text:
        return

    client = OpenAI(api_key=config.OPENAI_API_KEY)

    response = client.audio.speech.create(
        model=config.TTS_MODEL,
        voice=voice,
        input=text,
        response_format="mp3",
        speed=config.TTS_SPEED,
    )

    # Write to a temp file and play it
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp.write(response.content)
        tmp_path = tmp.name

    try:
        data, sr = sf.read(tmp_path, dtype="float32")
        sd.play(data, sr)
        sd.wait()  # block until playback finishes
    except Exception as e:
        print(f"  (audio playback error: {e} — transcript shown above)")
    finally:
        import os
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


# ── Convenience ───────────────────────────────────────────────────────

def listen_and_transcribe() -> str:
    """Record the user, transcribe, and return the text. Full pipeline."""
    wav = record_speech()
    if not wav:
        return ""
    text = transcribe(wav)
    return text
