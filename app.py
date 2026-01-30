import os
import sys
import csv
import logging
from datetime import datetime
from flask import Flask, render_template, request, jsonify
import flask
from flask_socketio import SocketIO, emit
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from threading import Lock
import firebase_admin
from firebase_admin import credentials, db, messaging

# --- Configuration ---
@dataclass
class Config:
    SECRET_KEY: str = os.environ.get('SECRET_KEY', 'a_default_secret_key_change_in_production')
    HOST: str = os.environ.get('HOST', '0.0.0.0')
    PORT: int = int(os.environ.get('PORT', '5000'))
    DEBUG: bool = os.environ.get('DEBUG', 'False').lower() == 'true'
    MAX_CALLS: int = int(os.environ.get('MAX_CALLS', '4'))
    MEDIA_FOLDER: str = os.environ.get('MEDIA_FOLDER', 'static/media')
    CORS_ORIGINS: str = os.environ.get('CORS_ORIGINS', '*')
    # New configuration for CSV logging
    LOGS_FOLDER: str = os.environ.get('LOGS_FOLDER', 'logs')
    CSV_FILENAME: str = os.environ.get('CSV_FILENAME', 'call_logs.csv')

config = Config()

# --- Logging Setup ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# --- Firebase Setup ---
try:
    cred = credentials.Certificate('serviceAccountKey.json')
    firebase_admin.initialize_app(cred, {
        'databaseURL': 'https://qms-hybrid-default-rtdb.asia-southeast1.firebasedatabase.app'
    })
    logger.info("Firebase Admin initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Firebase: {e}")

# --- Data Models ---
@dataclass
class Call:
    number: str
    counter: str
    timestamp: datetime
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'number': self.number,
            'counter': self.counter,
            'timestamp': self.timestamp.isoformat()
        }

# --- CSV Logger Class ---
class CSVLogger:
    def __init__(self, logs_folder: str, csv_filename: str):
        self.logs_folder = logs_folder
        self.csv_filename = csv_filename
        self.csv_path = os.path.join(logs_folder, csv_filename)
        self._lock = Lock()
        self._ensure_logs_directory()
        self._ensure_csv_headers()
    
    def _ensure_logs_directory(self):
        """Create logs directory if it doesn't exist."""
        try:
            if not os.path.exists(self.logs_folder):
                os.makedirs(self.logs_folder)
                logger.info(f"Created logs directory: {self.logs_folder}")
        except OSError as e:
            logger.error(f"Failed to create logs directory {self.logs_folder}: {e}")
            raise
    
    def _ensure_csv_headers(self):
        """Ensure CSV file exists with proper headers."""
        try:
            # Check if file exists and has content
            if not os.path.exists(self.csv_path) or os.path.getsize(self.csv_path) == 0:
                with open(self.csv_path, 'w', newline='', encoding='utf-8') as csvfile:
                    writer = csv.writer(csvfile)
                    writer.writerow(['timestamp', 'date', 'time', 'number', 'counter', 'day_of_week'])
                    logger.info(f"Created CSV file with headers: {self.csv_path}")
        except (OSError, IOError) as e:
            logger.error(f"Failed to create CSV file {self.csv_path}: {e}")
            raise
    
    def log_call(self, call: Call) -> bool:
        """Log a call to the CSV file. Thread-safe."""
        try:
            with self._lock:
                # Format timestamp components
                timestamp_str = call.timestamp.strftime('%Y-%m-%d %H:%M:%S')
                date_str = call.timestamp.strftime('%Y-%m-%d')
                time_str = call.timestamp.strftime('%H:%M:%S')
                day_of_week = call.timestamp.strftime('%A')
                
                # Prepare row data
                row_data = [
                    timestamp_str,
                    date_str,
                    time_str,
                    call.number,
                    call.counter,
                    day_of_week
                ]
                
                # Write to CSV
                with open(self.csv_path, 'a', newline='', encoding='utf-8') as csvfile:
                    writer = csv.writer(csvfile)
                    writer.writerow(row_data)
                
                logger.info(f"Logged call to CSV: {call.number} at {call.counter} on {timestamp_str}")
                return True
                
        except (OSError, IOError) as e:
            logger.error(f"Failed to log call to CSV: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error logging call to CSV: {e}")
            return False
    
    def get_recent_calls(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent calls from CSV file."""
        try:
            if not os.path.exists(self.csv_path):
                return []
            
            recent_calls = []
            with open(self.csv_path, 'r', newline='', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                calls = list(reader)
                
                # Return last 'limit' calls (most recent first)
                for call in reversed(calls[-limit:]):
                    recent_calls.append({
                        'number': call['number'],
                        'counter': call['counter'],
                        'timestamp': call['timestamp'],
                        'date': call['date'],
                        'time': call['time'],
                        'day_of_week': call['day_of_week']
                    })
            
            return recent_calls
            
        except (OSError, IOError) as e:
            logger.error(f"Failed to read recent calls from CSV: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error reading recent calls: {e}")
            return []
    
    def get_calls_by_date(self, target_date: str) -> List[Dict[str, Any]]:
        """Get all calls for a specific date (YYYY-MM-DD format)."""
        try:
            if not os.path.exists(self.csv_path):
                return []
            
            date_calls = []
            with open(self.csv_path, 'r', newline='', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                for call in reader:
                    if call['date'] == target_date:
                        date_calls.append({
                            'number': call['number'],
                            'counter': call['counter'],
                            'timestamp': call['timestamp'],
                            'date': call['date'],
                            'time': call['time'],
                            'day_of_week': call['day_of_week']
                        })
            
            return date_calls
            
        except (OSError, IOError) as e:
            logger.error(f"Failed to read calls by date from CSV: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error reading calls by date: {e}")
            return []

# --- Application Setup ---
app = Flask(__name__, static_url_path='/static')
app.config['SECRET_KEY'] = config.SECRET_KEY
socketio = SocketIO(app, cors_allowed_origins=config.CORS_ORIGINS)

# Initialize CSV Logger
csv_logger = CSVLogger(config.LOGS_FOLDER, config.CSV_FILENAME)

# --- Thread-Safe State Management ---
class CallManager:
    def __init__(self, max_calls: int = 4, csv_logger: CSVLogger = None):
        self.max_calls = max_calls
        self.call_history: List[Call] = []
        self.csv_logger = csv_logger
        self._lock = Lock()
    
    def add_call(self, number: str, counter: str) -> Call:
        """Thread-safe method to add a new call."""
        new_call = Call(number=number, counter=counter, timestamp=datetime.now())
        
        with self._lock:
            self.call_history.insert(0, new_call)
            self.call_history = self.call_history[:self.max_calls]
            logger.info(f"New call added: {number} at {counter}")
        
        # Log to CSV (outside the lock to avoid blocking)
        if self.csv_logger:
            success = self.csv_logger.log_call(new_call)
            if not success:
                logger.warning(f"Failed to log call to CSV: {number} at {counter}")
        
        return new_call
    
    def get_current_state(self) -> Dict[str, Any]:
        """Thread-safe method to get current state."""
        with self._lock:
            return {
                "current": self.call_history[0].to_dict() if self.call_history else {},
                "history": [call.to_dict() for call in self.call_history[1:]]
            }

call_manager = CallManager(config.MAX_CALLS, csv_logger)

# --- Media Management ---
class MediaManager:
    def __init__(self, media_folder: str):
        self.media_folder = media_folder
        self._media_files: List[str] = []
        self._last_scan = None
        self.refresh_media_files()
    
    def refresh_media_files(self) -> None:
        """Refresh the media files list."""
        try:
            if not os.path.exists(self.media_folder):
                logger.warning(f"Media folder {self.media_folder} does not exist")
                self._media_files = []
                return
                
            files = os.listdir(self.media_folder)
            self._media_files = [
                f'/static/media/{f}' for f in files 
                if f.lower().endswith(('.mp4', '.webm', '.ogg'))
            ]
            self._last_scan = datetime.now()
            logger.info(f"Found {len(self._media_files)} media files")
        except OSError as e:
            logger.error(f"Error scanning media folder: {e}")
            self._media_files = []
    
    def get_media_files(self) -> List[str]:
        """Get list of media files, refresh if needed."""
        # Refresh every 5 minutes in production
        if (self._last_scan is None or 
            (datetime.now() - self._last_scan).seconds > 300):
            self.refresh_media_files()
        return self._media_files

media_manager = MediaManager(config.MEDIA_FOLDER)

# --- Helper Functions ---
def validate_call_data(data: Dict[str, Any]) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Validate and extract call data."""
    if not data:
        return None, None, "No data provided"
    
    number = data.get("number", "").strip()
    counter = data.get("counter", "").strip()
    
    if not number:
        return None, None, "Number is required"
    if not counter:
        return None, None, "Counter is required"
    
    # Additional validation
    if len(number) > 50:
        return None, None, "Number too long"
    if len(counter) > 50:
        return None, None, "Counter name too long"
    
    return number, counter, None

def sync_to_cloud(number: str, counter: str) -> None:
    """Sync the new number and historical log to Firebase."""
    try:
        timestamp = datetime.now()
        # 1. Update the 'Live' display for the main portal view
        ref = db.reference('qms/locations/LOC_1/current')
        ref.set({
            'number': number,
            'counter': counter,
            'timestamp': timestamp.isoformat()
        })

        # 2. Update today's history log so late patients can look up their number
        date_str = timestamp.strftime('%Y-%m-%d')
        # We use the number as the key so the web app can look it up instantly
        history_ref = db.reference(f'qms/locations/LOC_1/history/{date_str}/{number}')
        history_ref.set({
            'time': timestamp.strftime('%H:%M:%S'),
            'counter': counter,
            'status': 'CALLED',
            'timestamp': timestamp.isoformat()
        })

        logger.info(f"Successfully mirrored call {number} to Firebase")
    except Exception as e:
        logger.error(f"Failed to sync to Firebase: {e}")
        
def cleanup_old_firebase_data() -> None:
    """Delete history from previous days to save space."""
    try:
        ref = db.reference('qms/locations/LOC_1/history')
        # Use shallow=True to get only keys (dates) without fetching all data
        dates = ref.get(shallow=True)
        
        if not dates:
            return

        today = datetime.now().strftime('%Y-%m-%d')
        deleted_count = 0

        for date_str in dates:
            if date_str < today:
                ref.child(date_str).delete()
                deleted_count += 1
                
        if deleted_count > 0:
            logger.info(f"Cleaned up {deleted_count} old days of history from Firebase")
            
    except Exception as e:
        logger.error(f"Error during Firebase cleanup: {e}")

def send_push_notification(number: str, counter: str) -> None:
    """Send FCM push notification to the specific device for this number."""
    try:
        # Look up the token in fcm_tokens/LOC_1/{number}
        token_ref = db.reference(f'fcm_tokens/LOC_1/{number}')
        token = token_ref.get()

        if not token:
            logger.info(f"No FCM token found for number {number}, skipping push.")
            return

        # Debugging: Log the token type and content
        logger.info(f"Fetched token data for {number}: {token} (type: {type(token)})")

        # Handle if token is a dictionary (common if stored with metadata)
        if isinstance(token, dict):
            token = token.get('token')
            if not token:
                logger.info(f"Token dictionary does not contain 'token' key for {number}.")
                return
        
        # Ensure token is a string
        if not isinstance(token, str) or not token.strip():
             logger.warning(f"Invalid token format for {number}: {token}")
             return

        # Create the message
        message = messaging.Message(
            notification=messaging.Notification(
                title='Giliran Anda!',
                body=f'Nombor {number} sila ke Kaunter {counter}',
            ),
            webpush=messaging.WebpushConfig(
                fcm_options=messaging.WebpushFCMOptions(
                    link='https://qms-hybrid.firebaseapp.com'
                ),
                notification=messaging.WebpushNotification(
                    tag='qms-notification', # This is the magic key to prevent duplicates
                    renotify=True
                )
            ),
            token=token,
        )

        # Send the message
        response = messaging.send(message)
        logger.info(f"Successfully sent push notification to {number}: {response}")

    except Exception as e:
        logger.error(f"Failed to send push notification: {e}")

def update_and_broadcast_call(number: str, counter: str) -> None:
    
    
    
    """
    Central function to handle a new call.
    Updates history, logs to CSV, and emits events to all clients.
    """
    try:
        call_manager.add_call(number, counter)
        current_state = call_manager.get_current_state()
        socketio.emit("current_state", current_state)
        
        # Sync to Cloud
        sync_to_cloud(number, counter)
        
        # Send Push Notification
        send_push_notification(number, counter)
        
        logger.info(f"Broadcasted call update: {number} at {counter}")
    except Exception as e:
        logger.error(f"Error updating and broadcasting call: {e}")
        raise

# --- SocketIO Event Handlers ---
@socketio.on("connect")
def handle_connect():
    """Send current state to newly connected clients."""
    try:
        current_state = call_manager.get_current_state()
        emit("current_state", current_state)
        logger.info("Client connected and received current state")
    except Exception as e:
        logger.error(f"Error handling client connection: {e}")

@socketio.on("disconnect")
def handle_disconnect():
    """Handle client disconnection."""
    logger.info("Client disconnected")

@socketio.on("call_number")
def handle_call_event(data):
    """Handle new call from SocketIO client."""
    try:
        number, counter, error = validate_call_data(data)
        if error:
            emit("error", {"message": error})
            return
        
        update_and_broadcast_call(number, counter)
    except Exception as e:
        logger.error(f"Error handling call event: {e}")
        emit("error", {"message": "Internal server error"})

# --- HTTP Route Handlers ---
@app.route("/")
def index():
    """Serve the staff page."""
    return render_template("staff.html")

@app.route("/display")
def display():
    """Serve the display page."""
    return render_template("display.html")

@app.route("/display2")
def display2():
    """Serve the display2 page."""
    return render_template("display-no-tv.html")    

@app.route("/dashboard")
def dashboard():
    """Serve the dashboard page."""
    return render_template("dashboard.html")

# --- Temporary Portal Hosting ---
@app.route("/portal")
def patient_portal():
    """Serve the patient portal (public/index.html)."""
    return flask.send_from_directory('public', 'index.html')

@app.route("/public/<path:filename>")
def public_files(filename):
    """Serve static files for the portal (js, sw, etc)."""
    return flask.send_from_directory('public', filename)

@app.route("/firebase-messaging-sw.js")
def service_worker():
    """Serve service worker from public root."""
    return flask.send_from_directory('public', 'firebase-messaging-sw.js')


@app.route("/health")
def health_check():
    """Health check endpoint for monitoring."""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "calls_in_history": len(call_manager.call_history),
        "csv_logging": "enabled"
    })

@app.route("/api/call_number", methods=["POST"])
def call_number_api():
    """Handle new call from HTTP POST request."""
    try:
        data = request.get_json()
        number, counter, error = validate_call_data(data)
        
        if error:
            return jsonify({
                "status": "error", 
                "message": error
            }), 400
        
        update_and_broadcast_call(number, counter)
        return jsonify({
            "status": "success", 
            "message": "Call processed and logged successfully",
            "data": {"number": number, "counter": counter}
        })
        
    except Exception as e:
        logger.error(f"Error in call_number_api: {e}")
        return jsonify({
            "status": "error", 
            "message": "Internal server error"
        }), 500

@app.route('/api/media-list')
def media_list():
    """Return list of available media files."""
    try:
        files = media_manager.get_media_files()
        return jsonify({
            "status": "success",
            "media_files": files,
            "count": len(files)
        })
    except Exception as e:
        logger.error(f"Error getting media list: {e}")
        return jsonify({
            "status": "error",
            "message": "Failed to retrieve media files"
        }), 500

@app.route('/api/current_state')
def current_state_api():
    """Get current state via HTTP (useful for debugging/monitoring)."""
    try:
        current_state = call_manager.get_current_state()
        return jsonify({
            "status": "success",
            "data": current_state
        })
    except Exception as e:
        logger.error(f"Error getting current state: {e}")
        return jsonify({
            "status": "error",
            "message": "Failed to retrieve current state"
        }), 500

@app.route('/api/restart', methods=['POST'])
def restart_server():
    """Restart the server process."""
    try:
        logger.warning("Initiating manual server restart via API...")
        
        # Function to perform restart after a brief delay to allow response to be sent
        def do_restart():
            import time
            time.sleep(1)
            logger.warning("Restarting process now...")
            # Exit with status 1 to trigger restart in the batch file loop or systemd
            os._exit(1)
            
        # Run restart in a separate thread to allow returning the response
        from threading import Thread
        Thread(target=do_restart).start()
        
        return jsonify({
            "status": "success",
            "message": "Server restarting..."
        })
    except Exception as e:
        logger.error(f"Error restarting server: {e}")
        return jsonify({
            "status": "error",
            "message": f"Failed to restart server: {str(e)}"
        }), 500

# --- CSV Logging API Endpoints ---
@app.route('/api/logs/recent')
def get_recent_logs():
    """Get recent call logs from CSV."""
    try:
        limit = min(int(request.args.get('limit', 10)), 100)  # Max 100 records
        recent_calls = csv_logger.get_recent_calls(limit)
        return jsonify({
            "status": "success",
            "data": recent_calls,
            "count": len(recent_calls)
        })
    except Exception as e:
        logger.error(f"Error getting recent logs: {e}")
        return jsonify({
            "status": "error",
            "message": "Failed to retrieve recent logs"
        }), 500

@app.route('/api/logs/date/<date>')
def get_logs_by_date(date):
    """Get call logs for a specific date (YYYY-MM-DD format)."""
    try:
        # Validate date format
        datetime.strptime(date, '%Y-%m-%d')
        
        date_calls = csv_logger.get_calls_by_date(date)
        return jsonify({
            "status": "success",
            "data": date_calls,
            "count": len(date_calls),
            "date": date
        })
    except ValueError:
        return jsonify({
            "status": "error",
            "message": "Invalid date format. Use YYYY-MM-DD"
        }), 400
    except Exception as e:
        logger.error(f"Error getting logs by date: {e}")
        return jsonify({
            "status": "error",
            "message": "Failed to retrieve logs for specified date"
        }), 500

@app.route('/api/logs/stats')
def get_logs_stats():
    """Get basic statistics about logged calls."""
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        today_calls = csv_logger.get_calls_by_date(today)
        recent_calls = csv_logger.get_recent_calls(100)
        
        # Calculate basic stats
        total_calls_today = len(today_calls)
        total_recent_calls = len(recent_calls)
        
        # Counter usage stats for today
        counter_stats = {}
        for call in today_calls:
            counter = call['counter']
            counter_stats[counter] = counter_stats.get(counter, 0) + 1
        
        return jsonify({
            "status": "success",
            "data": {
                "today": {
                    "date": today,
                    "total_calls": total_calls_today,
                    "counter_usage": counter_stats
                },
                "recent": {
                    "total_calls": total_recent_calls
                }
            }
        })
    except Exception as e:
        logger.error(f"Error getting logs stats: {e}")
        return jsonify({
            "status": "error",
            "message": "Failed to retrieve logs statistics"
        }), 500

# --- Error Handlers ---
@app.errorhandler(404)
def not_found(error):
    return jsonify({"status": "error", "message": "Not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {error}")
    return jsonify({"status": "error", "message": "Internal server error"}), 500

# --- Main Execution ---
if __name__ == "__main__":
    logger.info(f"Starting application on {config.HOST}:{config.PORT}")
    logger.info(f"Debug mode: {config.DEBUG}")
    logger.info(f"CSV logging enabled - logs will be saved to: {csv_logger.csv_path}")
    logger.info(f"Available routes:")
    logger.info(f"  Staff Interface: http://{config.HOST}:{config.PORT}/")
    logger.info(f"  Display Page: http://{config.HOST}:{config.PORT}/display")
    logger.info(f"  Dashboard: http://{config.HOST}:{config.PORT}/dashboard")
    
    # Run cleanup on startup
    cleanup_old_firebase_data()
    
    socketio.run(
        app, 
        host=config.HOST, 
        port=config.PORT, 
        debug=config.DEBUG
    )