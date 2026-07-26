"""
ORIONAI — Vercel serverless function (v4)
Handles POST /api/chat by calling the Google Gemini API.
Supports multiple Gemini API keys with automatic fallback.
Also supports optional image attachments for vision understanding.
Developed by Rashmith.
"""

import os

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# ============================================================
# GEMINI API CONFIGURATION
# ============================================================

GEMINI_API_KEYS = [
    os.getenv("GEMINI_API_KEY"),
    os.getenv("GEMINI_API_KEY_2"),
    os.getenv("GEMINI_API_KEY_3"),
    os.getenv("GEMINI_API_KEY_4"),
]

# Remove empty or missing keys
GEMINI_API_KEYS = [
    key for key in GEMINI_API_KEYS
    if key
]

GEMINI_MODEL = os.getenv(
    "GEMINI_MODEL",
    "gemini-flash-latest"
)

GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/"
    f"v1beta/models/{GEMINI_MODEL}:generateContent"
)


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(title="ORIONAI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# SYSTEM PROMPT
# ============================================================

SYSTEM_PROMPT = (
    "You are ORION, the assistant inside ORIONAI, a cosmic-themed AI app built "
    "by Rashmith. Answer clearly and concisely. If an image is attached, look "
    "at it carefully before answering."
)


# ============================================================
# DATA MODELS
# ============================================================

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    image: str | None = None
    image_mime: str | None = None


class ChatResponse(BaseModel):
    reply: str


# ============================================================
# CHAT ENDPOINT
# ============================================================

@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest):

    # --------------------------------------------------------
    # Check whether at least one API key exists
    # --------------------------------------------------------

    if not GEMINI_API_KEYS:
        raise HTTPException(
            status_code=503,
            detail=(
                "No Gemini API keys are configured. "
                "Add GEMINI_API_KEY, GEMINI_API_KEY_2, "
                "GEMINI_API_KEY_3, or GEMINI_API_KEY_4 "
                "in Vercel Settings, then redeploy."
            ),
        )


    # --------------------------------------------------------
    # Build conversation history
    # --------------------------------------------------------

    contents = []

    for turn in req.history[-12:]:

        role = (
            "model"
            if turn.role == "assistant"
            else "user"
        )

        contents.append(
            {
                "role": role,
                "parts": [
                    {
                        "text": turn.content
                    }
                ],
            }
        )


    # --------------------------------------------------------
    # Build current message
    # --------------------------------------------------------

    current_parts = []

    # Add image if provided
    if req.image and req.image_mime:

        current_parts.append(
            {
                "inline_data": {
                    "mime_type": req.image_mime,
                    "data": req.image,
                }
            }
        )

    # Add user's text
    current_parts.append(
        {
            "text": req.message
        }
    )

    contents.append(
        {
            "role": "user",
            "parts": current_parts,
        }
    )


    # --------------------------------------------------------
    # Gemini request payload
    # --------------------------------------------------------

    payload = {
        "system_instruction": {
            "parts": [
                {
                    "text": SYSTEM_PROMPT
                }
            ]
        },
        "contents": contents,
    }


    # --------------------------------------------------------
    # AUTOMATIC API KEY FALLBACK
    # --------------------------------------------------------

    last_error = None

    for key_number, api_key in enumerate(
        GEMINI_API_KEYS,
        start=1
    ):

        try:

            resp = httpx.post(
                GEMINI_URL,
                headers={
                    "x-goog-api-key": api_key,
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=45,
            )


            # ------------------------------------------------
            # SUCCESS
            # ------------------------------------------------

            if resp.status_code == 200:

                data = resp.json()

                try:

                    reply = (
                        data["candidates"][0]
                        ["content"]["parts"][0]
                        ["text"]
                    )

                except (KeyError, IndexError, TypeError):

                    raise Exception(
                        "Gemini returned an unexpected response."
                    )

                return ChatResponse(
                    reply=reply
                )


            # ------------------------------------------------
            # RATE LIMIT
            # Try the next API key
            # ------------------------------------------------

            if resp.status_code == 429:

                last_error = (
                    f"API key {key_number} "
                    "received a 429 rate-limit response."
                )

                continue


            # ------------------------------------------------
            # TEMPORARY GEMINI SERVER ERROR
            # Try the next API key
            # ------------------------------------------------

            if resp.status_code in (
                500,
                502,
                503,
                504,
            ):

                last_error = (
                    f"API key {key_number} "
                    f"received HTTP {resp.status_code}."
                )

                continue


            # ------------------------------------------------
            # OTHER API ERROR
            # ------------------------------------------------

            last_error = (
                f"API key {key_number} failed: "
                f"HTTP {resp.status_code} - "
                f"{resp.text}"
            )

            # Continue to next key
            continue


        except httpx.TimeoutException:

            last_error = (
                f"API key {key_number} "
                "timed out."
            )

            continue


        except Exception as exc:

            last_error = (
                f"API key {key_number} "
                f"failed: {exc}"
            )

            continue


    # --------------------------------------------------------
    # ALL API KEYS FAILED
    # --------------------------------------------------------

    raise HTTPException(
        status_code=502,
        detail=(
            "All configured Gemini API keys failed. "
            f"Last error: {last_error}"
        ),
    )
