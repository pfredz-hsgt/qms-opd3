import multiprocessing

# Bind to 0.0.0.0 to allow external access (behind proxy)
bind = "127.0.0.1:8000"

# Worker Options
# Using 'eventlet' is critical for Flask-SocketIO performance
worker_class = "eventlet"

# Number of workers
# For IO-bound apps, (2 * CPU) + 1 is a common formula.
# However, with eventlet (async), 1 worker can handle many connections.
# We'll use a conservative default.
workers = 1

# Threads per worker (not applicable for eventlet workers usually, but good to have compliant config)
threads = 1

# Timeout
timeout = 120

# Logging
accesslog = "-"  # stdout
errorlog = "-"   # stderr
loglevel = "info"

# Process Name
proc_name = "qms_opd"
