    // --- Global State ---
    let lastCalledNumber = null;
    let isPlayingAudio = false;
    let audioEnabled = false;
    let hasUserInteracted = false;
    const audioQueue = [];
    let socket = null;
    let isKioskMode = false;

    // --- Audio Files ---
    const audioFiles = { 
        "bell": new Audio("/static/audio/doorbell.mp3"), 
        "0": new Audio("/static/audio/0.mp3"), 
        "1": new Audio("/static/audio/1.mp3"), 
        "2": new Audio("/static/audio/2.mp3"), 
        "3": new Audio("/static/audio/3.mp3"), 
        "4": new Audio("/static/audio/4.mp3"), 
        "5": new Audio("/static/audio/5.mp3"), 
        "6": new Audio("/static/audio/6.mp3"), 
        "7": new Audio("/static/audio/7.mp3"), 
        "8": new Audio("/static/audio/8.mp3"), 
        "9": new Audio("/static/audio/9.mp3"), 
        "counter1": new Audio("/static/audio/counter1.mp3"), 
        "counter2": new Audio("/static/audio/counter2.mp3"), 
        "counter3": new Audio("/static/audio/counter3.mp3"), 
        "counter4": new Audio("/static/audio/counter4.mp3"), 
        "counter5": new Audio("/static/audio/counter5.mp3") 
    };

    // --- DOM Elements ---
    const startScreen = document.getElementById("start-screen");
    const startButton = document.getElementById("start-button");
    const videoPlayer = document.getElementById("videoPlayer");
    const currentNumberEl = document.getElementById("current-number");
    const currentCounterEl = document.getElementById("current-counter");
    const connectionStatusEl = document.getElementById("connection-status");
    const audioStatusEl = document.getElementById("audio-status");
    const silentNotificationEl = document.getElementById("silent-notification");
    const countdownEl = document.getElementById("countdown");
    const kioskIndicatorEl = document.getElementById("kiosk-indicator");
    const kioskAudioOverlayEl = document.getElementById("kiosk-audio-overlay");
    let kioskAudioActivated = false;

    // --- 1. Improved Kiosk Detection ---
    function detectKioskMode() {
        // Check URL parameters first
        const urlParams = new URLSearchParams(window.location.search);
        const kioskParam = urlParams.get('kiosk') || urlParams.get('kioskmode');
        
        if (kioskParam === 'true' || kioskParam === '1') {
            console.log('🖥️ Kiosk mode enabled via URL parameter');
            return true;
        }
        
        // Check hash parameters as well
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const kioskHash = hashParams.get('kiosk') || hashParams.get('kioskmode');
        
        if (kioskHash === 'true' || kioskHash === '1') {
            console.log('🖥️ Kiosk mode enabled via hash parameter');
            return true;
        }
        
        // More conservative hardware detection - only for true kiosk indicators
        const isRealKiosk = (
            // Chrome kiosk mode specific indicators
            (window.chrome && window.chrome.app && window.chrome.app.isInstalled) ||
            // Fullscreen API active
            (document.fullscreenElement !== null) ||
            // Very specific screen size matches (common kiosk resolutions)
            (window.screen.width === window.outerWidth && 
             window.screen.height === window.outerHeight &&
             window.outerWidth >= 1920) || // Only large displays
            // Electron app detection
            (typeof window !== 'undefined' && window.process && window.process.type) ||
            // CEF/embedded browser detection
            (navigator.userAgent.includes('CefSharp') || 
             navigator.userAgent.includes('Embedded') ||
             navigator.userAgent.includes('Kiosk'))
        );
        
        if (isRealKiosk) {
            console.log('🖥️ True kiosk mode detected via hardware/software indicators');
            return true;
        }
        
        console.log('🖥️ Regular browser mode detected');
        return false;
    }

    // --- 2. Autoplay Policy Detection ---
    function detectAutoplayPolicy() {
        // Check if autoplay is likely allowed
        const isAutoplayAllowed = 
            navigator.getAutoplayPolicy && navigator.getAutoplayPolicy('mediaelement') === 'allowed' ||
            window.location.protocol === 'file:' || // Local files
            window.location.hostname === 'localhost' || // Localhost
            window.location.hostname.startsWith('127.') || // Local IP
            window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/); // Direct IP access
            
        console.log('🔊 Autoplay policy detection:', isAutoplayAllowed);
        return isAutoplayAllowed;
    }

    // --- Helper Functions ---
    function updateConnectionStatus(status, message) {
        connectionStatusEl.className = `connection-status status-${status}`;
        connectionStatusEl.textContent = message;
    }

    function updateAudioStatus(status, message) {
        audioStatusEl.className = `audio-status audio-${status}`;
        audioStatusEl.textContent = message;
    }

    function showSilentNotification() {
        silentNotificationEl.style.display = 'block';
        silentNotificationEl.classList.add('flash-notification');
        
        setTimeout(() => {
            silentNotificationEl.style.display = 'none';
            silentNotificationEl.classList.remove('flash-notification');
        }, 3000);
    }

    function updateKioskIndicator(isKiosk) {
        if (isKiosk) {
            kioskIndicatorEl.classList.add('active');
        } else {
            kioskIndicatorEl.classList.remove('active');
        }
    }
    
    function showKioskAudioOverlay() {
    if (isKioskMode && !audioEnabled && !kioskAudioActivated) {
        kioskAudioOverlayEl.classList.add('active');
        console.log('🖥️ Showing kiosk audio activation overlay');
        }
    }

    function hideKioskAudioOverlay() {
        kioskAudioOverlayEl.classList.remove('active');
    }

    // --- 4. Enhanced Audio Activation ---
    async function testAudioCapability() {
        try {
            // Create a simple audio context to test Web Audio API
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Try to resume audio context (required after user gesture)
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            
            console.log('🎵 Audio context state:', audioContext.state);
            
            // Test with actual bell audio file
            if (audioFiles["bell"]) {
                audioFiles["bell"].volume = 0.1; // Very low volume for test
                audioFiles["bell"].currentTime = 0;
                await audioFiles["bell"].play();
                audioFiles["bell"].pause();
                audioFiles["bell"].currentTime = 0;
                console.log('🔔 Bell audio test successful');
            }
            
            await audioContext.close();
            return true;
        } catch (error) {
            console.log("❌ Audio capability test failed:", error.message);
            
            // Try alternative test with HTML5 audio - especially for kiosk mode
            try {
                const testAudio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmgfBTiH0fPTgjMGJHLH8+OZSA0PVqXh8bllHgg2jdXzzn0vBSF+zPLaizsIGGS57OihUQwKTKXh8bllHgg2jdT0z3wvBSJ+y/PajDwIF2S56+mjUgwJTKPi8blnHgU2jdTy0H4wBSJ9y/LajDwIF2S56+mjUgwJTKPi8blnHgU2jdTy0H4wBSJ9y/LajDwIF2S56+mjUgwJTKPi8blnHgU2jdTy0H4wBSJ9y/LajDwIF2S56+mjUgwJTKPi8blnHgU2jdTy0H4wBSJ9y/LajDwIF2S56+mjUgwJTKPi8blnHgU2jdTy0H4wBSJ9y/LajDwIF2S56+mjUgwJTKPi8blnHgU2jdTy0H4wBSJ9y/LajDwIF2S56+mjUgwJTKPi8blnHgU2jdTy0H4wBSJ9y/LajDwIF2S56+mjUgwJTKPi8blnHgU2jdTy0H4wBSJ9y/LajDwIF2W56+mjUgwJTKPi8blnHgU2jdTy0H4wBSJ9y/LajDwIF2W56+mjUgwJTKPi8blnHgU2jdTy0H4wBSJ9y/LajDwIF2W56+mjUgwJTKPi8blnHgU2jdTy0H4wBSJ9y/LajDwIF2W56+mjUgwJTKPi8blnHgU2jdTy0H4wBSJ9y/LajDwIF2W56+mjUgwJTKPi8blnHgU2jdTy0H4wBSJ9y/LajDwIF2W56+mjUgwJTKPi8blnHgU2jdTy0H4wBSJ9y/LajDwIF2W56+mjUgwJTKPi8blnHgU2jdTy0H4wBSJ9y/LajDwIF2W56+mjUgwJTKPi8blnHgU2jdTy0H4wBSJ9y/LajDwIF2W56+mjUgwJTKPi8blnHgU2jdTy0H4wBSJ9y/LajDwIF2W56+mjUgwJTKPi8blnHgU");
                testAudio.volume = 0;
                await testAudio.play();
                testAudio.pause();
                console.log('✅ Alternative audio test successful');
                return true;
            } catch (e2) {
                console.log("❌ Alternative audio test also failed:", e2.message);
                return false;
            }
        }
    }

    async function enableAudio(forceEnable = false) {
        console.log("🎵 Attempting to enable audio... (forceEnable:", forceEnable, ")");
        
        try {
            hasUserInteracted = true;
            
            console.log('🚀 Launch environment - Kiosk:', isKioskMode, 'Force Enable:', forceEnable);
            
            // For kiosk mode with force enable, try to enable immediately
            if (isKioskMode && forceEnable) {
                console.log('🎯 Kiosk mode with force enable - attempting direct audio activation');
                
                try {
                    // Create audio context without waiting for user gesture
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    if (audioContext.state === 'suspended') {
                        await audioContext.resume();
                    }
                    console.log('🎵 Audio context activated in kiosk mode:', audioContext.state);
                    await audioContext.close();
                } catch (contextError) {
                    console.log('❌ Audio context activation failed in kiosk mode:', contextError.message);
                }
            }
            
            // First, preload all audio files with error handling
            const audioLoadPromises = Object.keys(audioFiles).map(key => {
                return new Promise((resolve) => {
                    const audio = audioFiles[key];
                    audio.preload = 'auto';
                    
                    // Set crossorigin for better compatibility
                    audio.crossOrigin = 'anonymous';
                    
                    // For kiosk mode, try to bypass some restrictions
                    if (isKioskMode || forceEnable) {
                        audio.autoplay = false; // Ensure autoplay is off initially
                        audio.muted = false;
                    }
                    
                    audio.load();
                    
                    const onLoadedData = () => {
                        console.log(`✅ Audio file ${key} loaded successfully`);
                        cleanup();
                        resolve(true);
                    };
                    
                    const onError = (error) => {
                        console.warn(`❌ Failed to load audio file ${key}:`, error);
                        cleanup();
                        resolve(false);
                    };
                    
                    const cleanup = () => {
                        audio.removeEventListener('loadeddata', onLoadedData);
                        audio.removeEventListener('error', onError);
                        audio.removeEventListener('canplaythrough', onLoadedData);
                    };
                    
                    audio.addEventListener('loadeddata', onLoadedData);
                    audio.addEventListener('canplaythrough', onLoadedData);
                    audio.addEventListener('error', onError);
                    
                    // Shorter timeout for kiosk mode
                    const timeout = isKioskMode ? 2000 : 3000;
                    setTimeout(() => {
                        cleanup();
                        resolve(false);
                    }, timeout);
                });
            });
            
            // Wait for audio files to load (or timeout)
            const loadResults = await Promise.all(audioLoadPromises);
            const loadedCount = loadResults.filter(result => result).length;
            console.log(`📊 Loaded ${loadedCount}/${Object.keys(audioFiles).length} audio files`);
            
            // Test audio capability
            let canPlay = false;
            try {
                canPlay = await testAudioCapability();
            } catch (testError) {
                console.log('❌ Audio capability test threw error:', testError.message);
                // In kiosk mode, assume it can play if files loaded
                canPlay = isKioskMode && loadedCount > 0;
            }
            
            if (canPlay || loadedCount > 0 || (isKioskMode && forceEnable)) {
                audioEnabled = true;
                const statusMsg = isKioskMode ? 
                    `Kiosk Mode Enabled` : 
                    `Audio Enabled `;
                updateAudioStatus('enabled', statusMsg);
                console.log("✅ Audio enabled successfully");
                
                // Hide kiosk overlay when audio is successfully enabled
                if (isKioskMode && audioEnabled) {
                    hideKioskAudioOverlay();
                    kioskAudioActivated = true;
                }
                
                return true;
            } else {
                throw new Error("No audio files loaded and capability test failed");
            }
        } catch (error) {
            console.warn("❌ Failed to enable audio:", error.message);
            audioEnabled = false;
            updateAudioStatus('failed', 'Audio: Failed - ' + error.message);
            return false;
        }
    }

    function disableAudio() {
        audioEnabled = false;
        updateAudioStatus('disabled', 'Audio: Disabled');
        console.log("🔇 Audio disabled");
    }

    // --- Core Functions ---
    function updateDisplay(number, counter, animate = true, showNotification = false) {
        currentNumberEl.textContent = number;
        currentCounterEl.textContent = counter === '-' ? '-' : `Kaunter ${counter}`;
        
        if (animate) {
            currentNumberEl.classList.remove("animate-call");
            void currentNumberEl.offsetWidth; // Reflow to reset animation
            currentNumberEl.classList.add("animate-call");
        }

        // Show visual notification if audio is disabled and this is a new call
        if (!audioEnabled && showNotification && number !== '----') {
            showSilentNotification();
        }
    }

    function updateHistory(history) {
        for (let i = 0; i < 3; i++) {
            const call = history[i] || { number: "----", counter: "-" };
            document.getElementById(`prev-number-${i + 1}`).textContent = call.number;
            const counterText = call.counter === '-' ? '-' : `Kaunter ${call.counter}`;
            document.getElementById(`prev-counter-${i + 1}`).textContent = counterText;
        }
    }

    const video = document.getElementById('videoPlayer'); // your <video> element

    function playAudioSequence(sequence, onComplete) {
        if (!audioEnabled || !sequence.length) {
            if (onComplete) onComplete();
            return;
        }

        const sound = sequence.shift();
        sound.currentTime = 0;
        sound.volume = 0.7;
        
        if (video) video.muted = true;
        
        const playPromise = sound.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log("🎵 Audio playing successfully");
            }).catch(error => {
                console.error("❌ Audio play failed:", error.message);
                // Don't disable audio immediately, might be a temporary issue
                updateAudioStatus('failed', 'Audio: Play Failed');
                if (onComplete) onComplete();
                return;
            });
        }

        const onAudioEnd = () => {
            sound.removeEventListener('ended', onAudioEnd);
            sound.removeEventListener('error', onAudioError);
            
            if (sequence.length) {
                playAudioSequence(sequence, onComplete);
            } else {
                if (video) video.muted = false;
                if (onComplete) onComplete();
            }
        };

        const onAudioError = (error) => {
            console.error("❌ Audio error during playback:", error);
            sound.removeEventListener('ended', onAudioEnd);
            sound.removeEventListener('error', onAudioError);
            if (video) video.muted = false;
            if (onComplete) onComplete();
        };

        sound.addEventListener('ended', onAudioEnd);
        sound.addEventListener('error', onAudioError);
    }

    function processAudioQueue() {
        if (isPlayingAudio || audioQueue.length === 0) {
            return;
        }
        
        isPlayingAudio = true;
        const { number, counter } = audioQueue.shift();
        
        updateDisplay(number, counter, true, !audioEnabled);

        if (audioEnabled) {
            const sequence = [audioFiles["bell"]];
            number.toString().split("").forEach(digit => {
                if (audioFiles[digit]) sequence.push(audioFiles[digit]);
            });
            if (audioFiles[`counter${counter}`]) {
                sequence.push(audioFiles[`counter${counter}`]);
            }
            
            playAudioSequence(sequence, () => {
                isPlayingAudio = false;
                processAudioQueue(); // Play next in queue if any
            });
        } else {
            // If audio is disabled, just finish immediately
            setTimeout(() => {
                isPlayingAudio = false;
                processAudioQueue();
            }, 100);
        }
    }


    // --- Socket.IO Management ---
    function initializeSocket() {
        socket = io();

        socket.on("connect", () => {
            console.log("🔌 Connected to server");
            updateConnectionStatus('connected', 'Connected');
        });

        socket.on("disconnect", (reason) => {
            console.log("❌ Disconnected from server:", reason);
            updateConnectionStatus('disconnected', 'Disconnected');
        });

        socket.on("connect_error", (error) => {
            console.error("❌ Connection error:", error);
            updateConnectionStatus('disconnected', 'Connection Error');
        });

        socket.on("reconnect", (attemptNumber) => {
            console.log("🔄 Reconnected after", attemptNumber, "attempts");
            updateConnectionStatus('connected', 'Reconnected');
        });

        socket.on("reconnect_attempt", (attemptNumber) => {
            console.log("🔄 Reconnection attempt", attemptNumber);
            updateConnectionStatus('connecting', `Reconnecting... (${attemptNumber})`);
        });

        socket.on("current_state", (data) => {
            console.log("📨 Received state:", data);
            const currentCall = data.current;
            
            // If there's a new, different call, add it to the audio queue.
            if (currentCall && currentCall.number) {
                lastCalledNumber = currentCall.number;
                audioQueue.push({
                    number: currentCall.number,
                    counter: currentCall.counter
                });
                processAudioQueue();
            } 
            // If it's the first load (no last number), just display without sound.
            else if (currentCall && currentCall.number && lastCalledNumber === null) {
                lastCalledNumber = currentCall.number;
                updateDisplay(currentCall.number, currentCall.counter, false);
            }
            // Handle case where there's no current call
            else if (!currentCall || !currentCall.number) {
                updateDisplay('----', '-', false);
            }

            // Always update the history panel
            updateHistory(data.history || []);
        });

        // Handle any server errors
        socket.on("error", (data) => {
            console.error("❌ Server error:", data);
        });
    }

    // --- 3. Smart Auto-Start Behavior ---
    function startAutoCountdown() {
        let countdown = 600;
        const isAutoplayAllowed = detectAutoplayPolicy();
        
        // If in kiosk mode with proper flags, start immediately with audio
        if (isKioskMode && isAutoplayAllowed) {
            console.log('🚀 Kiosk mode with autoplay detected - starting immediately with audio');
            setTimeout(() => {
                autoStartDisplay(true); // Enable audio for kiosk mode
            }, 1000); // Brief delay to ensure everything is loaded
            return;
        }
        
        const countdownInterval = setInterval(() => {
            countdownEl.textContent = countdown;
            countdown--;
            
            if (countdown < 0) {
                clearInterval(countdownInterval);
                autoStartDisplay();
            }
        }, 1000);

        // Clear countdown if user clicks manually
        startButton.addEventListener('click', () => {
            clearInterval(countdownInterval);
        });
    }

    function autoStartDisplay(enableAudio = false) {
        console.log('🚀 Auto-starting display... Audio enabled:', enableAudio || isKioskMode);
        startDisplay(enableAudio || isKioskMode);
    }

    function startDisplay(enableAudioOnStart = true) {
        startScreen.style.display = "none";
        
        try {
            if (videoPlayer) {
                videoPlayer.muted = false; // Unmute the video
                videoPlayer.volume = 0.35;  // Set volume to 35%
                console.log('🔊 Video player unmuted');
            }
        } catch (e) {
            console.error('Error unmuting video player:', e);
        }
        
        
        if (enableAudioOnStart) {
            // Force enable audio for kiosk mode
            enableAudio(isKioskMode).then(success => {
                if (!success && !isKioskMode) {
                    console.log("❌ Audio failed to enable, showing retry button");
                    addAudioRetryButton();
                } else if (!success && isKioskMode) {
                    console.log("🔄 Audio failed in kiosk mode, showing click overlay");
                    showKioskAudioOverlay();
                }
            });
        } else if (isKioskMode) {
            // In kiosk mode but audio not enabled on start, show overlay
            showKioskAudioOverlay();
        } else {
            disableAudio();
            if (!isKioskMode) {
                addAudioRetryButton(); // Show retry button for non-kiosk auto-start
            }
        }
        
        // Connect to Socket.IO
        initializeSocket();
    }

    // --- Event Listeners ---
    startButton.addEventListener("click", async (e) => {
        e.preventDefault();
        console.log('👆 Manual start - attempting to enable audio...');
        
        // Force audio context activation for modern browsers
        try {
            // Create and immediately close an audio context to trigger permission
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            await audioContext.resume();
            await audioContext.close();
            console.log("✅ Audio context activated successfully");
        } catch (contextError) {
            console.warn("❌ Audio context activation failed:", contextError.message);
        }
        
        if (videoPlayer) {
            videoPlayer.muted = false; // Unmute the video
            videoPlayer.volume = 0.35;  // Set volume to 35%
            console.log('🔊 Video player unmuted and volume set to 35%');
        }
        
        startDisplay(true); // Manual start tries to enable audio
    });

    // Add click listener to the entire document for emergency audio activation
    document.addEventListener('click', async (e) => {
        if (!hasUserInteracted && !audioEnabled) {
            console.log('👆 User interaction detected - attempting to enable audio...');
            
            // Try to activate audio context first
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                if (audioContext.state === 'suspended') {
                    await audioContext.resume();
                }
                await audioContext.close();
            } catch (error) {
                console.warn("❌ Audio context activation failed:", error);
            }
            
            await enableAudio(isKioskMode);
        }
    });

    // Add keypress listener for additional interaction detection
    document.addEventListener('keydown', async (e) => {
        if (!hasUserInteracted && !audioEnabled) {
            console.log('⌨️ Keyboard interaction detected - attempting to enable audio...');
            await enableAudio(isKioskMode);
        }
    });
    
    // Kiosk mode - click anywhere to activate audio
    kioskAudioOverlayEl.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('🖥️ Kiosk overlay clicked - activating audio...');
        kioskAudioActivated = true;
        hideKioskAudioOverlay();
        
        if (videoPlayer) {
            videoPlayer.muted = false; // Unmute the video
            videoPlayer.volume = 0.35;  // Set volume to 35%
            console.log('🔊 Video player unmuted and volume set to 35% on kiosk click');
        }
        
        const success = await enableAudio(true);
        if (success) {
            console.log('✅ Kiosk audio activated successfully');
        } else {
            console.log('❌ Kiosk audio activation failed');
            // Show overlay again after delay
            setTimeout(showKioskAudioOverlay, 3000);
            kioskAudioActivated = false;
        }
    });

    // Add a button to manually retry audio activation
    function addAudioRetryButton() {
        if (document.getElementById('audio-retry-btn')) return; // Already exists
        
        const retryBtn = document.createElement('button');
        retryBtn.id = 'audio-retry-btn';
        retryBtn.innerHTML = '🔊 Enable Audio';
        retryBtn.style.cssText = `
            position: fixed;
            top: 80px;
            right: 10px;
            padding: 8px 12px;
            background: #f39c12;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
            z-index: 1000;
            transition: all 0.3s ease;
        `;
        
        retryBtn.addEventListener('mouseenter', () => {
            retryBtn.style.background = '#e67e22';
            retryBtn.style.transform = 'translateY(-2px)';
        });
        
        retryBtn.addEventListener('mouseleave', () => {
            retryBtn.style.background = '#f39c12';
            retryBtn.style.transform = 'translateY(0)';
        });
        
        retryBtn.addEventListener('click', async () => {
            console.log('🔊 Manual audio retry clicked');
            retryBtn.innerHTML = '⏳ Trying...';
            retryBtn.disabled = true;
            
            const success = await enableAudio(isKioskMode);
            
            if (success) {
                retryBtn.innerHTML = '✅ Enabled!';
                retryBtn.style.background = '#27ae60';
                setTimeout(() => {
                    retryBtn.remove();
                }, 1500);
            } else {
                retryBtn.innerHTML = '❌ Failed';
                retryBtn.style.background = '#e74c3c';
                setTimeout(() => {
                    retryBtn.innerHTML = '🔊 Retry Audio';
                    retryBtn.style.background = '#f39c12';
                    retryBtn.disabled = false;
                }, 2000);
            }
        });
        
        document.body.appendChild(retryBtn);
    }

    // Handle page visibility changes to reconnect if needed
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && socket && !socket.connected) {
            console.log("👁️ Page became visible, attempting to reconnect...");
            socket.connect();
        }
    });

    // --- Initialize on page load ---
    document.addEventListener('DOMContentLoaded', function() {
        console.log('🚀 Page loaded, initializing display system...');
        
        // Initialize kiosk mode detection
        isKioskMode = detectKioskMode();
        updateKioskIndicator(isKioskMode);
        
        console.log('🔊 Environment Check:');
        console.log('  - Kiosk Mode:', isKioskMode);
        console.log('  - Autoplay Policy:', detectAutoplayPolicy());
        console.log('  - User Agent:', navigator.userAgent.substring(0, 100) + '...');
        console.log('  - Screen:', window.screen.width + 'x' + window.screen.height);
        console.log('  - Window:', window.innerWidth + 'x' + window.innerHeight);
        console.log('  - URL:', window.location.href);
        
        startAutoCountdown();
    });

    // Prevent context menu to avoid accidental interactions
    //document.addEventListener('contextmenu', e => e.preventDefault());

    // Add error handler for unhandled promise rejections
    window.addEventListener('unhandledrejection', event => {
        console.error('❌ Unhandled promise rejection:', event.reason);
    });

    // Add global error handler
    window.addEventListener('error', event => {
        console.error('❌ Global error:', event.error);
    });
    
