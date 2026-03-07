"""
CustomerAgent — manages the conversation state and communicates with the
OpenAI API to generate realistic customer responses.
"""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any

from openai import OpenAI

import config
from system_prompt import build_system_prompt, build_opening_message


class CustomerAgent:
    """Simulates a door-to-door sales customer powered by an LLM."""

    # Voice pools for randomization
    MALE_VOICES = ["onyx", "echo", "fable"]
    FEMALE_VOICES = ["nova", "shimmer"]
    NEUTRAL_VOICES = ["alloy"]

    def __init__(self, persona_id: str | None = None) -> None:
        self.client = OpenAI(api_key=config.OPENAI_API_KEY)
        self.data = self._load_personas()

        # Pick a random persona if none specified
        if persona_id is None:
            self.persona = random.choice(self.data["personas"])
        else:
            self.persona = self._find_by_id(self.data["personas"], persona_id)

        # Randomly select an appropriate voice for this session
        self._assign_random_voice()

        self.system_prompt = build_system_prompt(self.persona)
        self.messages: list[dict[str, str]] = [
            {"role": "system", "content": self.system_prompt}
        ]
        self.turn_count = 0

    # ── Data loading ──────────────────────────────────────────────────

    @staticmethod
    def _load_personas() -> dict[str, Any]:
        path = Path(config.PERSONAS_FILE)
        if not path.exists():
            raise FileNotFoundError(f"Personas file not found: {path}")
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    @staticmethod
    def _find_by_id(collection: list[dict], target_id: str) -> dict:
        for item in collection:
            if item["id"] == target_id:
                return item
        available = [item["id"] for item in collection]
        raise ValueError(
            f"ID '{target_id}' not found. Available: {available}"
        )

    def _assign_random_voice(self) -> None:
        """Randomly assign a voice from the appropriate pool based on persona characteristics."""
        # Check if persona has gender info in life_details or use name as fallback
        life_details = self.persona.get("life_details", {})
        persona_name = life_details.get("name", "")
        
        # Common male names
        male_names = {"Dave", "Mike", "Chris", "Brian", "Steve", "Jeff", "Tom", "Dan",
                     "Marcus", "James", "Andre", "Carlos", "Kevin", "Tony", "Jason", "Eric",
                     "Rick", "Gary", "Bob", "Frank", "Joe", "Wayne", "Larry",
                     "David", "Alex", "Ryan", "Jordan", "Ben", "Sam", "Matt"}
        
        # Common female names
        female_names = {"Priya", "Maya", "Anjali", "Sarah", "Jessica", "Emily", "Rachel", "Lauren",
                       "Linda", "Carol", "Barbara", "Susan", "Nancy", "Diane", "Kathy", "Sharon",
                       "Amy", "Jennifer", "Julie", "Lisa", "Michelle", "Kelly", "Stephanie"}
        
        # Determine gender and select random voice from appropriate pool
        if persona_name in male_names:
            selected_voice = random.choice(self.MALE_VOICES)
        elif persona_name in female_names:
            selected_voice = random.choice(self.FEMALE_VOICES)
        else:
            # Default to neutral or use the persona's specified voice
            default_voice = self.persona.get("tts_voice", config.TTS_DEFAULT_VOICE)
            if default_voice in self.MALE_VOICES:
                selected_voice = random.choice(self.MALE_VOICES)
            elif default_voice in self.FEMALE_VOICES:
                selected_voice = random.choice(self.FEMALE_VOICES)
            else:
                selected_voice = random.choice(self.NEUTRAL_VOICES)
        
        # Assign the selected voice to the persona for this session
        self.persona["tts_voice"] = selected_voice
        print(f"🎙️  Assigned voice: {selected_voice} for {self.persona['name']}")

    # ── Conversation ──────────────────────────────────────────────────

    def get_opening(self) -> str:
        """Generate the customer's first reaction when the door is knocked."""
        opening_instruction = build_opening_message(self.persona)
        self.messages.append({"role": "user", "content": opening_instruction})
        response = self._call_llm()
        self.messages.append({"role": "assistant", "content": response})
        self.turn_count += 1
        return response

    def respond(self, salesperson_message: str) -> str:
        """Generate the customer's response to a salesperson message."""
        self.messages.append({"role": "user", "content": salesperson_message})
        response = self._call_llm()
        self.messages.append({"role": "assistant", "content": response})
        self.turn_count += 1
        return response

    def _call_llm(self) -> str:
        """Send the conversation to the OpenAI API and return the reply."""
        # Add slight temperature variation for more natural unpredictability
        # Real humans aren't consistent - sometimes more/less verbose, more/less patient
        temp_variation = random.uniform(-0.1, 0.15)
        adjusted_temp = max(0.7, min(1.0, config.TEMPERATURE + temp_variation))
        
        completion = self.client.chat.completions.create(
            model=config.OPENAI_MODEL,
            messages=self.messages,
            temperature=adjusted_temp,
            max_tokens=config.MAX_TOKENS,
            # Add frequency penalty to avoid repetitive phrases
            frequency_penalty=0.3,
            # Add presence penalty to encourage topic diversity
            presence_penalty=0.2,
        )
        return completion.choices[0].message.content.strip()

    # ── Utilities ─────────────────────────────────────────────────────

    def get_conversation_log(self) -> list[dict[str, str]]:
        """Return the full conversation history (excluding the system prompt)."""
        return [m for m in self.messages if m["role"] != "system"]

    def reset(self) -> None:
        """Reset the conversation but keep the same persona/scenario."""
        self.messages = [{"role": "system", "content": self.system_prompt}]
        self.turn_count = 0

    @property
    def persona_name(self) -> str:
        return self.persona["name"]

    @property
    def tts_voice(self) -> str:
        """Return the randomly assigned TTS voice for this session."""
        return self.persona.get("tts_voice", config.TTS_DEFAULT_VOICE)

    # ── Class helpers ─────────────────────────────────────────────────

    @classmethod
    def list_personas(cls) -> list[dict[str, str]]:
        data = cls._load_personas()
        return [{"id": p["id"], "name": p["name"], "description": p["description"]}
                for p in data["personas"]]
