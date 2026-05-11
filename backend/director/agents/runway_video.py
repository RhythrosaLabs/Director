"""Runway video / image / audio agent.

Exposes the full Runway API surface to Director: text-to-video,
image-to-video, video-to-video (remix), text-to-image with
``referenceImages`` for character / location / style consistency,
background removal via aleph, voiceover (TTS), and dubbing.

This is a *single* agent rather than one per operation because all the
endpoints share infrastructure (auth, polling, upload, allowlist) and
the LLM benefits from seeing the whole capability menu in one place.
"""

from __future__ import annotations

import logging
import os
import uuid
from typing import Optional

from director.agents.base import AgentResponse, AgentStatus, BaseAgent
from director.constants import DOWNLOADS_PATH
from director.core.session import (
    ImageContent,
    ImageData,
    MsgStatus,
    Session,
    TextContent,
    VideoContent,
    VideoData,
)
from director.tools.runway import (
    PARAMS_CONFIG as RUNWAY_PARAMS_CONFIG,
    RunwayAPIError,
    RunwayTool,
)
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)


RUNWAY_OPERATIONS = [
    "text_to_video",
    "image_to_video",
    "video_to_video",
    "remove_background",
    "text_to_image",
    "text_to_speech",
    "sound_effect",
    "voice_dubbing",
]


RUNWAY_AGENT_PARAMETERS = {
    "type": "object",
    "required": ["operation", "collection_id"],
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "VideoDB collection in which to register the generated asset.",
        },
        "operation": {
            "type": "string",
            "enum": RUNWAY_OPERATIONS,
            "description": (
                "Which Runway operation to run. "
                "text_to_video / image_to_video / video_to_video for clips, "
                "remove_background for subject isolation, "
                "text_to_image for keyframes with optional character/style references, "
                "text_to_speech / sound_effect / voice_dubbing for audio."
            ),
        },
        "name": {
            "type": "string",
            "description": "Short label for the generation run.",
        },
        "prompt": {
            "type": "string",
            "description": "Text prompt (operation-specific meaning).",
        },
        "duration": {
            "type": "number",
            "default": 5,
            "description": "Clip duration in seconds (video ops only).",
        },
        "image_id": {
            "type": "string",
            "description": "VideoDB image id to use as input for image_to_video.",
        },
        "image_url": {
            "type": "string",
            "description": "Direct URL of the input image (alternative to image_id).",
        },
        "video_id": {
            "type": "string",
            "description": "VideoDB video id to use as input for video_to_video / remove_background.",
        },
        "video_url": {
            "type": "string",
            "description": "Direct URL of the input video (alternative to video_id).",
        },
        "voice": {
            "type": "string",
            "description": "Voice id/name for text_to_speech.",
        },
        "target_language": {
            "type": "string",
            "description": "ISO 639-1 target language for voice_dubbing, e.g. 'ja', 'es'.",
        },
        "source_language": {
            "type": "string",
            "description": "Optional source language for voice_dubbing.",
        },
        "config": {
            "type": "object",
            "description": (
                "Operation-specific knobs. Common fields: model, ratio, seed, references "
                "(map of Tag->URL/path for text_to_image), reference_image (for video_to_video)."
            ),
            "properties": {
                "text_to_video":   {"type": "object", "properties": RUNWAY_PARAMS_CONFIG["text_to_video"]},
                "image_to_video":  {"type": "object", "properties": RUNWAY_PARAMS_CONFIG["image_to_video"]},
                "video_to_video":  {"type": "object", "properties": RUNWAY_PARAMS_CONFIG["video_to_video"]},
                "text_to_image":   {"type": "object", "properties": RUNWAY_PARAMS_CONFIG["text_to_image"]},
                "text_to_speech":  {"type": "object", "properties": RUNWAY_PARAMS_CONFIG["text_to_speech"]},
                "sound_effect":    {"type": "object", "properties": RUNWAY_PARAMS_CONFIG["sound_effect"]},
                "voice_dubbing":   {"type": "object", "properties": RUNWAY_PARAMS_CONFIG["voice_dubbing"]},
            },
        },
    },
}


class RunwayVideoAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "runway_video"
        self.description = (
            "Runway-powered media generation: clips (text/image/video-to-video), "
            "keyframes with character/style references, background removal via aleph, "
            "voiceover, sound effects, and dubbing. Use when the request mentions Runway, "
            "gen4, seedance2, veo3, aleph, or asks for visually consistent multi-shot output "
            "anchored on reference images."
        )
        self.parameters = RUNWAY_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    # ── public entry ─────────────────────────────────────

    def run(
        self,
        collection_id: str,
        operation: str,
        name: Optional[str] = None,
        prompt: Optional[str] = None,
        duration: float = 5,
        image_id: Optional[str] = None,
        image_url: Optional[str] = None,
        video_id: Optional[str] = None,
        video_url: Optional[str] = None,
        voice: Optional[str] = None,
        target_language: Optional[str] = None,
        source_language: Optional[str] = None,
        config: Optional[dict] = None,
        *args,
        **kwargs,
    ) -> AgentResponse:
        """Dispatch to one Runway operation and register the asset in VideoDB.

        :param str collection_id: VideoDB collection to register the result.
        :param str operation: Which Runway endpoint to call.
        :param str name: Short label shown in the UI.
        :param str prompt: Text prompt for the operation.
        :param float duration: Duration in seconds (video ops only).
        :param str image_id: VideoDB image id input (image_to_video).
        :param str image_url: Direct image URL input (image_to_video).
        :param str video_id: VideoDB video id input (video_to_video, remove_background).
        :param str video_url: Direct video URL input (video_to_video, remove_background).
        :param str voice: Voice for text_to_speech.
        :param str target_language: Target language for voice_dubbing.
        :param str source_language: Source language for voice_dubbing.
        :param dict config: Per-operation knobs (model, ratio, seed, references, etc.).
        """
        if operation not in RUNWAY_OPERATIONS:
            return AgentResponse(status=AgentStatus.ERROR, message=f"unknown operation: {operation}")

        api_key = os.getenv("RUNWAYML_API_SECRET")
        if not api_key:
            return AgentResponse(status=AgentStatus.ERROR, message="RUNWAYML_API_SECRET not set")

        op_config = (config or {}).get(operation) or (config or {})
        self.videodb_tool = VideoDBTool(collection_id=collection_id)
        os.makedirs(DOWNLOADS_PATH, exist_ok=True)

        try:
            tool = RunwayTool(api_key=api_key)
            label = name or f"runway {operation}"
            self.output_message.actions.append(f"Runway: <b>{operation}</b> — <i>{label}</i>")
            self.output_message.push_update()

            if operation in ("text_to_video", "image_to_video", "video_to_video", "remove_background"):
                return self._handle_video(tool, operation, collection_id, label, prompt,
                                          duration, image_id, image_url, video_id, video_url, op_config)
            if operation == "text_to_image":
                return self._handle_image(tool, collection_id, label, prompt, op_config)
            if operation == "text_to_speech":
                return self._handle_tts(tool, collection_id, label, prompt, voice, op_config)
            if operation == "sound_effect":
                return self._handle_sfx(tool, collection_id, label, prompt, duration, op_config)
            if operation == "voice_dubbing":
                return self._handle_dub(tool, collection_id, label, video_id, video_url, target_language, source_language)

            return AgentResponse(status=AgentStatus.ERROR, message=f"unhandled operation: {operation}")

        except RunwayAPIError as e:
            logger.exception("runway API error")
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))
        except Exception as e:  # noqa: BLE001
            logger.exception("runway agent error")
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

    # ── per-operation handlers ───────────────────────────

    def _resolve_image(self, image_id: Optional[str], image_url: Optional[str]) -> str:
        if image_url:
            return image_url
        if not image_id:
            raise ValueError("image_id or image_url is required")
        data = self.videodb_tool.get_image(image_id)
        if not data:
            raise ValueError(f"image_id '{image_id}' not found in collection")
        url = data.get("url") or data.get("storage_url")
        if not url:
            raise ValueError(f"image '{image_id}' has no resolvable URL")
        return url

    def _resolve_video(self, video_id: Optional[str], video_url: Optional[str]) -> str:
        if video_url:
            return video_url
        if not video_id:
            raise ValueError("video_id or video_url is required")
        data = self.videodb_tool.get_video(video_id)
        if not data:
            raise ValueError(f"video_id '{video_id}' not found in collection")
        url = data.get("stream_url") or data.get("url")
        if not url:
            raise ValueError(f"video '{video_id}' has no resolvable URL")
        return url

    def _video_path(self, operation: str) -> str:
        return f"{DOWNLOADS_PATH}/runway_{operation}_{uuid.uuid4()}.mp4"

    def _audio_path(self, operation: str) -> str:
        return f"{DOWNLOADS_PATH}/runway_{operation}_{uuid.uuid4()}.mp3"

    def _image_path(self) -> str:
        return f"{DOWNLOADS_PATH}/runway_image_{uuid.uuid4()}.png"

    def _register_video(self, save_at: str, collection_id: str, name: str, video_content: VideoContent) -> AgentResponse:
        media = self.videodb_tool.upload(save_at, source_type="file_path", media_type="video", name=name)
        stream_url = media.get("stream_url") or media.get("url") or ""
        video_content.video = VideoData(stream_url=stream_url, id=media.get("id"), name=name)
        video_content.status = MsgStatus.success
        video_content.status_message = f"Runway video ready ({name})."
        self.output_message.publish()
        return AgentResponse(status=AgentStatus.SUCCESS, message="ok", data={"video_id": media.get("id"), "path": save_at})

    def _handle_video(self, tool, operation, collection_id, label, prompt, duration,
                      image_id, image_url, video_id, video_url, cfg) -> AgentResponse:
        video_content = VideoContent(agent_name=self.agent_name, status=MsgStatus.progress,
                                     status_message=f"Running Runway {operation}...")
        self.output_message.content.append(video_content)
        save_at = self._video_path(operation)
        if operation == "text_to_video":
            tool.text_to_video(prompt or "", save_at, int(duration), cfg)
        elif operation == "image_to_video":
            tool.image_to_video(self._resolve_image(image_id, image_url), prompt or "", save_at, int(duration), cfg)
        elif operation == "video_to_video":
            tool.video_to_video(self._resolve_video(video_id, video_url), prompt or "", save_at, int(duration), cfg)
        elif operation == "remove_background":
            tool.remove_background(self._resolve_video(video_id, video_url), save_at, int(duration), cfg)
        return self._register_video(save_at, collection_id, label, video_content)

    def _handle_image(self, tool, collection_id, label, prompt, cfg) -> AgentResponse:
        content = ImageContent(agent_name=self.agent_name, status=MsgStatus.progress,
                               status_message="Generating Runway image...")
        self.output_message.content.append(content)
        save_at = self._image_path()
        tool.text_to_image(prompt or "", save_at, cfg)
        media = self.videodb_tool.upload(save_at, source_type="file_path", media_type="image", name=label)
        content.image = ImageData(url=media.get("url"), id=media.get("id"), name=label)
        content.status = MsgStatus.success
        content.status_message = f"Image ready ({label})."
        self.output_message.publish()
        return AgentResponse(status=AgentStatus.SUCCESS, message="ok", data={"image_id": media.get("id"), "path": save_at})

    def _handle_tts(self, tool, collection_id, label, prompt, voice, cfg) -> AgentResponse:
        if not voice:
            return AgentResponse(status=AgentStatus.ERROR, message="text_to_speech requires 'voice'")
        content = TextContent(agent_name=self.agent_name, status=MsgStatus.progress,
                              status_message="Generating voiceover...")
        self.output_message.content.append(content)
        save_at = self._audio_path("tts")
        tool.text_to_speech(prompt or "", voice, save_at, cfg)
        media = self.videodb_tool.upload(save_at, source_type="file_path", media_type="audio", name=label)
        content.text = f"Voiceover saved as audio id {media.get('id')} ({save_at})."
        content.status = MsgStatus.success
        content.status_message = f"Voiceover ready ({label})."
        self.output_message.publish()
        return AgentResponse(status=AgentStatus.SUCCESS, message="ok", data={"audio_id": media.get("id"), "path": save_at})

    def _handle_sfx(self, tool, collection_id, label, prompt, duration, cfg) -> AgentResponse:
        content = TextContent(agent_name=self.agent_name, status=MsgStatus.progress,
                              status_message="Generating sound effect...")
        self.output_message.content.append(content)
        save_at = self._audio_path("sfx")
        tool.sound_effect(prompt or "", save_at, duration_seconds=float(duration))
        media = self.videodb_tool.upload(save_at, source_type="file_path", media_type="audio", name=label)
        content.text = f"Sound effect saved as audio id {media.get('id')} ({save_at})."
        content.status = MsgStatus.success
        content.status_message = f"SFX ready ({label})."
        self.output_message.publish()
        return AgentResponse(status=AgentStatus.SUCCESS, message="ok", data={"audio_id": media.get("id"), "path": save_at})

    def _handle_dub(self, tool, collection_id, label, video_id, video_url, target_language, source_language) -> AgentResponse:
        if not target_language:
            return AgentResponse(status=AgentStatus.ERROR, message="voice_dubbing requires 'target_language'")
        # The audio source can be either a raw audio file or a video — the API accepts both.
        src = video_url or video_id
        if not src:
            return AgentResponse(status=AgentStatus.ERROR, message="voice_dubbing requires video_id or video_url")
        content = TextContent(agent_name=self.agent_name, status=MsgStatus.progress,
                              status_message="Dubbing audio...")
        self.output_message.content.append(content)
        save_at = self._audio_path("dub")
        audio_input = src if src.startswith(("http", "runway://")) else self._resolve_video(video_id, video_url)
        tool.voice_dubbing(audio_input, target_language, save_at, source_language)
        media = self.videodb_tool.upload(save_at, source_type="file_path", media_type="audio", name=label)
        content.text = f"Dub saved as audio id {media.get('id')} ({save_at})."
        content.status = MsgStatus.success
        content.status_message = f"Dub ready ({label} → {target_language})."
        self.output_message.publish()
        return AgentResponse(status=AgentStatus.SUCCESS, message="ok", data={"audio_id": media.get("id"), "path": save_at})
