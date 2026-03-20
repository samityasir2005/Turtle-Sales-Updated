#!/usr/bin/env python3
"""
Flask API server for the AI Sales Training program.
Exposes endpoints for the frontend to interact with the CustomerAgent.
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import io
import base64
from customer_agent import CustomerAgent
from audio import transcribe, speak
import config

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend communication

# Store active sessions (in production, use Redis or similar)
sessions = {}


import re

def _is_hallucination(text):
    """Detect Whisper hallucination loops (e.g. 'benefits, benefits, benefits...')."""
    if not text:
        return False
    words = re.findall(r'\b[a-z]+\b', text.lower())
    if len(words) < 4:
        return False
    # Check if any single word makes up 50%+ of all words
    from collections import Counter
    counts = Counter(words)
    most_common_word, most_common_count = counts.most_common(1)[0]
    if most_common_count / len(words) >= 0.5:
        return True
    return False


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'ok',
        'api_key_configured': bool(config.OPENAI_API_KEY)
    })


@app.route('/api/greeting/tts', methods=['POST'])
def greeting_tts():
    """Generate TTS for onboarding greeting with custom voice."""
    try:
        data = request.json
        text = data.get('text', '')
        voice = data.get('voice', 'echo')  # Default to echo (male voice)
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        # Generate TTS audio
        from openai import OpenAI
        client = OpenAI(api_key=config.OPENAI_API_KEY)
        
        response = client.audio.speech.create(
            model=config.TTS_MODEL,
            voice=voice,
            input=text,
            response_format="mp3",
            speed=config.TTS_SPEED
        )
        
        # Return audio as base64
        audio_base64 = base64.b64encode(response.content).decode('utf-8')
        
        return jsonify({
            'audio': audio_base64,
            'format': 'mp3',
            'voice': voice,
            'speed': config.TTS_SPEED
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/session/start', methods=['POST'])
def start_session():
    """Start a new training session with a random or specific persona."""
    try:
        data = request.json or {}
        persona_id = data.get('persona_id')
        
        # Create new customer agent
        agent = CustomerAgent(persona_id=persona_id)
        
        # Generate session ID
        import uuid
        session_id = str(uuid.uuid4())
        
        # Store session
        sessions[session_id] = {
            'agent': agent,
            'voice': agent.tts_voice  # Use the randomly assigned voice
        }
        
        # Get opening message
        opening = agent.get_opening()
        
        return jsonify({
            'session_id': session_id,
            'persona_name': agent.persona_name,
            'opening_message': opening,
            'voice': sessions[session_id]['voice']
        })
    except Exception as e:
        import traceback
        print(f"ERROR in start_session: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/session/<session_id>/respond', methods=['POST'])
def respond(session_id):
    """Process user input and get customer response."""
    try:
        if session_id not in sessions:
            return jsonify({'error': 'Session not found'}), 404
        
        data = request.json
        user_message = data.get('message', '')
        
        if not user_message:
            return jsonify({'error': 'No message provided'}), 400
        
        agent = sessions[session_id]['agent']
        response = agent.respond(user_message)
        
        return jsonify({
            'response': response,
            'turn_count': agent.turn_count
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/session/<session_id>/transcribe', methods=['POST'])
def transcribe_audio(session_id):
    """Transcribe audio from the user."""
    try:
        if session_id not in sessions:
            return jsonify({'error': 'Session not found'}), 404
        
        # Get audio data from request
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        audio_bytes = audio_file.read()
        
        # Log audio info
        print(f"Received audio file: {audio_file.filename}, size: {len(audio_bytes)} bytes")
        
        if len(audio_bytes) < 100:
            return jsonify({'error': 'Audio file too small'}), 400
        
        from openai import OpenAI
        import io
        
        client = OpenAI(api_key=config.OPENAI_API_KEY)
        
        # Create a file-like object with the proper filename
        audio_buffer = io.BytesIO(audio_bytes)
        # Use the filename from the upload or default to webm
        audio_buffer.name = audio_file.filename or "recording.webm"
        
        print(f"Attempting transcription with filename: {audio_buffer.name}")
        
        try:
            transcription_prompt = "A casual door-to-door sales conversation."
            
            result = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_buffer,
                language="en",
                prompt=transcription_prompt,
                temperature=0.0,
                response_format="verbose_json"
            )
            
            transcript = result.text.strip()
            print(f"Transcription result: '{transcript}'")

            if _is_hallucination(transcript):
                print("Detected Whisper hallucination, discarding.")
                return jsonify({'transcript': ''})
            
            return jsonify({
                'transcript': transcript
            })
        except Exception as whisper_error:
            error_msg = str(whisper_error)
            print(f"Whisper API error: {error_msg}")
            
            # If it's a format error and ffmpeg is available, try conversion
            if 'format' in error_msg.lower() or 'invalid' in error_msg.lower():
                print("Attempting audio format conversion...")
                try:
                    import tempfile
                    import os
                    from pydub import AudioSegment
                    
                    # Save bytes to temp file
                    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_buffer.name)[1]) as temp_in:
                        temp_in.write(audio_bytes)
                        temp_in_path = temp_in.name
                    
                    # Convert to MP3 (widely supported)
                    audio = AudioSegment.from_file(temp_in_path)
                    
                    with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as temp_out:
                        temp_out_path = temp_out.name
                    
                    audio.export(temp_out_path, format='mp3')
                    
                    # Read converted file
                    with open(temp_out_path, 'rb') as f:
                        converted_bytes = f.read()
                    
                    print(f"Converted to MP3: {len(converted_bytes)} bytes")
                    
                    # Try transcription again with converted audio
                    audio_buffer2 = io.BytesIO(converted_bytes)
                    audio_buffer2.name = "recording.mp3"
                    
                    transcription_prompt = "A casual door-to-door sales conversation."
                    
                    result = client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_buffer2,
                        language="en",
                        prompt=transcription_prompt,
                        temperature=0.0,
                        response_format="verbose_json"
                    )
                    
                    transcript = result.text.strip()
                    print(f"Transcription result (after conversion): '{transcript}'")
                    
                    # Clean up
                    os.unlink(temp_in_path)
                    os.unlink(temp_out_path)
                    
                    if _is_hallucination(transcript):
                        print("Detected Whisper hallucination, discarding.")
                        return jsonify({'transcript': ''})

                    return jsonify({
                        'transcript': transcript
                    })
                    
                except ImportError:
                    print("PyDub not available or ffmpeg not installed")
                    raise whisper_error
                except Exception as conv_error:
                    print(f"Conversion failed: {conv_error}")
                    raise whisper_error
            else:
                raise whisper_error
            
    except Exception as e:
        print(f"Transcription error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/session/<session_id>/tts', methods=['POST'])
def text_to_speech(session_id):
    """Convert text to speech and return audio."""
    try:
        if session_id not in sessions:
            return jsonify({'error': 'Session not found'}), 404
        
        data = request.json
        text = data.get('text', '')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        voice = sessions[session_id]['voice']
        
        # Generate TTS audio
        from openai import OpenAI
        client = OpenAI(api_key=config.OPENAI_API_KEY)
        
        response = client.audio.speech.create(
            model=config.TTS_MODEL,
            voice=voice,
            input=text,
            response_format="mp3",
            speed=config.TTS_SPEED  # Faster playback for quicker responses
        )
        
        # Return audio as base64
        audio_base64 = base64.b64encode(response.content).decode('utf-8')
        
        return jsonify({
            'audio': audio_base64,
            'format': 'mp3',
            'voice': voice,
            'speed': config.TTS_SPEED
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/session/<session_id>/history', methods=['GET'])
def get_history(session_id):
    """Get conversation history."""
    try:
        if session_id not in sessions:
            return jsonify({'error': 'Session not found'}), 404
        
        agent = sessions[session_id]['agent']
        history = agent.get_conversation_log()
        
        return jsonify({
            'history': history,
            'turn_count': agent.turn_count
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/session/<session_id>/reset', methods=['POST'])
def reset_session(session_id):
    """Reset the conversation but keep the same persona."""
    try:
        if session_id not in sessions:
            return jsonify({'error': 'Session not found'}), 404
        
        agent = sessions[session_id]['agent']
        agent.reset()
        
        # Get new opening
        opening = agent.get_opening()
        
        return jsonify({
            'opening_message': opening
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/session/<session_id>/end', methods=['POST'])
def end_session(session_id):
    """End a training session."""
    try:
        if session_id not in sessions:
            return jsonify({'error': 'Session not found'}), 404
        
        # Clean up session
        del sessions[session_id]
        
        return jsonify({
            'message': 'Session ended successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/personas', methods=['GET'])
def list_personas():
    """List available customer personas."""
    try:
        personas = CustomerAgent.list_personas()
        return jsonify({
            'personas': personas
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/session/<session_id>/reveal', methods=['GET'])
def reveal_persona(session_id):
    """Reveal persona details (for debugging/learning)."""
    try:
        if session_id not in sessions:
            return jsonify({'error': 'Session not found'}), 404
        
        agent = sessions[session_id]['agent']
        
        return jsonify({
            'persona_name': agent.persona_name,
            'character_name': agent.persona.get('life_details', {}).get('name', 'Unknown'),
            'resistance_level': agent.persona.get('resistance_level', 0),
            'description': agent.persona.get('description', '')
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    # Check for API key
    if not config.OPENAI_API_KEY:
        print("\n⚠️  WARNING: OPENAI_API_KEY not found!")
        print("Please create a .env file with your OpenAI API key.\n")
    
    print("\n🚀 AI Sales Training API Server")
    print("=" * 50)
    print(f"Running on: http://localhost:5001")
    print(f"API Key configured: {bool(config.OPENAI_API_KEY)}")
    print("=" * 50 + "\n")
    
    app.run(host='0.0.0.0', port=5001, debug=True)
