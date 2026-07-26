"""
ORIONAI — Vercel serverless function
Handles POST /api/chat by calling the OpenAI API.
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
    "and chat website built by Rashmith. Answer clearly and concisely."
)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str


@app.post("/", response_model=ChatResponse)
def chat(req: ChatRequest):
    if not client:
        raise HTTPException(
            status_code=503,
            detail="OPENAI_API_KEY is not set. Add it in Vercel Settings, then redeploy.",
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
