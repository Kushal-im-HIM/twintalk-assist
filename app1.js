const statusEl = document.getElementById("status");
const captionBox = document.getElementById("caption-box");
const btn = document.getElementById("connectBtn");
const modeSelect = document.getElementById("mode");
const historyBtn = document.getElementById("historyBtn");
const historyPanel = document.getElementById("historyPanel");
const historyList = document.getElementById("historyList");
const timerEl = document.getElementById("timer");

// Video Elements
const video = document.getElementById("video");
const startVideoBtn = document.getElementById("startVideo");
const signOutput = document.getElementById("signOutput");

// State
let socket;
let landmarkSocket;
let audioContext;
let processor;
let socketReady = false;
let hands;

// NEW Session State
let videoStream = null;
let camera = null;
let startTime = null;
let timerInterval = null;

// PHASE 2 & 3 State
let signSentence = [];
let lastSignTime = 0;
const SIGN_COOLDOWN_MS = 800;

// LOCAL BACKEND
const BASE_URL = "127.0.0.1:8000";

// ------------------------
// SPEECH LAB HELPERS (NEW)
// ------------------------
function clearCaptions() {
    captionBox.innerHTML = '<div style="opacity:0.5;">Waiting for captions...</div>';
}

function downloadTranscript() {
    const text = captionBox.innerText;
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `TwinTalk_Transcript_${new Date().getTime()}.txt`;
    a.click();
}

function updateTimer() {
    if (!socketReady) return;
    const sec = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    timerEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ------------------------
// MEDIAPIPE HANDS
// ------------------------
function initHands() {
    hands = new Hands({
        locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
    });

    hands.onResults(onHandResults);
}

function onHandResults(results) {
    if (results.multiHandLandmarks?.length) {
        const landmarks = results.multiHandLandmarks[0].map(p => [
            p.x, p.y, p.z
        ]);

        if (landmarkSocket?.readyState === WebSocket.OPEN) {
            landmarkSocket.send(JSON.stringify({ landmarks }));
        }
    }
}

// ------------------------
// AUDIO (UPDATED ONMESSAGE & STATUS)
// ------------------------
btn.onclick = async () => {
    if (socket?.readyState === WebSocket.OPEN) return;

    socket = new WebSocket(`ws://${BASE_URL}/ws/audio`);
    socket.binaryType = "arraybuffer";

    socket.onopen = async () => {
        socketReady = true;
        statusEl.textContent = "● Listening";
        statusEl.className = "mic-live"; // Add pulse class
        
        startTime = Date.now();
        timerInterval = setInterval(updateTimer, 1000);

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new AudioContext({ sampleRate: 16000 });

        const source = audioContext.createMediaStreamSource(stream);
        processor = audioContext.createScriptProcessor(4096, 1, 1);

        source.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (e) => {
            if (!socketReady || socket.readyState !== WebSocket.OPEN) return;

            const input = e.inputBuffer.getChannelData(0);
            const buffer = new Int16Array(input.length);

            for (let i = 0; i < input.length; i++) {
                buffer[i] = Math.max(-1, Math.min(1, input[i])) * 32767;
            }

            socket.send(buffer.buffer);
        };
    };

    socket.onmessage = (event) => {
        if (event.data?.trim()) {
            // Check if it's the first caption to clear "Waiting..."
            if(captionBox.innerText.includes("Waiting for captions")) captionBox.innerHTML = "";
            
            // Append as new line
            const p = document.createElement("div");
            p.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
            p.style.paddingBottom = "5px";
            p.textContent = event.data;
            captionBox.appendChild(p);
            
            // Auto-scroll to bottom
            captionBox.scrollTop = captionBox.scrollHeight;
        }
    };

    socket.onclose = () => {
        socketReady = false;
        statusEl.textContent = "○ Disconnected";
        statusEl.className = "";
        clearInterval(timerInterval);
    };
};

// ------------------------
// VIDEO + LANDMARKS (UNCHANGED)
// ------------------------
startVideoBtn.onclick = async () => {
    videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = videoStream;

    landmarkSocket = new WebSocket(`ws://${BASE_URL}/ws/landmarks`);

    landmarkSocket.onmessage = (event) => {
        const sign = event.data.trim();
        const now = Date.now();

        if (now - lastSignTime < SIGN_COOLDOWN_MS) return;

        if (signSentence.length === 0 || signSentence[signSentence.length - 1] !== sign) {
            signSentence.push(sign);
            lastSignTime = now;
            renderSignSentence();
        }
    };

    initHands();

    camera = new Camera(video, {
        onFrame: async () => {
            await hands.send({ image: video });
        },
        width: 320,
        height: 240,
    });

    camera.start();
};

// ------------------------
// SENTENCE CONTROLS (UNCHANGED)
// ------------------------
function renderSignSentence() {
    signOutput.textContent =
        signSentence.length > 0 ? signSentence.join(" ") : "Waiting for signs…";
}

document.getElementById("clearSign").onclick = () => {
    signSentence = [];
    renderSignSentence();
};

document.getElementById("deleteLastSign").onclick = () => {
    signSentence.pop();
    renderSignSentence();
};

document.getElementById("speakSign").onclick = () => {
    if (signSentence.length === 0) return;

    const utterance = new SpeechSynthesisUtterance(signSentence.join(" "));
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
};

// ------------------------
// AI ENHANCEMENT (UNCHANGED)
// ------------------------
document.getElementById("enhanceSign").onclick = async () => {
    if (signSentence.length === 0) return;

    signOutput.textContent = "Enhancing…";

    try {
        const res = await fetch(`http://${BASE_URL}/enhance`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: signSentence.join(" ") })
        });

        const data = await res.json();
        if (data.enhanced) {
            signOutput.textContent = data.enhanced;
        }
    } catch {
        renderSignSentence();
    }
};

// ------------------------
// HISTORY (UNCHANGED)
// ------------------------
historyBtn.onclick = async () => {
    historyPanel.style.display = "block";
    historyList.innerHTML = "<li>Loading...</li>";

    try {
        const res = await fetch(`http://${BASE_URL}/history`);
        const data = await res.json();
        historyList.innerHTML = "";

        data.captions.forEach(line => {
            const li = document.createElement("li");
            li.textContent = line;
            historyList.appendChild(li);
        });
    } catch {
        historyList.innerHTML = "<li>Error loading history</li>";
    }
};

// ------------------------
// SAFE STOP HELPERS (UNCHANGED)
// ------------------------
function stopSpeechLab() {
    if (socket && socket.readyState === WebSocket.OPEN) socket.close();
    socket = null;

    if (processor) processor.disconnect();
    processor = null;

    if (audioContext) audioContext.close();
    audioContext = null;

    socketReady = false;
    statusEl.textContent = "○ Stopped";
    statusEl.className = "";
    clearInterval(timerInterval);
}

function stopSignLab() {
    if (camera) camera.stop();
    camera = null;

    if (videoStream) {
        videoStream.getTracks().forEach(t => t.stop());
        videoStream = null;
    }

    if (landmarkSocket && landmarkSocket.readyState === WebSocket.OPEN) {
        landmarkSocket.close();
    }
    landmarkSocket = null;

    video.srcObject = null;
    signSentence = [];
    renderSignSentence();
}

// ------------------------
// SPA MODULE SWITCHING (SAFE)
// ------------------------
function switchModule(name) {
    stopSpeechLab();
    stopSignLab();

    document.getElementById("speechModule").classList.remove("active");
    document.getElementById("signModule").classList.remove("active");

    document.querySelectorAll(".nav-btn").forEach(b =>
        b.classList.remove("active")
    );

    if (name === "speech") {
        document.getElementById("speechModule").classList.add("active");
        document.querySelectorAll(".nav-btn")[0].classList.add("active");
    }

    if (name === "sign") {
        document.getElementById("signModule").classList.add("active");
        document.querySelectorAll(".nav-btn")[1].classList.add("active");
    }
}