"""Runway API tool for Director.

A thin sync HTTP wrapper around the operations Director needs:

- text_to_video / image_to_video / video_to_video (remix)
- text_to_image with referenceImages (character / style consistency)
- background-removal / restyle convenience helpers built on video_to_video
- text_to_speech / sound_effect for audio
- voice_dubbing for translation

Mirrors the structure of ``fal_video.py`` / ``stabilityai.py`` — the agent
constructs the tool with an API key, calls a method per job, and gets
back ``{"status": "success", "video_path"|"audio_path"|"image_path": ...}``.
"""

from __future__ import annotations

import json
import mimetypes
import os
import time
from typing import Any, Dict, Iterable, List, Mapping, Optional
from urllib.parse import urlparse

import requests

API_BASE = "https://api.dev.runwayml.com"
API_VERSION = "2024-11-06"

VIDEO_MODELS = {
    "seedance2":   {"endpoints": ["text_to_video", "image_to_video", "video_to_video"], "durations": [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]},
    "gen4.5":      {"endpoints": ["text_to_video", "image_to_video"], "durations": [5, 10]},
    "gen4_turbo":  {"endpoints": ["image_to_video"], "durations": [5, 10]},
    "gen4_aleph":  {"endpoints": ["video_to_video"], "durations": [5, 10]},
    "veo3":        {"endpoints": ["text_to_video", "image_to_video"], "durations": [8]},
    "veo3.1":      {"endpoints": ["text_to_video", "image_to_video"], "durations": [4, 6, 8]},
    "veo3.1_fast": {"endpoints": ["text_to_video", "image_to_video"], "durations": [4, 6, 8]},
}

IMAGE_MODELS = ("gen4_image", "gen4_image_turbo", "gemini_2.5_flash")

PARAMS_CONFIG = {
    "text_to_video": {
        "model": {
            "type": "string",
            "description": "Runway video model.",
            "enum": list(VIDEO_MODELS.keys()),
            "default": "gen4.5",
        },
        "ratio": {"type": "string", "default": "1280:720"},
        "seed": {"type": "integer"},
    },
    "image_to_video": {
        "model": {"type": "string", "enum": list(VIDEO_MODELS.keys()), "default": "gen4_turbo"},
        "ratio": {"type": "string", "default": "1280:720"},
        "seed": {"type": "integer"},
    },
    "video_to_video": {
        "ratio": {"type": "string", "default": "1280:720"},
        "reference_image": {"type": "string"},
        "seed": {"type": "integer"},
    },
    "text_to_image": {
        "model": {"type": "string", "enum": list(IMAGE_MODELS), "default": "gen4_image"},
        "ratio": {"type": "string", "default": "1280:720"},
        "references": {
            "type": "object",
            "description": "Map of Tag -> URL/path for reference images.",
            "additionalProperties": {"type": "string"},
        },
        "seed": {"type": "integer"},
    },
    "text_to_speech": {
        "voice": {"type": "string", "description": "ElevenLabs voice id or name."},
        "model": {"type": "string", "default": "eleven_multilingual_v2"},
    },
    "sound_effect": {
        "duration_seconds": {"type": "number", "default": 5.0},
    },
    "voice_dubbing": {
        "target_language": {"type": "string", "description": "ISO 639-1 language code, e.g. 'ja', 'es'."},
        "source_language": {"type": "string"},
    },
}


class RunwayAPIError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(f"Runway API {status}: {message}")
        self.status = status


class RunwayTool:
    """Sync wrapper around the Runway developer API.

    Construct with an API key; call the per-operation methods. Each method
    returns a dict with ``status`` and the result asset path or URL.
    """

    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = API_BASE,
        polling_interval: float = 5.0,
        timeout: float = 900.0,
        allowed_media_hosts: Optional[Iterable[str]] = None,
    ):
        if not api_key:
            raise RunwayAPIError(401, "Runway API key not found")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.polling_interval = polling_interval
        self.timeout = timeout
        env_hosts = os.environ.get("RUNWAY_ALLOWED_MEDIA_HOSTS", "")
        self._hosts = {h.strip().lower() for h in env_hosts.split(",") if h.strip()}
        if allowed_media_hosts:
            self._hosts |= {h.lower() for h in allowed_media_hosts}

    # ── HTTP ──────────────────────────────────────────────

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "X-Runway-Version": API_VERSION,
            "Content-Type": "application/json",
        }

    def _post(self, path: str, body: Mapping[str, Any]) -> Dict[str, Any]:
        r = requests.post(f"{self.base_url}{path}", headers=self._headers(), json=body, timeout=60)
        if not r.ok:
            raise RunwayAPIError(r.status_code, r.text[:500])
        return r.json()

    def _get(self, path: str) -> Dict[str, Any]:
        r = requests.get(f"{self.base_url}{path}", headers=self._headers(), timeout=60)
        if not r.ok:
            raise RunwayAPIError(r.status_code, r.text[:500])
        return r.json()

    def _poll(self, task_id: str) -> Dict[str, Any]:
        start = time.time()
        while True:
            task = self._get(f"/v1/tasks/{task_id}")
            status = task.get("status", "")
            if status == "SUCCEEDED":
                return task
            if status in ("FAILED", "CANCELLED"):
                raise RunwayAPIError(0, f"task {task_id} {status}: {task.get('failure')}")
            if time.time() - start > self.timeout:
                raise RunwayAPIError(0, f"task {task_id} timed out")
            time.sleep(self.polling_interval)

    # ── Upload / URL handling ────────────────────────────

    def _validate_url(self, url: str) -> None:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise RunwayAPIError(0, f"unsupported URL: {url}")
        if self._hosts:
            host = (parsed.hostname or "").lower()
            if host not in self._hosts:
                raise RunwayAPIError(0, f"host '{host}' not in allowlist")

    def _upload(self, local_path: str) -> str:
        if not os.path.isfile(local_path):
            raise RunwayAPIError(0, f"file not found: {local_path}")
        filename = os.path.basename(local_path)
        init = self._post("/v1/uploads", {"filename": filename, "type": "ephemeral"})
        upload_url = init.get("uploadUrl")
        fields = init.get("fields") or {}
        runway_uri = init.get("runwayUri")
        if not upload_url or not runway_uri:
            raise RunwayAPIError(0, f"upload init missing fields: {init}")
        mime = mimetypes.guess_type(local_path)[0] or "application/octet-stream"
        with open(local_path, "rb") as fh:
            r = requests.post(upload_url, data=fields, files={"file": (filename, fh, mime)}, timeout=300)
        if not r.ok:
            raise RunwayAPIError(r.status_code, r.text[:500])
        return runway_uri

    def _ensure_url(self, p: str) -> str:
        if p.startswith("runway://"):
            return p
        if p.startswith(("http://", "https://")):
            self._validate_url(p)
            return p
        return self._upload(p)

    @staticmethod
    def _download(url: str, dest: str) -> str:
        os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
        with requests.get(url, stream=True, timeout=120) as r:
            r.raise_for_status()
            with open(dest, "wb") as f:
                for chunk in r.iter_content(chunk_size=1 << 15):
                    if chunk:
                        f.write(chunk)
        return dest

    @staticmethod
    def _snap_duration(model: str, requested: int) -> int:
        spec = VIDEO_MODELS.get(model, {})
        valid = spec.get("durations") or []
        if not valid or requested in valid:
            return requested
        return min(valid, key=lambda d: abs(d - requested))

    # ── Operations ───────────────────────────────────────

    def text_to_video(self, prompt: str, save_at: str, duration: int = 5, config: Optional[dict] = None) -> dict:
        cfg = dict(config or {})
        model = cfg.get("model", "gen4.5")
        body: Dict[str, Any] = {
            "model": model,
            "promptText": prompt,
            "ratio": cfg.get("ratio", "1280:720"),
            "duration": self._snap_duration(model, int(duration)),
        }
        if cfg.get("seed") is not None:
            body["seed"] = cfg["seed"]
        task = self._post("/v1/text_to_video", body)
        result = self._poll(task["id"])
        url = self._first_output(result)
        self._download(url, save_at)
        return {"status": "success", "video_path": save_at, "task_id": task["id"]}

    def image_to_video(self, image_url: str, prompt: str, save_at: str, duration: int = 5, config: Optional[dict] = None) -> dict:
        cfg = dict(config or {})
        model = cfg.get("model", "gen4_turbo")
        body: Dict[str, Any] = {
            "model": model,
            "promptImage": self._ensure_url(image_url),
            "promptText": prompt,
            "ratio": cfg.get("ratio", "1280:720"),
            "duration": self._snap_duration(model, int(duration)),
        }
        if cfg.get("seed") is not None:
            body["seed"] = cfg["seed"]
        task = self._post("/v1/image_to_video", body)
        result = self._poll(task["id"])
        url = self._first_output(result)
        self._download(url, save_at)
        return {"status": "success", "video_path": save_at, "task_id": task["id"]}

    def video_to_video(self, video_url: str, prompt: str, save_at: str, duration: int = 5, config: Optional[dict] = None) -> dict:
        """Remix an existing video with gen4_aleph."""
        cfg = dict(config or {})
        body: Dict[str, Any] = {
            "model": "gen4_aleph",
            "videoUri": self._ensure_url(video_url),
            "promptText": prompt,
            "ratio": cfg.get("ratio", "1280:720"),
            "duration": self._snap_duration("gen4_aleph", int(duration)),
        }
        if cfg.get("reference_image"):
            body["referenceImage"] = self._ensure_url(cfg["reference_image"])
        if cfg.get("seed") is not None:
            body["seed"] = cfg["seed"]
        task = self._post("/v1/video_to_video", body)
        result = self._poll(task["id"])
        url = self._first_output(result)
        self._download(url, save_at)
        return {"status": "success", "video_path": save_at, "task_id": task["id"]}

    def remove_background(self, video_url: str, save_at: str, duration: int = 5, config: Optional[dict] = None) -> dict:
        cfg = dict(config or {})
        prompt = cfg.get(
            "prompt",
            "transparent black background, isolate subject only, clean matte, no fringing",
        )
        return self.video_to_video(video_url, prompt, save_at, duration, cfg)

    def text_to_image(self, prompt: str, save_at: str, config: Optional[dict] = None) -> dict:
        cfg = dict(config or {})
        model = cfg.get("model", "gen4_image")
        body: Dict[str, Any] = {
            "model": model,
            "promptText": prompt,
            "ratio": cfg.get("ratio", "1280:720"),
        }
        refs = cfg.get("references") or {}
        if refs:
            body["referenceImages"] = [
                {"tag": tag, "uri": self._ensure_url(src)} for tag, src in refs.items()
            ]
        if cfg.get("seed") is not None:
            body["seed"] = cfg["seed"]
        task = self._post("/v1/text_to_image", body)
        result = self._poll(task["id"])
        url = self._first_output(result)
        self._download(url, save_at)
        return {"status": "success", "image_path": save_at, "task_id": task["id"]}

    def text_to_speech(self, text: str, voice: str, save_at: str, config: Optional[dict] = None) -> dict:
        cfg = dict(config or {})
        body = {"model": cfg.get("model", "eleven_multilingual_v2"), "text": text, "voice": voice}
        task = self._post("/v1/text_to_speech", body)
        result = self._poll(task["id"])
        url = self._first_output(result)
        self._download(url, save_at)
        return {"status": "success", "audio_path": save_at, "task_id": task["id"]}

    def sound_effect(self, prompt: str, save_at: str, duration_seconds: float = 5.0) -> dict:
        body = {
            "model": "eleven_text_to_sound_v2",
            "text": prompt,
            "durationSeconds": float(duration_seconds),
        }
        task = self._post("/v1/sound_effect", body)
        result = self._poll(task["id"])
        url = self._first_output(result)
        self._download(url, save_at)
        return {"status": "success", "audio_path": save_at, "task_id": task["id"]}

    def voice_dubbing(self, audio_url: str, target_language: str, save_at: str, source_language: Optional[str] = None) -> dict:
        body: Dict[str, Any] = {
            "model": "eleven_voice_dubbing",
            "audio": self._ensure_url(audio_url),
            "targetLanguage": target_language,
        }
        if source_language:
            body["sourceLanguage"] = source_language
        task = self._post("/v1/voice_dubbing", body)
        result = self._poll(task["id"])
        url = self._first_output(result)
        self._download(url, save_at)
        return {"status": "success", "audio_path": save_at, "task_id": task["id"]}

    # ── helpers ──────────────────────────────────────────

    @staticmethod
    def _first_output(task: Dict[str, Any]) -> str:
        out = task.get("output")
        if isinstance(out, list):
            if not out:
                raise RunwayAPIError(0, f"task succeeded but no output: {json.dumps(task)[:300]}")
            return out[0]
        if isinstance(out, str) and out:
            return out
        raise RunwayAPIError(0, f"task succeeded but no output: {json.dumps(task)[:300]}")
