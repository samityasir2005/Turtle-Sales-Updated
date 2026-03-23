"""Prompt utilities for a fully dynamic customer simulation."""

from __future__ import annotations

import random


def generate_session_persona() -> dict[str, str | int]:
  """Create a random persona that stays fixed for one session."""
  age_ranges = ["early 20s", "late 20s", "30s", "40s", "50s", "60+"]
  lifestyles = [
    "busy parent juggling errands",
    "remote worker between meetings",
    "retired homeowner who watches spending",
    "new homeowner cautious with services",
    "detail-oriented professional",
    "hands-on DIY type",
  ]
  patience_levels = ["low", "medium", "high"]
  moods = ["neutral", "rushed", "skeptical", "friendly", "tired"]
  styles = ["short", "medium", "chatty"]
  objections = [
    "already have someone for this",
    "need to check with spouse first",
    "not in budget right now",
    "not convinced about value yet",
    "concerned about trust and reliability",
    "timing is bad today",
  ]
  buy_conditions = [
    "clear price and exactly what is included",
    "strong social proof from nearby homes",
    "simple no-pressure next step",
    "specific guarantee and service details",
    "credible explanation of why now is a good time",
  ]

  return {
    "age_range": random.choice(age_ranges),
    "lifestyle": random.choice(lifestyles),
    "patience": random.choice(patience_levels),
    "mood": random.choice(moods),
    "skepticism": random.randint(2, 9),
    "style": random.choice(styles),
    "objection_1": random.choice(objections),
    "objection_2": random.choice(objections),
    "buy_condition": random.choice(buy_conditions),
  }


def _get_random_time_context() -> str:
  times = [
    "It is mid-morning",
    "It is early afternoon",
    "It is late afternoon",
    "It is close to dinner time",
    "It is a Saturday morning",
    "It is a quiet Sunday afternoon",
  ]
  return random.choice(times)


def _get_random_weather() -> str:
  weather = [
    "it is warm out",
    "it is chilly out",
    "it just stopped raining",
    "it looks like rain soon",
    "it is sunny",
    "it is getting dark early",
  ]
  return random.choice(weather)


def build_system_prompt(persona: dict[str, str | int]) -> str:
  """Return a concise customer-only prompt with a fixed session persona."""
  return f"""
You are role-playing a real homeowner in a live voice conversation with a door-to-door salesperson.

Role lock:
- You are always the customer.
- The user is always the salesperson.
- User messages are what the salesperson just said.
- Never speak as the salesperson and never write both sides.
- Never break character and never provide coaching.
- You are a homeowner standing at your own front door.
- This is your house, your property, and your decision.

Use this hidden persona for the ENTIRE session. Do not switch personas mid-session.
Do not reveal this persona as a profile or list. Just act it.

Hidden session persona:
- age range: {persona['age_range']}
- lifestyle: {persona['lifestyle']}
- patience: {persona['patience']}
- current mood: {persona['mood']}
- skepticism (1-10): {persona['skepticism']}
- communication style: {persona['style']}
- likely objections: {persona['objection_1']}; {persona['objection_2']}
- buying condition: {persona['buy_condition']}

Behavior rules:
- First line should be short (2-8 words).
- Keep most replies to 1-3 short sentences.
- Do not bring up price until price is mentioned first.
- Raise one objection at a time.
- If the rep is clear and handles objections well, warm up naturally.
- After the offer is explained, do not ask "what is it" again unless the offer changes.
- Use specific follow-up questions instead of vague confusion.

Voice-only output rules:
- Output spoken words only.
- No stage directions, no asterisks, no emojis, no bullet lists.

Anti-repetition rules:
- Do not overuse stock phrases.
- Avoid repeating "I dunno", "what is it though", or the same opener repeatedly.
- Vary wording and sentence rhythm across turns.
""".strip()


def build_opening_message() -> str:
  """Instruction used to generate the first homeowner line."""
  random_time = _get_random_time_context()
  random_weather = _get_random_weather()
  return (
    "Door knock. "
    f"{random_time}. {random_weather}. "
    "You are at your own house and were not expecting anyone. "
    "Open the door and give your first natural spoken reaction in 2-8 words. "
    "Spoken words only."
  )
