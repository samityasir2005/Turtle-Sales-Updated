import os
from dotenv import load_dotenv

load_dotenv()

# ── OpenAI Configuration ──────────────────────────────────────────────
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")  # Faster, cheaper than gpt-4o
TEMPERATURE = float(os.getenv("TEMPERATURE", "0.85"))
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "200"))  # Slightly longer responses

# ── Paths ─────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PERSONAS_FILE = os.path.join(BASE_DIR, "personas.json")

# ── TTS Configuration ─────────────────────────────────────────────────
TTS_MODEL = os.getenv("TTS_MODEL", "tts-1-hd")  # HD model for more natural sound
TTS_DEFAULT_VOICE = os.getenv("TTS_VOICE", "nova")  # Nova voice is warm and natural
TTS_SPEED = float(os.getenv("TTS_SPEED", "0.9"))  # Slower, more conversational pace (1.0 = normal, max 4.0)

# ── Defaults ──────────────────────────────────────────────────────────
# Persona is randomized at runtime, no defaults needed
