import os
import time
import math
import torch
import whisper
import numpy as np
import asyncio
from collections import deque, Counter
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from pydantic import BaseModel

# ------------------------
# CONFIG & BUFFER
# ------------------------
CAPTION_HISTORY_LIMIT = 50
caption_history = deque(maxlen=CAPTION_HISTORY_LIMIT)
sign_buffer = deque(maxlen=10) 

# ------------------------
# GROQ CONFIG
# ------------------------
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

class EnhanceRequest(BaseModel):
    text: str

app = FastAPI(title="TwinTalk Backend - Optimized Speech")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------
# STATIC SIGN LOGIC (UNCHANGED)
# ------------------------
def dist2d(a, b):
    return math.sqrt((a[0] - b[0])**2 + (a[1] - b[1])**2)

def classify_static_sign(lm):
    if not lm or len(lm) < 21:
        return "UNKNOWN"

    WRIST = 0
    THUMB_TIP, THUMB_IP = 4, 3
    INDEX_TIP, INDEX_MCP = 8, 5
    MIDDLE_TIP, MIDDLE_MCP = 12, 9
    RING_TIP, RING_MCP = 16, 13
    PINKY_TIP, PINKY_MCP = 20, 17

    hand_scale = dist2d(lm[WRIST], lm[MIDDLE_MCP])
    if hand_scale == 0: return "UNKNOWN"

    def is_up(tip_idx, mcp_idx):
        return lm[tip_idx][1] < lm[mcp_idx][1] - (hand_scale * 0.2)

    f_up = {"index": is_up(INDEX_TIP, INDEX_MCP), "middle": is_up(MIDDLE_TIP, MIDDLE_MCP), 
            "ring": is_up(RING_TIP, RING_MCP), "pinky": is_up(PINKY_TIP, PINKY_MCP)}
    
    up_count = sum(f_up.values())
    thumb_index_dist = dist2d(lm[THUMB_TIP], lm[INDEX_TIP]) / hand_scale
    index_middle_dist = dist2d(lm[INDEX_TIP], lm[MIDDLE_TIP]) / hand_scale
    middle_ring_dist = dist2d(lm[MIDDLE_TIP], lm[RING_TIP]) / hand_scale

    if up_count == 4 and (index_middle_dist > 0.4 and middle_ring_dist > 0.4): return "STOP"
    if up_count == 4 and (index_middle_dist < 0.2 and middle_ring_dist < 0.2): return "PLEASE"
    if f_up["index"] and f_up["middle"] and f_up["pinky"] and not f_up["ring"]: return "HELLO"
    thumb_tucked = dist2d(lm[THUMB_TIP], lm[PINKY_MCP]) < hand_scale * 0.8
    if up_count == 4 and thumb_tucked: return "THANK YOU"
    if thumb_index_dist < 0.25 and f_up["middle"] and f_up["ring"]: return "OK"
    if thumb_index_dist < 0.2 and index_middle_dist < 0.2 and up_count < 2: return "FOOD"
    if up_count == 1 and f_up["index"]: return "WATER"
    if up_count == 0: return "YES"
    if up_count == 2 and f_up["index"] and f_up["middle"]: return "NO"
    if up_count == 1 and f_up["pinky"]: return "ME"
    if up_count == 1 and f_up["index"] and thumb_index_dist > 0.6: return "YOU"
    thumb_out = thumb_index_dist > 0.6
    if f_up["index"] and f_up["pinky"] and not f_up["middle"] and thumb_out: return "LOVE"
    thumb_up = lm[THUMB_TIP][1] < lm[THUMB_IP][1] - (hand_scale * 0.1)
    if up_count == 0 and thumb_up: return "HELP"
    if 0.4 < thumb_index_dist < 0.8 and up_count >= 2: return "GOOD MORNING"
    return "UNKNOWN"

# ------------------------
# WHISPER SETUP (UPGRADED TO BASE)
# ------------------------
print("Checking for GPU...")
device = "cuda" if torch.cuda.is_available() else "cpu"
# Upgraded from 'tiny' to 'base' for better multilingual support
model = whisper.load_model("base", device=device)
print(f"Whisper 'base' loaded on {device}")

# ------------------------
# ENDPOINTS
# ------------------------
@app.get("/")
def root():
    return {"status": "TwinTalk Backend Active", "device": device}

@app.get("/history")
def get_history():
    return {"captions": list(caption_history)}

@app.post("/enhance")
async def enhance_text(req: EnhanceRequest):
    prompt = f"Rewrite this sign language keyword sequence into one clear English sentence: {req.text}\nOutput only the sentence:"
    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=60,
        )
        return {"enhanced": completion.choices[0].message.content.strip()}
    except Exception:
        return {"enhanced": req.text}

# ------------------------
# AUDIO WEBSOCKET (UPGRADED WITH LANGUAGE ROUTING)
# ------------------------
@app.websocket("/ws/audio")
async def audio_ws(ws: WebSocket):
    await ws.accept()
    buffer = []
    last_time = time.time()
    
    # NEW: Default to auto-detect, but will be updated by client
    target_lang = None

    try:
        while True:
            msg = await ws.receive()
            
            # Check if frontend is sending a configuration message (JSON)
            if "text" in msg:
                mode = msg["text"].lower()
                if "hinglish" in mode: target_lang = "hi"  # Hindi
                elif "tinglish" in mode: target_lang = "te" # Telugu
                elif "english" in mode: target_lang = "en" # English
                else: target_lang = None # Auto
                continue

            if "bytes" not in msg: continue
            chunk = np.frombuffer(msg["bytes"], dtype=np.int16).astype(np.float32) / 32767
            buffer.append(chunk)

            if time.time() - last_time > 3:
                last_time = time.time()
                audio = np.concatenate(buffer)
                buffer.clear()
                if len(audio) < 16000: continue
                
                # Use target_lang to force Whisper to listen for specific languages
                result = await asyncio.to_thread(
                    model.transcribe, 
                    audio, 
                    language=target_lang, 
                    fp16=(device=="cuda")
                )
                
                text = result.get("text", "").strip()
                if text:
                    caption_history.append(text)
                    await ws.send_text(text)
    except Exception: pass

# ------------------------
# LANDMARK WEBSOCKET (UNCHANGED)
# ------------------------
@app.websocket("/ws/landmarks")
async def landmarks_ws(ws: WebSocket):
    await ws.accept()
    print("✋ Landmark stream connected (Signature Mode)")
    last_dispatched = None
    try:
        while True:
            data = await ws.receive_json()
            landmarks = data.get("landmarks")
            raw_label = classify_static_sign(landmarks)
            sign_buffer.append(raw_label)
            counts = Counter(sign_buffer)
            most_common, frequency = counts.most_common(1)[0]
            if frequency >= 7 and most_common != "UNKNOWN" and most_common != last_dispatched:
                last_dispatched = most_common
                await ws.send_text(most_common)
            if most_common == "UNKNOWN":
                last_dispatched = None
    except Exception as e:
        print(f"WS closed: {e}")