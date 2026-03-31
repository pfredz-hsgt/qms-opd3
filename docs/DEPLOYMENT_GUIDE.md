# QMS-OPD Deployment Guide (Ubuntu)

This guide walks you through deploying the QMS-OPD application on an Ubuntu 20.04/22.04 LTS server.

## Prerequisites
- Ubuntu Server (20.04 or 22.04 recommended)
- `root` or `sudo` access
- Python 3.8+ installed

## 1. System Preparation

Update your system packages:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install python3-pip python3-venv git nginx -y
```

## 2. Application Setup

1.  **Clone/Copy the repository** to `/opt/qms-opd`.
    ```bash
    sudo mkdir -p /opt/qms-opd
    # Assuming you upload the files to this directory
    # Ensure your user owns this directory for now
    sudo chown -R $USER:$USER /opt/qms-opd
    cd /opt/qms-opd
    ```

2.  **Create a Virtual Environment**:
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```

3.  **Install Dependencies**:
    ```bash
    pip install -r linux_deploy/requirements.txt
    ```

## 3. Configure Gunicorn (Application Server)

Review `linux_deploy/gunicorn_config.py`. It is configured to run on `127.0.0.1:8000` with `eventlet` workers for WebSocket support.

Test the application manualy first:
```bash
./venv/bin/gunicorn --config linux_deploy/gunicorn_config.py app:app
```
(Press Ctrl+C to stop)

## 4. Systemd Service

We use Systemd to keep the application running in the background and restart it on failure.

1.  **Edit the service file** if necessary:
    Check `linux_deploy/qms.service`.
    - Ensure `User` and `Group` match your deployment user (e.g., `ubuntu` or `www-data`).
    - Verify paths (`/opt/qms-opd`).

2.  **Install the service**:
    ```bash
    sudo cp linux_deploy/qms.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable qms
    sudo systemctl start qms
    ```

3.  **Check status**:
    ```bash
    sudo systemctl status qms
    ```

## 5. Web Server Configuration

Choose **ONE** of the following options: Nginx (Recommended) OR Apache.

### Option A: Nginx (Recommended)

1.  **Install configuration**:
    ```bash
    sudo cp linux_deploy/nginx_qms.conf /etc/nginx/sites-available/qms
    sudo ln -s /etc/nginx/sites-available/qms /etc/nginx/sites-enabled/
    ```

2.  **Remove default site (optional)**:
    ```bash
    sudo rm /etc/nginx/sites-enabled/default
    ```

3.  **Test and Restart**:
    ```bash
    sudo nginx -t
    sudo systemctl restart nginx
    ```

### Option B: Apache

1.  **Install Apache and modules**:
    ```bash
    sudo apt install apache2 -y
    sudo a2enmod proxy proxy_http proxy_wstunnel rewrite
    ```

2.  **Install configuration**:
    ```bash
    sudo cp linux_deploy/apache_qms.conf /etc/apache2/sites-available/qms.conf
    sudo a2dissite 000-default.conf
    sudo a2ensite qms.conf
    ```

3.  **Test and Restart**:
    ```bash
    sudo apache2ctl configtest
    sudo systemctl restart apache2
    ```

## 6. Verification

Visit `http://<your-server-ip>` in your browser.
-   **Staff View**: Home page
-   **Display**: `/display`

Check logs if issues arise:
-   App logs: `journalctl -u qms -f`
-   Nginx logs: `/var/log/nginx/error.log`
-   Apache logs: `/var/log/apache2/error.log`

## 7. Operational Features

### Server Restart Button
The Staff Panel includes a **"Reset / Restart Server"** button. 
-   **How it works**: It forces the application process to exit.
-   **Windows**: The `1.Start-Server.bat` script loop detects the exit and restarts the app.
-   **Ubuntu (Production)**: The `qms.service` is configured with `Restart=always`. Systemd detects the exit and automatically restarts the service after 5 seconds.

