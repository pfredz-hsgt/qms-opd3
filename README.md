# QMS-OPD (Queue Management System)

A robust, real-time Queue Management System designed for Outpatient Departments (OPD), built with Python (Flask) and Socket.IO. 

This system provides a seamless experience for managing patient queues with a modern staff interface, dynamic public displays, and comprehensive calling features.

## ✨ Key Features

*   **Real-Time Sync**: Instant updates across all connected devices using WebSockets.
*   **Modern Staff Interface**: 
    *   Responsive design for desktop and mobile.
    *   **Virtual Keypad** with touch support.
    *   **Keyboard Shortcuts** for power users.
    *   **QR Code** for instant mobile connection.
*   **Dynamic Public Display**:
    *   Multimedia support (plays cycling videos/health information).
    *   Clear, high-contrast visual announcements.
    *   Audio chimes/announcements (browser-based TTS).
*   **Operations Dashboard**: View daily statistics and recent call history.
*   **Robust Logging**: All calls are logged to CSV for audit trails and analysis.
*   **Resiliency**: Auto-reconnect capabilities and built-in server restart tools.

## 🚀 Quick Start (Windows)

The simplest way to run the system on Windows is using the included batch scripts:

1.  **Start the Server**: Double-click `1.Start-Server.bat`.
    *   This launches the backend server. Keep this window open.
2.  **Open Launchers** (Optional):
    *   `2.LaunchDisplay.bat`: Opens the public display interface.
    *   `3.LaunchPanel.bat`: Opens the staff control panel.

## 🛠️ Operational Guide

### 1. Staff Panel (`/`)
Accessed via `http://<ip-address>:5000/`.
*   **Calling a Number**: Enter the ticket number using the on-screen keypad or your keyboard, select a counter, and click "Panggil Sekarang" (Call Now).
*   **Keyboard Shortcuts**:
    *   `0-9`: Type number.
    *   `Enter`: Submit call.
    *   `Backspace`: Clear last digit.
    *   `+` then `1-5`: **Quick Change Counter**. Press `+` to enter shortcut mode (label turns orange), then press a number (`1`-`5`) to instantly switch the selected counter.

### 2. Public Display (`/display`)
Accessed via `http://<ip-address>:5000/display`.
*   Designed for large TV screens in the waiting area.
*   Shows the current number being called and the specific counter.
*   Plays educational/promotional videos from the `static/media` folder when idle.
*   **Audio**: Click anywhere on the page to enable audio announcements.

### 3. Alternative Display (`/display2`)
Accessed via `http://<ip-address>:5000/display2`.
*   A "No-TV" version optimized for smaller screens or environments where video playback is not needed.
*   Focuses purely on the queue numbers.

### 4. Dashboard (`/dashboard`)
Accessed via `http://<ip-address>:5000/dashboard`.
*   View real-time statistics including:
    *   Total calls today.
    *   Calls per counter.
    *   Recent history log.

## 💻 Manual Installation (Developer)

If you wish to run from source or modify the code:

**Prerequisites**: Python 3.8+

1.  **Install Dependencies**:
    ```bash
    pip install flask flask-socketio eventlet
    ```
    *(Note: See `linux_deploy/requirements.txt` for a full list)*

2.  **Run the Application**:
    ```bash
    python app.py
    ```

## ⚙️ Configuration

The application can be configured via environment variables. See `app.py` for defaults.

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | Port to run the server on. |
| `MAX_CALLS` | `4` | Number of recent calls to keep in memory/display. |
| `MEDIA_FOLDER` | `static/media` | Directory for display videos. |
| `LOGS_FOLDER` | `logs` | Directory for CSV logs. |

## 📦 Deployment

For deploying to a production Linux (Ubuntu) server using Nginx and Gunicorn:

👉 **See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** for detailed instructions.
