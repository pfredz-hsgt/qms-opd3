# Performance Recommendations for QMS-OPD

**Context**: 5 days/week, 8am-5pm, ~600 patients/calls per day. This is moderate load, but real-time latency is critical for user experience.

## 1. Application Layer (Gunicorn & Flask)

-   **Eventlet for WebSockets**:
    The system uses `Flask-SocketIO`. For production, using a production-ready WSGI server like **Gunicorn** with **eventlet** or **gevent** is mandatory. Creating new threads for every client in a sync worker setup will crash under load.
    *Status*: Included in `requirements.txt` and `gunicorn_config.py`.

-   **Worker Count**:
    For async workers (`eventlet`), you don't need many workers. 1 worker can handle thousands of concurrent WebSocket connections.
    *Recommendation*: Start with **1 worker**. Increase to 2-3 only if CPU usage on that single core gets high (Python GIL limitation).

-   **Keep-Alive & Timeouts**:
    WebSockets rely on persistent connections. Ensure Nginx/Apache timeouts are high enough (set to `600s` in provided configs) to prevent dropping connections during idle times.

## 2. Infrastructure & System

-   **Static Files**:
    Serve static assets (JS, CSS, Images, Videos) via **Nginx/Apache** directly, NOT via Flask.
    *Why*: Flask is slow at serving files. Dedicated web servers are optimized for this.
    *Status*: Configured in provided `nginx_qms.conf` and `apache_qms.conf` (`location /static`).

-   **Database / Logging (CSV)**:
    The current app writes to `call_logs.csv` for every call.
    *Risk*: File I/O locking. If multiple workers try to write simultaneously, it might block or corrupt (though `Lock()` is used in code).
    *Optimization*: For 600 calls/day, CSV is fine. If load increases 10x, switch to **SQLite** (WAL mode) or **PostgreSQL**.
    *Immediate Action*: Ensure the disk is SSD for fast write operations.

## 3. Browser / Client Side

-   **Video Playback**:
    The display page plays video (`video-player.js`). Heavy video files can lag the browser, especially on low-end hardware (TV sticks, Raspberry Pi).
    *Recommendation*: Re-encode videos to 720p/1080p MP4 (H.264) with optimized keyframes for web. Avoid raw or huge user-uploaded files.

-   **Memory Leak Prevention**:
    The dashboard or display page might run for 9 hours straight. Ensure JavaScript cleans up listeners or DOM elements if dynamic content is heavy. A daily auto-refresh (e.g., via a meta refresh tag or JS timer at 2 AM) can clear any accumulated memory bloat.

## 4. Monitoring

-   **Log Rotation**:
    The `call_logs.csv` will grow indefinitely.
    *Action*: Implement `logrotate` for the CSV file or archive it monthly to prevent disk full issues tailored to the `logs` folder.
