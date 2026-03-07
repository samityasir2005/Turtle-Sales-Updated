#!/usr/bin/env python3
"""
Turtle Sales — Voice-Based Door-to-Door Practice Reps
Usage:
    python main.py
"""

from __future__ import annotations

import sys
import os

# Ensure the project directory is on the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from customer_agent import CustomerAgent
from audio import listen_and_transcribe, speak
import config


# ── ANSI colors for terminal readability ──────────────────────────────
class Color:
    CYAN    = "\033[96m"
    YELLOW  = "\033[93m"
    GREEN   = "\033[92m"
    RED     = "\033[91m"
    MAGENTA = "\033[95m"
    BOLD    = "\033[1m"
    DIM     = "\033[2m"
    RESET   = "\033[0m"


def banner() -> None:
    print(f"""
{Color.CYAN}{Color.BOLD}  TURTLE SALES — Door-to-Door Practice Reps{Color.RESET}
{Color.DIM}  Voice mode. Speak into your mic, customer talks back.{Color.RESET}
{Color.DIM}  Every session is a different customer. Treat it like the real thing.{Color.RESET}
""")


def _get_voice(agent: CustomerAgent) -> str:
    """Get the TTS voice for the current persona."""
    return agent.tts_voice


def _customer_says(text: str, voice: str) -> None:
    """Print the customer transcript and play it as audio."""
    print(f"\n{Color.YELLOW}  Customer: {Color.RESET}{text}\n")
    try:
        speak(text, voice=voice)
    except Exception as e:
        print(f"  {Color.DIM}(TTS error: {e}){Color.RESET}")


def run_conversation(agent: CustomerAgent) -> None:
    """Main conversation loop — voice in, voice + transcript out."""

    voice = _get_voice(agent)

    print(f"\n{Color.DIM}  ─────────────────────────────────────{Color.RESET}")
    print(f"{Color.BOLD}  New door.{Color.RESET} You don't know who's behind it.")
    print(f"{Color.DIM}  ─────────────────────────────────────{Color.RESET}")
    print(f"\n{Color.DIM}  Press ENTER to start recording, then ENTER again to stop.{Color.RESET}")
    print(f"{Color.DIM}  Type /quit, /reset, /log, or /reveal for commands.{Color.RESET}")

    print(f"\n  You walk up and knock.")

    # Auto-knock — customer reacts immediately
    try:
        opening = agent.get_opening()
        _customer_says(opening, voice)
    except Exception as e:
        print(f"\n  {Color.RED}Error generating opening: {e}{Color.RESET}\n")

    while True:
        try:
            # Wait for user to press Enter, or type a command
            raw = input(f"{Color.GREEN}  [ENTER to record / type command]: {Color.RESET}").strip()
        except (EOFError, KeyboardInterrupt):
            print(f"\n{Color.DIM}  Session ended.{Color.RESET}")
            break

        # ── Commands (typed) ──────────────────────────────────────
        if raw.lower() == "/quit":
            print(f"\n{Color.DIM}  Session ended after {agent.turn_count} exchanges.{Color.RESET}")
            break

        if raw.lower() == "/reset":
            agent = CustomerAgent()  # new random customer
            voice = _get_voice(agent)
            print(f"\n  New door. You walk up and knock.")
            try:
                opening = agent.get_opening()
                _customer_says(opening, voice)
            except Exception as e:
                print(f"\n  {Color.RED}Error: {e}{Color.RESET}\n")
            continue

        if raw.lower() == "/log":
            print(f"\n{Color.DIM}{'─' * 50}")
            for msg in agent.get_conversation_log():
                role = "CUSTOMER" if msg["role"] == "assistant" else "YOU"
                print(f"  [{role}]: {msg['content']}")
            print(f"{'─' * 50}{Color.RESET}\n")
            continue

        if raw.lower() == "/reveal":
            print(f"\n{Color.DIM}{'─' * 50}{Color.RESET}")
            print(f"  {Color.BOLD}Customer type:{Color.RESET} {Color.YELLOW}{agent.persona_name}{Color.RESET}")
            print(f"  {Color.BOLD}Character:{Color.RESET} {Color.DIM}{agent.persona.get('life_details', {}).get('name', '???')}{Color.RESET}")
            print(f"  {Color.BOLD}Resistance:{Color.RESET} {agent.persona.get('resistance_level', '?')}/10")
            print(f"  {Color.BOLD}Description:{Color.RESET} {Color.DIM}{agent.persona.get('description', '')}{Color.RESET}")
            print(f"{Color.DIM}{'─' * 50}{Color.RESET}\n")
            continue

        # ── Voice input ────────────────────────────────────────────
        if raw == "":
            # User pressed Enter — start recording
            user_text = listen_and_transcribe()
            if not user_text:
                print(f"  {Color.DIM}(didn't catch anything — try again){Color.RESET}")
                continue
            print(f"{Color.GREEN}  You said: {Color.RESET}{user_text}")
        else:
            # User typed something that's not a command — treat as text input
            user_text = raw

        # ── Get customer response ─────────────────────────────────
        try:
            response = agent.respond(user_text)
            _customer_says(response, voice)
        except Exception as e:
            print(f"\n  {Color.RED}Error: {e}{Color.RESET}")
            print(f"  {Color.DIM}Make sure your OPENAI_API_KEY is set in a .env file.{Color.RESET}\n")


def main() -> None:
    banner()

    # Check API key
    if not config.OPENAI_API_KEY:
        print(f"{Color.RED}  OPENAI_API_KEY not found!{Color.RESET}")
        print(f"  {Color.DIM}Create a .env file in the project folder with:{Color.RESET}")
        print(f"  {Color.DIM}OPENAI_API_KEY=sk-your-key-here{Color.RESET}\n")

        key = input(f"  {Color.CYAN}Paste your OpenAI API key (or press Enter to quit): {Color.RESET}").strip()
        if not key:
            print(f"  {Color.DIM}Exiting.{Color.RESET}")
            sys.exit(0)
        config.OPENAI_API_KEY = key
        os.environ["OPENAI_API_KEY"] = key

    # Quick mic check
    print(f"{Color.DIM}  Checking microphone...{Color.RESET}", end=" ")
    try:
        import sounddevice as sd
        dev = sd.query_devices(kind="input")
        print(f"{Color.GREEN}OK{Color.RESET} ({dev['name']})")
    except Exception as e:
        print(f"{Color.RED}PROBLEM{Color.RESET}")
        print(f"  {Color.DIM}Mic issue: {e}{Color.RESET}")
        print(f"  {Color.DIM}You can still type responses manually.{Color.RESET}")

    while True:
        agent = CustomerAgent()  # random persona every time
        run_conversation(agent)

        again = input(f"\n{Color.CYAN}  Run another door? (y/n): {Color.RESET}").strip().lower()
        if again != "y":
            print(f"\n{Color.BOLD}  Good work. Now go close some real ones.{Color.RESET}\n")
            break


if __name__ == "__main__":
    main()
