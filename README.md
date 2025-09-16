# Real-Time-Fraud-Detection-Using-Sensor-Data-and-Machine-Learning-for-Secure-Transactions
# Real-Time Fraud Detection Using Sensor Data & Machine Learning

![Python](https://img.shields.io/badge/Python-3.9-blue?style=for-the-badge&logo=python)  
![IoT](https://img.shields.io/badge/IoT-Sensors-orange?style=for-the-badge&logo=arduino)  
![Machine Learning](https://img.shields.io/badge/AI-Machine%20Learning-green?style=for-the-badge&logo=tensorflow)  
![License](https://img.shields.io/badge/license-MIT-black?style=for-the-badge)  

## Overview
Fuel dispensing fraud causes huge financial losses to both consumers and retailers.  
This project presents a multi-modal fraud detection framework that combines:

- Sensor Monitoring (flow, proximity, nozzle activity)  
- Computer Vision (nozzle verification with YOLOv11n)  
- Natural Language Processing (customer complaint sentiment analysis)  

The system uses real-time data and machine learning models to detect fraudulent transactions such as under-dispensing and unauthorized manipulation — with 98.6% accuracy and minimal false positives.  

---

## Features
- IoT Sensors – Flow rate, nozzle presence, and visual verification  
- Machine Learning – YOLOv11n for image detection, RoBERTa-based NLP for complaints  
- Multi-Modal Fusion – Combines sensor + vision + NLP for robust fraud detection  
- Web Dashboard – Real-time monitoring, anomaly alerts, and evidence logging  
- Automated Fraud Alerts – Flags suspicious events and notifies operators  

---

## System Architecture
- **Hardware:** ESP32, YF-S201 Hall-Effect Flow Sensor, IR Proximity Sensor, ESP32-CAM  
- **Software Stack:**  
  - Arduino IDE (embedded programming)  
  - Flask (backend server)  
  - Node.js (middleware/API)  
  - SQLite (database)  
  - HTML/CSS/JavaScript + Google Maps API (dashboard)  
- **ML Models:**  
  - YOLOv11n (nozzle detection)  
  - Grok LLaMA3-8B (NLP topic extraction)  
  - RoBERTa (sentiment classification)  

---

## Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/your-username/fuel-fraud-detection.git
cd fuel-fraud-detection
pip install -r requirements.txt
3. Setup Hardware

Connect ESP32 with sensors (Flow, Proximity, Camera)

Flash microcontroller with Arduino IDE

4. Run Backend
python app.py

5. Start Dashboard
npm install
npm start
