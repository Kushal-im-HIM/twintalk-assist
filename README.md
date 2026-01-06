
# ♿ Real-Time Closed Captioning & Accessibility Platform

A web-based accessibility platform that provides **real-time closed captioning** optimized for **Indian accents**, built with a scalable architecture designed for future **Indian Sign Language (ISL)** integration.

This project focuses on inclusive communication by enabling low-latency speech-to-text conversion in a browser-based experience.

---

## 📑 Table of Contents

- [Overview](#overview)
- [Core Features](#core-features)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Backend Design](#backend-design)
- [Real-Time Communication](#real-time-communication)
- [Frontend Architecture](#frontend-architecture)
- [Accessibility Considerations](#accessibility-considerations)
- [Current Scope](#current-scope)
- [Future Enhancements](#future-enhancements)
- [Getting Started](#getting-started)


---

## 📘 Overview

Deaf and hard-of-hearing users often face limitations due to delayed or inaccurate speech-to-text systems, especially in regions with strong accent diversity.  
This application addresses that gap by delivering **real-time closed captions** optimized for Indian speech patterns, with a foundation that supports future multimodal accessibility features.

---

## ✨ Core Features

- Real-time speech-to-text captioning
- Accent-aware recognition for Indian speech
- Low-latency updates using WebSockets
- Lightweight browser-based interface
- Modular backend for future extensibility

---

## 🏗️ System Architecture

```

User Audio Input
↓
Speech Recognition Engine
↓
FastAPI Backend
↓
WebSocket Stream
↓
Live Caption Rendering (Frontend)

````

The architecture is modular, enabling independent upgrades to speech models, UI, or backend services.

---

## 🛠️ Tech Stack

### Frontend
- HTML5
- CSS3
- JavaScript
- Single Page Application (SPA) architecture

### Backend
- FastAPI (Python)
- REST APIs
- WebSockets for real-time data streaming

### Speech Processing
- Speech-to-Text models
- Accent-optimized recognition pipeline

---

## ⚙️ Backend Design

FastAPI is used as the backend framework due to its:
- High performance (ASGI-based)
- Native WebSocket support
- Clean API structure
- Easy scalability for AI-based integrations

REST APIs handle configuration and setup, while WebSockets manage real-time caption streaming.

---

## 🔄 Real-Time Communication

WebSockets are used to:
- Maintain persistent client-server connections
- Stream captions with minimal latency
- Avoid inefficient polling mechanisms

This ensures smooth, real-time updates critical for accessibility use cases.

---

## 🖥️ Frontend Architecture

The frontend follows a **Single Page Application (SPA)** approach:
- No full-page reloads
- Dynamic caption updates
- Reduced network overhead
- Improved user experience

The UI is intentionally minimal to prioritize clarity and readability.

---

## ♿ Accessibility Considerations

- Clear and readable caption display
- Minimal interaction complexity
- Accessibility-first UI design
- Focus on usability for assistive scenarios

Accessibility is treated as a core design requirement.

---

## 📌 Current Scope

- Real-time closed captioning
- Accent-aware speech recognition
- WebSocket-based streaming
- Scalable backend architecture

This version represents a **functional MVP**, focused on stability and extensibility.

---

## 🔮 Future Enhancements

- Indian Sign Language (ISL) gesture recognition
- Multilingual caption support
- AI-based noise suppression
- Mobile and tablet optimization
- Classroom and live-event integrations

---

## 🚀 Getting Started

### Backend
```bash
pip install -r requirements.txt
uvicorn main:app --reload
````

### Frontend

```bash
Open index.html in a modern browser
```

Ensure the backend server is running before accessing the frontend.

---


