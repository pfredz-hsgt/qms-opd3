// Video Player Module with DRM Support (Shaka Player)
document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('videoPlayer');
    const channelSelect = document.getElementById('channelSelect');

    let shakaPlayer;
    let localMediaFiles = [];
    let currentVideoIndex = 0;

    function onShakaError(error) {
        console.error('Shaka Player error:', error.detail);
    }

    // Initialize Shaka Player
    function initShaka() {
        if (typeof shaka !== 'undefined') {
            shaka.polyfill.installAll();
            if (shaka.Player.isBrowserSupported()) {
                shakaPlayer = new shaka.Player(video);
                shakaPlayer.addEventListener('error', onShakaError);
                console.log("✅ Shaka Player initialized");
            } else {
                console.error("❌ Browser not supported by Shaka Player!");
            }
        } else {
            console.error("❌ Shaka Player library not found!");
        }
    }

    initShaka();

    const nativeAutoplay = () => {
        video.play().catch(e => console.warn("Native autoplay failed.", e));
    };

    const playNextVideo = () => {
        if (localMediaFiles.length === 0) return;
        console.log(`Playing local media index ${currentVideoIndex}`);
        video.src = localMediaFiles[currentVideoIndex];
        video.play().catch(e => console.warn("Local media autoplay failed.", e));
        currentVideoIndex = (currentVideoIndex + 1) % localMediaFiles.length;
    };

    const onLocalMediaError = (e) => {
        console.error("Video playback error on local media:", e);
        console.log("Trying next video in 1 second...");
        setTimeout(playNextVideo, 1000);
    };

    async function stopAllPlayback() {
        console.log("Stopping all playback and cleaning up listeners.");
        if (shakaPlayer) {
            const player = shakaPlayer;
            shakaPlayer = null; // Detach reference immediately
            try {
                await player.destroy();
                console.log("Shaka Player destroyed");
            } catch (e) {
                console.warn("Error destroying Shaka Player:", e);
            }
        }
        video.removeEventListener("ended", playNextVideo);
        video.removeEventListener("error", onLocalMediaError);
        video.removeEventListener('loadeddata', nativeAutoplay);
        video.removeAttribute('src');
        video.load();
    }

    async function playShakaStream(url, licenseKey) {
        console.log(`Loading stream with Shaka Player: ${url}`);

        if (!shakaPlayer) {
            initShaka();
        }

        if (!shakaPlayer) return;

        try {
            // Configure DRM if license key is provided
            if (licenseKey) {
                console.log('🔐 Configuring DRM with Clear Keys...', JSON.stringify(licenseKey));
                shakaPlayer.configure({
                    drm: {
                        clearKeys: licenseKey,
                        advanced: {
                            'org.w3.clearkey': {
                                videoRobustness: 'SW_SECURE_CRYPTO',
                                audioRobustness: 'SW_SECURE_CRYPTO'
                            }
                        }
                    }
                });
            } else {
                // Clear any previous DRM configuration
                shakaPlayer.configure({
                    drm: {
                        clearKeys: {},
                        advanced: {}
                    }
                });
            }

            await shakaPlayer.load(url);
            console.log('✅ Stream loaded successfully with Shaka Player');
            video.play().catch(e => console.warn("Autoplay failed:", e));
        } catch (error) {
            console.error('❌ Failed to load stream with Shaka Player:', error);
        }
    }

    function playLocalPlaylist() {
        console.log("Starting local media playlist...");
        if (localMediaFiles.length === 0) {
            alert("Local media list is empty or still loading. Please try again.");
            return;
        }
        video.addEventListener("ended", playNextVideo);
        video.addEventListener("error", onLocalMediaError);
        currentVideoIndex = 0;
        playNextVideo();
    }

    async function loadPlaylist() {
        try {
            let response = await fetch('/static/livetv-full.m3u8');
            if (!response.ok) {
                console.warn('livetv-full.m3u8 not found, trying livetv.m3u8...');
                response = await fetch('/static/livetv.m3u8');
            }

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.text();
            const channels = parseM3U(data);

            channels.forEach(channel => {
                const option = document.createElement('option');
                option.value = channel.url;
                option.textContent = channel.name;

                if (channel.licenseKey) {
                    option.setAttribute('data-license-key', JSON.stringify(channel.licenseKey));
                }
                if (channel.userAgent) {
                    option.setAttribute('data-user-agent', channel.userAgent);
                }

                channelSelect.appendChild(option);
            });

            const localOption = document.createElement('option');
            localOption.value = 'local_media_playlist';
            localOption.textContent = 'Local Media Playlist';
            channelSelect.appendChild(localOption);

            console.log("Playlist loaded. Setting default channel to TV1...");
            const defaultChannelName = "TV1";
            const defaultChannel = channels.find(channel => channel.name === defaultChannelName);

            if (defaultChannel) {
                console.log("Found default channel:", defaultChannel.name);
                channelSelect.value = defaultChannel.url;
                loadChannel();
            } else {
                console.warn(`Default channel "${defaultChannelName}" not found in playlist.`);
            }
        } catch (error) {
            console.error('Failed to load or parse playlist:', error);
            alert('Error: Could not load the playlist file.');
        }
    }

    async function fetchLocalMedia() {
        try {
            const res = await fetch('/api/media-list');
            const data = await res.json();
            if (data.status === 'success' && data.media_files.length > 0) {
                localMediaFiles = data.media_files;
                console.log(`📹 Loaded ${localMediaFiles.length} local media files`);
            } else {
                console.warn("⚠️ No local media files found from API.");
            }
        } catch (error) {
            console.error("❌ Failed to load local media files:", error);
        }
    }

    function parseM3U(data) {
        const lines = data.split('\n');
        const channels = [];
        let currentName = null;
        let currentLicenseKey = null;
        let currentUserAgent = null;

        for (const line of lines) {
            const trimmedLine = line.trim();

            if (trimmedLine.startsWith('#EXTINF:')) {
                const parts = trimmedLine.split(',');
                currentName = parts[parts.length - 1].trim();
            }
            else if (trimmedLine.startsWith('#KODIPROP:inputstream.adaptive.license_key=')) {
                const keyPart = trimmedLine.split('=')[1];
                try {
                    const keyJson = JSON.parse(keyPart);
                    currentLicenseKey = keyJson;
                    console.log(`Found DRM key for ${currentName}:`, currentLicenseKey);
                } catch (e) {
                    console.warn('Failed to parse license key:', e);
                }
            }
            else if (trimmedLine.startsWith('#DRM-CLEARKEY=')) {
                // Alternative format: #DRM-CLEARKEY=key-id:key
                const keyPart = trimmedLine.split('=')[1];
                try {
                    const [keyId, key] = keyPart.split(':');
                    currentLicenseKey = {};
                    currentLicenseKey[keyId.trim()] = key.trim();
                    console.log(`Found DRM key for ${currentName}:`, currentLicenseKey);
                } catch (e) {
                    console.warn('Failed to parse DRM-CLEARKEY:', e);
                }
            }
            else if (trimmedLine.startsWith('#EXTVLCOPT:http-user-agent=')) {
                currentUserAgent = trimmedLine.split('=', 2)[1];
            }
            else if (currentName && !trimmedLine.startsWith('#') && trimmedLine) {
                channels.push({
                    name: currentName,
                    url: trimmedLine,
                    licenseKey: currentLicenseKey,
                    userAgent: currentUserAgent
                });
                currentName = null;
                currentLicenseKey = null;
                currentUserAgent = null;
            }
        }

        console.log(`✅ Parsed ${channels.length} channels from playlist`);
        return channels;
    }

    async function loadChannel() {
        const selectedOption = channelSelect.options[channelSelect.selectedIndex];
        const url = selectedOption.value;

        await stopAllPlayback();

        if (!url) return;

        const licenseKeyStr = selectedOption.getAttribute('data-license-key');

        console.log(`Loading channel: ${selectedOption.textContent}`);
        console.log(`URL: ${url}`);

        if (url === 'local_media_playlist') {
            playLocalPlaylist();
            return;
        }

        let parsedLicenseKey = null;
        if (licenseKeyStr) {
            try {
                parsedLicenseKey = JSON.parse(licenseKeyStr);
                console.log('🔐 DRM key parsed successfully');
            } catch (e) {
                console.warn('Failed to parse stored license key:', e);
            }
        }

        playShakaStream(url, parsedLicenseKey);
    }

    // Initialize
    loadPlaylist();
    fetchLocalMedia();
    channelSelect.addEventListener('change', loadChannel);

    // Keyboard shortcuts for channel navigation
    document.addEventListener('keydown', (event) => {
        const keyName = event.key;
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(keyName)) return;
        event.preventDefault();

        const totalOptions = channelSelect.options.length;
        let currentIndex = channelSelect.selectedIndex;
        let newIndex = currentIndex;
        const firstChannelIndex = 1;
        const lastChannelIndex = totalOptions - 1;

        if (keyName === 'ArrowDown' || keyName === 'ArrowRight') {
            newIndex++;
            if (newIndex > lastChannelIndex) newIndex = firstChannelIndex;
        } else if (keyName === 'ArrowUp' || keyName === 'ArrowLeft') {
            newIndex--;
            if (newIndex < firstChannelIndex) newIndex = lastChannelIndex;
        }

        if (newIndex !== currentIndex) {
            console.log(`Key pressed: ${keyName}. Changing channel to index ${newIndex}`);
            channelSelect.selectedIndex = newIndex;
            loadChannel();
        }
    });
});