"""
CustomerAgent — manages the conversation state and communicates with the
OpenAI API to generate realistic customer responses.
"""

from __future__ import annotations

import random
import re

from openai import OpenAI

import config
from system_prompt import build_system_prompt, build_opening_message, generate_session_persona


class CustomerAgent:
    """Simulates a door-to-door sales customer powered by an LLM."""

    # Voice pools for randomization
    MALE_VOICES = ["onyx", "echo", "fable"]
    FEMALE_VOICES = ["nova", "shimmer"]
    NEUTRAL_VOICES = ["alloy"]

    def __init__(self, persona_id: str | None = None) -> None:
        self.client = OpenAI(api_key=config.OPENAI_API_KEY)

        # persona_id is intentionally ignored: personas are now generated dynamically by the prompt.
        _ = persona_id

        # Randomly select an appropriate voice for this session
        self._assign_random_voice()

        self.session_persona = generate_session_persona()
        self.system_prompt = build_system_prompt(self.session_persona)
        self.messages: list[dict[str, str]] = [
            {"role": "system", "content": self.system_prompt}
        ]
        self.turn_count = 0
        self._offer_explained = False
        self._product_summary = "unknown"
        self._key_claims: list[str] = []
        self._last_customer_objection = "none yet"

    def _assign_random_voice(self) -> None:
        """Randomly assign a voice for this session."""
        all_voices = self.MALE_VOICES + self.FEMALE_VOICES + self.NEUTRAL_VOICES
        self._selected_voice = random.choice(all_voices)
        print(f"Assigned voice: {self._selected_voice} for dynamic persona")

    # ── Conversation ──────────────────────────────────────────────────

    def get_opening(self) -> str:
        """Generate the customer's first reaction when the door is knocked."""
        opening_instruction = build_opening_message()
        self.messages.append({"role": "user", "content": opening_instruction})
        response = self._call_llm()
        self.messages.append({"role": "assistant", "content": response})
        self.turn_count += 1
        return response

    def respond(self, salesperson_message: str) -> str:
        """Generate the customer's response to a salesperson message."""
        self._update_sales_memory(salesperson_message)

        if self._looks_like_offer_explained(salesperson_message):
            self._offer_explained = True

        tagged_message = (
            "Salesperson says: "
            f"{salesperson_message}\n"
            "Respond only as the customer/homeowner."
        )
        self.messages.append({"role": "user", "content": tagged_message})
        memory_context = {
            "role": "system",
            "content": self._build_memory_instruction(),
        }
        response = self._call_llm(additional_messages=[memory_context])

        # If the offer has already been explained, block repetitive "what is it"
        # replies and retry with stricter transient instructions.
        if self._offer_explained and self._is_offer_clarification_loop(response):
            correction = {
                "role": "system",
                "content": (
                    "The offer is already clear. Do not ask what is being sold. "
                    "Write one concise customer response with either: "
                    "(a) one concrete objection, (b) one practical follow-up question, "
                    "or (c) one conditional next step."
                ),
            }

            for _ in range(2):
                response = self._call_llm(additional_messages=[memory_context, correction])
                if not self._is_offer_clarification_loop(response):
                    break

            if self._is_offer_clarification_loop(response):
                response = (
                    "I hear you. Main thing for me is price and what is included. "
                    "What exactly would you clean, and how much would it be?"
                )

        self.messages.append({"role": "assistant", "content": response})
        self._update_last_customer_objection(response)
        self.turn_count += 1
        return response

    def _call_llm(self, additional_messages: list[dict[str, str]] | None = None) -> str:
        """Send the conversation to the OpenAI API and return the reply."""
        payload_messages = self.messages.copy()
        if additional_messages:
            payload_messages.extend(additional_messages)

        completion = self.client.chat.completions.create(
            model=config.OPENAI_MODEL,
            messages=payload_messages,
            temperature=config.TEMPERATURE,
            max_completion_tokens=config.MAX_TOKENS,
            # Add frequency penalty to avoid repetitive phrases
            frequency_penalty=0.3,
            # Add presence penalty to encourage topic diversity
            presence_penalty=0.2,
        )
        return completion.choices[0].message.content.strip()

    @staticmethod
    def _looks_like_offer_explained(text: str) -> bool:
        """Detect if the rep has already explained the service/product."""
        normalized = (text or "").lower()
        offer_signals = [
            r"\bwe\s+clean\b",
            r"\bwe\s+wash\b",
            r"\bwe\s+service\b",
            r"\bwe\s+offer\b",
            r"\bwe\s+provide\b",
            r"\bwe\s+do\b",
            r"\bour\s+service\b",
            r"\bour\s+offer\b",
            r"\bour\s+company\b",
            r"\bwe\s+are\s+cleaning\b",
            r"\bwindow\s+clean",
            r"\bwindow\s+wash",
            r"\bcleaning\s+windows\b",
            r"\bsolar\b",
            r"\bpest\b",
            r"\broof\b",
        ]
        return any(re.search(pattern, normalized) for pattern in offer_signals)

    def _update_sales_memory(self, text: str) -> None:
        """Track product summary and key claims from salesperson turns."""
        normalized = (text or "").strip()
        if not normalized:
            return

        lowered = normalized.lower()
        offer_hint = re.search(
            r"\b(we\s+(clean|wash|offer|provide|do|service)|our\s+(service|offer|company))\b",
            lowered,
        )
        if offer_hint and self._product_summary == "unknown":
            self._product_summary = normalized[:120]

        claim_patterns = [
            r"\$\s?\d+(?:\.\d+)?",
            r"\b\d+%\b",
            r"\b(same\s+day|today|this\s+week|tomorrow)\b",
            r"\b(guarantee|insured|licensed|warranty)\b",
            r"\b(neighbor|next\s+door|down\s+the\s+street)\b",
        ]
        for pattern in claim_patterns:
            for match in re.finditer(pattern, lowered):
                claim = match.group(0)
                if claim not in self._key_claims:
                    self._key_claims.append(claim)

        self._key_claims = self._key_claims[-5:]

    def _update_last_customer_objection(self, response_text: str) -> None:
        """Capture the most recent objection/focus from the customer reply."""
        text = (response_text or "").strip()
        if not text:
            return

        question_match = re.search(r"[^?.!]*\?", text)
        if question_match:
            self._last_customer_objection = question_match.group(0).strip()
            return

        objection_patterns = [
            r"not interested",
            r"too expensive|price",
            r"need to ask|spouse|husband|wife|partner",
            r"already have",
            r"not now|busy|another time",
        ]
        lowered = text.lower()
        for pattern in objection_patterns:
            m = re.search(pattern, lowered)
            if m:
                self._last_customer_objection = m.group(0)
                return

    def _build_memory_instruction(self) -> str:
        """Build a compact memory block to stabilize turn-to-turn continuity."""
        claims = ", ".join(self._key_claims) if self._key_claims else "none"
        return (
            "Conversation memory (stay consistent with this):\n"
            f"- Product being sold: {self._product_summary}\n"
            f"- Key claims already stated by salesperson: {claims}\n"
            f"- Last customer objection/focus: {self._last_customer_objection}\n"
            "Use this memory to avoid forgetting and avoid repeating vague clarification."
        )

    @staticmethod
    def _is_offer_clarification_loop(text: str) -> bool:
        """Detect repetitive 'what is it' style fallback questions."""
        normalized = (text or "").lower().strip()
        loop_patterns = [
            r"\bwhat\s+is\s+it\b",
            r"\bwhat's\s+it\b",
            r"\bwhat\s+do\s+you\s+do\b",
            r"\bi\s+dunno\b",
            r"\bi\s+don't\s+know\b",
        ]
        return any(re.search(pattern, normalized) for pattern in loop_patterns)

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
        return "Dynamic Persona"

    @property
    def tts_voice(self) -> str:
        """Return the randomly assigned TTS voice for this session."""
        return self._selected_voice
