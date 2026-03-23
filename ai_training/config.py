import os
from dotenv import load_dotenv

load_dotenv()

# ── OpenAI Configuration ──────────────────────────────────────────────
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5.1")
TEMPERATURE = float(os.getenv("TEMPERATURE", "0.85"))
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "300"))  # More room for coherent role-play turns

# ── Paths ─────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PERSONAS_FILE = os.path.join(BASE_DIR, "personas.json")

# ── TTS Configuration ─────────────────────────────────────────────────
TTS_MODEL = os.getenv("TTS_MODEL", "gpt-4o-mini-tts")  # GPT audio model for lower-latency speech
TTS_DEFAULT_VOICE = os.getenv("TTS_VOICE", "nova")  # Nova voice is warm and natural
TTS_SPEED = float(os.getenv("TTS_SPEED", "1.2"))  # Slightly faster default cadence (1.0 = normal, max 4.0)

# ── Defaults ──────────────────────────────────────────────────────────
# Persona is randomized at runtime, no defaults needed
