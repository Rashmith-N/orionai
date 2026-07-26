"""
ORIONAI — Vercel serverless function
Handles POST /api/chat by calling the OpenAI API.
The API key is read from the OPENAI_API_KEY environment variable,
which you set in the Vercel project's Settings → Environment Variables.

Developed by Rashmith.
"""

import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

app = FastAPI(title="ORIONAI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

SYSTEM_PROMPT = (
    "You are ORION, the assistant inside ORIONAI, a cosmic-themed AI search "
    "and chat website built by Rashmith. Answer clearly and concisely. "
    "When useful, structure answers with short paragraphs or lists."
)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "ORIONAI", "developer": "Rashmith", "key_configured": bool(OPENAI_API_KEY)}


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    if not client:
        raise HTTPException(
            status_code=503,
            detail="OPENAI_API_KEY is not set. Add it in Vercel → Project → Settings → Environment Variables, then redeploy.",
        )

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for turn in req.history[-12:]:
        messages.append({"role": turn.role, "content": turn.content})
    messages.append({"role": "user", "content": req.message})

    try:
        completion = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=800,
        )
        reply = completion.choices[0].message.content
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI request failed: {exc}") from exc

    return ChatResponse(reply=reply)
