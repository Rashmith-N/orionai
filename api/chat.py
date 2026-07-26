"""
ORIONAI — Vercel serverless function (v3)
Handles POST /api/chat by calling the Google Gemini API (free tier).
Now supports an optional image attachment for vision understanding.
Developed by Rashmith.
"""

import os

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

app = FastAPI(title="ORIONAI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SYSTEM_PROMPT = (
    "You are ORION, the assistant inside ORIONAI, a cosmic-themed AI app built "
    "by Rashmith. Answer clearly and concisely. If an image is attached, look "
    "at it carefully before answering."
)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    image: str | None = None       # base64-encoded image data, no data: prefix
    image_mime: str | None = None  # e.g. "image/png", "image/jpeg"


class ChatResponse(BaseModel):
    reply: str


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is not set. Add it in Vercel Settings, then redeploy.",
        )

    contents = []
    for turn in req.history[-12:]:
        role = "model" if turn.role == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": turn.content}]})

    current_parts = []
    if req.image and req.image_mime:
        current_parts.append({
            "inline_data": {"mime_type": req.image_mime, "data": req.image}
        })
    current_parts.append({"text": req.message})
    contents.append({"role": "user", "parts": current_parts})

    payload = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": contents,
    }

    try:
        resp = httpx.post(
            GEMINI_URL,
            headers={"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"},
            json=payload,
            timeout=45,
        )
        resp.raise_for_status()
        data = resp.json()
        reply = data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemini request failed: {exc}") from exc

    return ChatResponse(reply=reply)
