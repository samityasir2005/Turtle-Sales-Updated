"""
Eye-contact detector using OpenCV Haar cascades.

Uses face + eye detection to determine if the user is looking at the camera.
If both eyes are detected within a detected face, the user is making eye contact.
"""

from __future__ import annotations

import base64
from collections import deque
from typing import Any

import cv2
import numpy as np

_face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)
_face_alt_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_alt2.xml"
)
_eye_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_eye.xml"
)


class EyeContactDetector:
    """Stateful detector using OpenCV Haar cascades."""

    def __init__(self) -> None:
        self._last_looking = False
        self._missed_face_frames = 0
        self._looking_history: deque[bool] = deque(maxlen=8)

    def detect_from_base64(self, b64_image: str) -> dict[str, Any]:
        try:
            img_bytes = base64.b64decode(b64_image)
            np_arr = np.frombuffer(img_bytes, dtype=np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            if frame is None:
                return {"face_detected": False, "looking": False, "confidence": 0.0}
            return self.detect(frame)
        except Exception:
            return {"face_detected": False, "looking": False, "confidence": 0.0}

    def detect(self, frame: np.ndarray) -> dict[str, Any]:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (5, 5), 0)
        gray = cv2.equalizeHist(gray)

        faces = _face_cascade.detectMultiScale(
            gray, scaleFactor=1.05, minNeighbors=3, minSize=(50, 50)
        )
        if len(faces) == 0:
            faces = _face_alt_cascade.detectMultiScale(
                gray, scaleFactor=1.07, minNeighbors=2, minSize=(50, 50)
            )

        if len(faces) == 0:
            self._missed_face_frames += 1
            if self._missed_face_frames <= 4:
                return {
                    "face_detected": True,
                    "looking": self._last_looking,
                    "confidence": 0.4 if self._last_looking else 0.2,
                }
            self._last_looking = False
            self._looking_history.clear()
            return {"face_detected": False, "looking": False, "confidence": 0.0}

        self._missed_face_frames = 0

        x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
        roi_gray = gray[y : y + h, x : x + w]

        eyes = _eye_cascade.detectMultiScale(
            roi_gray, scaleFactor=1.05, minNeighbors=2, minSize=(15, 15)
        )

        top_half_eyes = [
            (ex, ey, ew, eh)
            for (ex, ey, ew, eh) in eyes
            if ey < h * 0.6
        ]

        raw_looking = len(top_half_eyes) >= 1

        if raw_looking and len(top_half_eyes) >= 2:
            eye_centers = [(ex + ew // 2, ey + eh // 2) for (ex, ey, ew, eh) in top_half_eyes[:2]]
            face_cx = w // 2
            avg_eye_x = sum(c[0] for c in eye_centers) / len(eye_centers)
            offset = abs(avg_eye_x - face_cx) / w
            if offset > 0.22:
                raw_looking = False

        self._looking_history.append(raw_looking)
        looking_votes = sum(1 for v in self._looking_history if v)
        looking = looking_votes >= max(1, len(self._looking_history) // 3)

        base_conf = 0.9 if raw_looking else (0.5 if len(top_half_eyes) >= 1 else 0.15)
        stability_bonus = min(0.1, 0.015 * looking_votes)
        confidence = max(0.0, min(1.0, base_conf + stability_bonus))
        self._last_looking = looking

        return {
            "face_detected": True,
            "looking": looking,
            "confidence": round(confidence, 2),
        }

    def close(self) -> None:
        pass
