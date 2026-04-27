
    // ==================== VARIABLES GLOBALES ====================
    let player;
    let isPlayerReady = false;
    let previewInterval = null;
    let currentVideoId = null;
    let autoPlayOnReady = false;
    let currentMode = 'editor'; // 'editor' o 'player'
    let pendingClipData = null; // Datos del clip esperando interacción en móvil

    // Elementos del DOM - Editor
    const editorModeDiv = document.getElementById('editorMode');
    const playerModeDiv = document.getElementById('playerMode');
    const videoUrlInput = document.getElementById('videoUrl');
    const loadVideoBtn = document.getElementById('loadVideoBtn');
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    const setStartBtn = document.getElementById('setStartBtn');
    const setEndBtn = document.getElementById('setEndBtn');
    const previewBtn = document.getElementById('previewBtn');
    const generateBtn = document.getElementById('generateBtn');
    const resultMsg = document.getElementById('resultMsg');
    const shareLinkContainer = document.getElementById('shareLinkContainer');
    const shareLinkInput = document.getElementById('shareLink');
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    const clipTitleInput = document.getElementById('clipTitleInput');

    // Elementos del DOM - Reproductor
    const playerTitle = document.getElementById('playerTitle');
    const timeRange = document.getElementById('timeRange');
    const replayBtn = document.getElementById('replayBtn');
    const goToEditorBtn = document.getElementById('goToEditorBtn');
    const editFab = document.getElementById('editFab');

    // Elementos del DOM - Overlay Móvil
    const mobileStartOverlay = document.getElementById('mobileStartOverlay');
    const overlayTitle = document.getElementById('overlayTitle');
    const overlayTime = document.getElementById('overlayTime');
    const overlayPlayBtn = document.getElementById('overlayPlayBtn');

    // ==================== DETECCIÓN DE DISPOSITIVO ====================
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
            || window.innerWidth < 992;
    }

    // ==================== INICIALIZACIÓN ====================
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
        console.log("API de YouTube Lista");
        checkUrlForClip();
    };

    // ==================== FUNCIONES AUXILIARES ====================
    function getYoutubeId(url) {
        const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // ==================== CAMBIO DE MODOS ====================
    function switchToPlayerMode() {
        currentMode = 'player';
        editorModeDiv.classList.add('d-none');
        playerModeDiv.classList.remove('d-none');
        document.body.classList.remove('editor-mode');
        document.body.classList.add('player-mode');
    }

    function switchToEditorMode(videoId = null, start = null, end = null, title = '') {
        currentMode = 'editor';
        playerModeDiv.classList.add('d-none');
        editorModeDiv.classList.remove('d-none');
        document.body.classList.remove('player-mode');
        document.body.classList.add('editor-mode');

        // Ocultar overlay si estaba visible
        mobileStartOverlay.classList.add('d-none');
        mobileStartOverlay.classList.remove('hidden-overlay');

        // Si venimos del reproductor con datos, pre-rellenar
        if (videoId) {
            videoUrlInput.value = `https://youtu.be/${videoId}`;
            startTimeInput.value = start || 0;
            endTimeInput.value = end || 0;
            clipTitleInput.value = title || '';
            
            // Destruir reproductor del viewer y crear en editor
            if (player) {
                player.destroy();
                player = null;
                isPlayerReady = false;
            }
            loadVideoInEditor(videoId);
        }
    }

    // ==================== CARGAR VIDEO EN EDITOR ====================
    function loadVideoInEditor(id, autoPlay = false) {
        currentVideoId = id;
        autoPlayOnReady = autoPlay;
        shareLinkContainer.classList.add('d-none');

        if (player && isPlayerReady) {
            player.loadVideoById(id);
            if (autoPlay) runPreview();
        } else {
            player = new YT.Player('ytPlayerEditor', {
                videoId: id,
                playerVars: { 
                    'playsinline': 1, 
                    'modestbranding': 1, 
                    'autoplay': autoPlay ? 1 : 0 
                },
                events: {
                    'onReady': () => {
                        isPlayerReady = true;
                        previewBtn.disabled = false;
                        previewBtn.innerText = "Previsualizar Clip";
                        generateBtn.disabled = false;
                        
                        if (autoPlayOnReady) {
                            runPreview();
                            autoPlayOnReady = false;
                        }
                    }
                }
            });
        }
    }

    // ==================== CARGAR VIDEO EN REPRODUCTOR ====================
    function loadVideoInPlayer(id, start, end, title) {
        // Actualizar UI
        playerTitle.textContent = title || 'Clip sin título';
        timeRange.textContent = `${formatTime(start)} - ${formatTime(end)}`;

        // Actualizar overlay
        overlayTitle.textContent = title || 'Clip de YouTube';
        overlayTime.textContent = `${formatTime(start)} - ${formatTime(end)}`;

        // Guardar datos por si necesitamos recrear el player tras interacción
        pendingClipData = { id, start, end, title };

        // En móvil: mostrar overlay y NO crear el player aún (o crearlo muted)
        if (isMobileDevice()) {
            mobileStartOverlay.classList.remove('d-none');
            
            // Precargar el player muted para que esté listo (opcional, mejora UX)
            // pero el verdadero play con sonido vendrá tras el click
            createPlayerForMobile(id, start, end);
        } else {
            // Desktop: autoplay normal con sonido
            mobileStartOverlay.classList.add('d-none');
            createPlayerForDesktop(id, start, end);
        }
    }

    function createPlayerForDesktop(id, start, end) {
        if (player) {
            player.destroy();
            player = null;
            isPlayerReady = false;
        }

        player = new YT.Player('ytPlayerViewer', {
            videoId: id,
            playerVars: {
                'playsinline': 1,
                'modestbranding': 1,
                'autoplay': 1,
                'start': start,
                'end': end
            },
            events: {
                'onReady': (event) => {
                    isPlayerReady = true;
                    event.target.playVideo();
                }
            }
        });
    }

    function createPlayerForMobile(id, start, end) {
        if (player) {
            player.destroy();
            player = null;
            isPlayerReady = false;
        }

        // Crear player inicialmente muted (autoplay permitido en móvil solo si muted)
        player = new YT.Player('ytPlayerViewer', {
            videoId: id,
            playerVars: {
                'playsinline': 1,
                'modestbranding': 1,
                'autoplay': 1,
                'mute': 1,
                'start': start,
                'end': end
            },
            events: {
                'onReady': (event) => {
                    isPlayerReady = true;
                    event.target.playVideo();
                }
            }
        });
    }

    // ==================== INICIAR REPRODUCCIÓN CON SONIDO (MÓVIL) ====================
    function startPlaybackWithSound() {
        if (!pendingClipData) return;

        const { id, start, end, title } = pendingClipData;

        // Ocultar overlay con animación
        mobileStartOverlay.classList.add('hidden-overlay');

        // Si el player ya existe, simplemente unmute y seek
        if (player && isPlayerReady) {
            try {
                player.unMute();
                player.setVolume(100);
                player.seekTo(start, true);
                player.playVideo();
            } catch (e) {
                console.log("Error al unmute:", e);
                // Fallback: recrear el player
                recreatePlayerUnmuted(id, start, end);
            }
        } else {
            recreatePlayerUnmuted(id, start, end);
        }
    }

    function recreatePlayerUnmuted(id, start, end) {
        if (player) {
            player.destroy();
            player = null;
            isPlayerReady = false;
        }

        player = new YT.Player('ytPlayerViewer', {
            videoId: id,
            playerVars: {
                'playsinline': 1,
                'modestbranding': 1,
                'autoplay': 1,
                'start': start,
                'end': end
            },
            events: {
                'onReady': (event) => {
                    isPlayerReady = true;
                    event.target.playVideo();
                }
            }
        });
    }

    // ==================== LÓGICA DEL EDITOR ====================
    loadVideoBtn.addEventListener('click', () => {
        const url = videoUrlInput.value;
        const videoId = getYoutubeId(url);
        if (!videoId) {
            resultMsg.innerHTML = '<span class="text-danger">URL no válida.</span>';
            return;
        }
        resultMsg.innerHTML = ''; 
        loadVideoInEditor(videoId, false);
    });

    setStartBtn.addEventListener('click', () => {
        if (!isPlayerReady || currentMode !== 'editor') return;
        startTimeInput.value = Math.round(player.getCurrentTime());
    });

    setEndBtn.addEventListener('click', () => {
        if (!isPlayerReady || currentMode !== 'editor') return;
        endTimeInput.value = Math.round(player.getCurrentTime());
    });

    function runPreview() {
        const start = parseInt(startTimeInput.value) || 0;
        const end = parseInt(endTimeInput.value) || 0;

        if (end - start > 60) {
            resultMsg.innerHTML = '<span class="text-danger">Error: El clip no puede durar más de 60 segundos.</span>';
            return;
        }
        if (end <= start) {
            resultMsg.innerHTML = '<span class="text-danger">Error: El tiempo de fin debe ser mayor al de inicio.</span>';
            return;
        }

        resultMsg.innerHTML = '<span class="text-info">Reproduciendo clip...</span>';

        if (previewInterval) clearInterval(previewInterval);

        player.seekTo(start, true);
        player.playVideo();

        previewInterval = setInterval(() => {
            if (player.getCurrentTime() >= end) {
                player.pauseVideo();
                clearInterval(previewInterval);
                previewInterval = null;
                resultMsg.innerHTML = '<span class="text-light">Clip terminado.</span>';
            }
        }, 100);
    }

    previewBtn.addEventListener('click', () => {
        if (!isPlayerReady) return;
        runPreview();
    });

    generateBtn.addEventListener('click', () => {
        const start = parseInt(startTimeInput.value) || 0;
        const end = parseInt(endTimeInput.value) || 0;
        const title = clipTitleInput.value.trim();

        if (end - start > 60 || end <= start) {
            resultMsg.innerHTML = '<span class="text-danger">Revisa los tiempos. Max 60s.</span>';
            return;
        }

        if (!title) {
            resultMsg.innerHTML = '<span class="text-warning">Por favor, pon un título al clip.</span>';
            clipTitleInput.focus();
            return;
        }

        // Construir URL con título
        const shareUrl = `${window.location.origin}${window.location.pathname}?v=${currentVideoId}&start=${start}&end=${end}&title=${encodeURIComponent(title)}`;

        shareLinkInput.value = shareUrl;
        shareLinkContainer.classList.remove('d-none');
        resultMsg.innerHTML = '<span class="text-success">¡Enlace generado! Compártelo.</span>';
    });

    copyLinkBtn.addEventListener('click', () => {
        shareLinkInput.select();
        document.execCommand('copy');
        resultMsg.innerHTML = '<span class="text-success">¡Copiado al portapapeles!</span>';
    });

    // ==================== LÓGICA DEL REPRODUCTOR ====================
    replayBtn.addEventListener('click', () => {
        const params = new URLSearchParams(window.location.search);
        const videoId = params.get('v');
        const start = parseInt(params.get('start')) || 0;
        const end = parseInt(params.get('end')) || 0;
        const title = params.get('title') || 'Clip';
        
        if (videoId) {
            loadVideoInPlayer(videoId, start, end, title);
        }
    });

    goToEditorBtn.addEventListener('click', () => {
        const params = new URLSearchParams(window.location.search);
        const videoId = params.get('v');
        const start = parseInt(params.get('start')) || 0;
        const end = parseInt(params.get('end')) || 0;
        const title = decodeURIComponent(params.get('title') || '');
        
        // Limpiar URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        switchToEditorMode(videoId, start, end, title);
    });

    editFab.addEventListener('click', () => {
        goToEditorBtn.click();
    });

    // ==================== OVERLAY MÓVIL: EVENTOS ====================
    overlayPlayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startPlaybackWithSound();
    });

    mobileStartOverlay.addEventListener('click', () => {
        startPlaybackWithSound();
    });

    // ==================== DETECCIÓN DE URL COMPARTIDA ====================
    function checkUrlForClip() {
        const params = new URLSearchParams(window.location.search);
        const videoId = params.get('v');
        const start = parseInt(params.get('start'));
        const end = parseInt(params.get('end'));
        const title = params.get('title');

        if (videoId && !isNaN(start) && !isNaN(end)) {
            // MODO REPRODUCTOR: Viene de un enlace compartido
            const decodedTitle = title ? decodeURIComponent(title) : 'Clip de YouTube';
            
            // Pre-rellenar inputs del editor por si acaso (ocultos)
            videoUrlInput.value = `https://youtu.be/${videoId}`;
            startTimeInput.value = start;
            endTimeInput.value = end;
            if (title) clipTitleInput.value = decodedTitle;

            // Cambiar a modo reproductor y cargar
            switchToPlayerMode();
            if (player) {
                player.destroy();
                player = null;
            }

            isPlayerReady = false;
            loadVideoInPlayer(videoId, start, end, decodedTitle);
        } else {
            // MODO EDITOR: Entrada normal
            switchToEditorMode();
        }
    }