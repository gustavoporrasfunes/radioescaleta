// js/editor.js
import { authService } from './services/authService.js?v=3';
import { cloudinaryService } from './services/cloudinaryService.js';
import { setupUserProfile } from './utils/profileUI.js?v=12';
import { dbService } from './services/dbService.js?v=8';
import { Program, DEFAULT_SOUNDBOARD } from './models/Program.js';
import { EscaletaUI } from './components/EscaletaUI.js?v=9';
import { GanttUI } from './components/GanttUI.js?v=5';
import { downloadPDF } from './utils/pdfGenerator.js?v=2';

let currentProgram = new Program();
let escaletaUI = null;
let hasUnsavedChanges = false;
let isInitialized = false;
let urlParams = new URLSearchParams(window.location.search);
let isReadOnly = urlParams.get('readonly') === '1';
let currentUser = null;

async function saveCurrentProgram() {
    if (isReadOnly) return null;
    const titleVal = document.getElementById('programTitle')?.value?.trim();
    if (titleVal) {
        currentProgram.title = titleVal;
    }
    const firestoreData = currentProgram.toFirestore();
    const savedId = await dbService.saveProgram(firestoreData);
    if (savedId) {
        currentProgram.id = savedId;
        hasUnsavedChanges = false;
        try {
            sessionStorage.setItem(`prog_${savedId}`, JSON.stringify(firestoreData));
            localStorage.setItem(`prog_${savedId}`, JSON.stringify(firestoreData));
        } catch (_) {}
        if (!urlParams.has('id') || urlParams.get('id') !== savedId) {
            urlParams.set('id', savedId);
            window.history.replaceState({}, '', `?id=${savedId}`);
        }
    }
    return savedId;
}

// Librería estática por defecto (rutas relativas)
const defaultLibrary = {
    sintonias: [
        { title: "Sintonía Inicio",    url: "./assets/sounds/sintonias/sintonia-inicio.wav",   icon: "fa-play" },
        { title: "Sintonía Noticias",  url: "./assets/sounds/sintonias/sintonia-noticias.wav", icon: "fa-newspaper" },
        { title: "Final de Programa",  url: "./assets/sounds/sintonias/final-programa.wav",    icon: "fa-flag-checkered" },
        { title: "Jingle Victoria",    url: "./assets/sounds/sintonias/jingle-correcto.wav",   icon: "fa-trophy" }
    ],
    efectos: [
        { title: "Alarma1", url: "./assets/sounds/efectos/Alarma1.mp3", icon: "fa-bell" },
        { title: "Alarma2", url: "./assets/sounds/efectos/Alarma2.mp3", icon: "fa-bell" },
        { title: "Aplausos1", url: "./assets/sounds/efectos/Aplausos1.mp3", icon: "fa-hands-clapping" },
        { title: "Aplausos2", url: "./assets/sounds/efectos/Aplausos2.mp3", icon: "fa-hands-clapping" },
        { title: "Aplausos3", url: "./assets/sounds/efectos/Aplausos3.mp3", icon: "fa-hands-clapping" },
        { title: "Campanas", url: "./assets/sounds/efectos/Campanas.mp3", icon: "fa-bell" },
        { title: "Campanas2", url: "./assets/sounds/efectos/Campanas2.mp3", icon: "fa-bell" },
        { title: "Cartoon_1", url: "./assets/sounds/efectos/Cartoon_1.wav", icon: "fa-face-laugh" },
        { title: "Cartoon2", url: "./assets/sounds/efectos/Cartoon2.mp3", icon: "fa-face-laugh" },
        { title: "Cartoon3", url: "./assets/sounds/efectos/Cartoon3.mp3", icon: "fa-face-laugh" },
        { title: "Cartoon4", url: "./assets/sounds/efectos/Cartoon4.mp3", icon: "fa-face-laugh" },
        { title: "Clank1", url: "./assets/sounds/efectos/Clank1.mp3", icon: "fa-bolt" },
        { title: "Cremallera", url: "./assets/sounds/efectos/Cremallera.mp3", icon: "fa-wave-square" },
        { title: "Golpe", url: "./assets/sounds/efectos/Golpe.mp3", icon: "fa-burst" }
    ],
    musica: [
        { title: "Aspire", url: "./assets/sounds/musica/Aspire.mp3", icon: "fa-music" },
        { title: "Clock", url: "./assets/sounds/musica/Clock.mp3", icon: "fa-clock" },
        { title: "DownTownSaturdayMarket", url: "./assets/sounds/musica/DownTownSaturdayMarket.wav", icon: "fa-music" },
        { title: "FunFolk", url: "./assets/sounds/musica/FunFolk.mp3", icon: "fa-guitar" },
        { title: "Happy_Dreams", url: "./assets/sounds/musica/Happy_Dreams.mp3", icon: "fa-face-smile-beam" },
        { title: "MusicalSmile", url: "./assets/sounds/musica/MusicalSmile.wav", icon: "fa-face-smile-beam" },
        { title: "MusicalSmile2", url: "./assets/sounds/musica/MusicalSmile2.wav", icon: "fa-face-smile-beam" },
        { title: "Sport_Drums", url: "./assets/sounds/musica/Sport_Drums.mp3", icon: "fa-drum" }
    ]
};

const PRELOADED_SOUNDS_STORAGE_KEY = 'radioescaleta_preloaded_sounds';

function getStoredPreloadedSounds() {
    try {
        const stored = localStorage.getItem(PRELOADED_SOUNDS_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.warn('Error leyendo sintonías precargadas de localStorage:', e);
        return [];
    }
}

function saveStoredPreloadedSounds(sounds) {
    try {
        localStorage.setItem(PRELOADED_SOUNDS_STORAGE_KEY, JSON.stringify(sounds));
    } catch (e) {
        console.warn('Error guardando sintonías precargadas en localStorage:', e);
    }
}

function addPreloadedSoundLocally(sound) {
    const list = getStoredPreloadedSounds();
    const cleanUrl = (sound.url || '').trim();
    const cleanTitle = (sound.title || '').trim();
    const idx = list.findIndex(s => (cleanUrl && s.url === cleanUrl) || (cleanTitle && s.title.toLowerCase() === cleanTitle.toLowerCase()));
    const item = {
        title: sound.title,
        url: sound.url,
        publicId: sound.publicId || null,
        icon: sound.icon || 'fa-star',
        docId: sound.docId || ('local_' + Date.now()),
        category: 'sintonias_precargadas',
        createdAt: sound.createdAt || new Date().toISOString()
    };
    if (idx !== -1) {
        list[idx] = { ...list[idx], ...item };
    } else {
        list.unshift(item);
    }
    saveStoredPreloadedSounds(list);
    return item;
}

let sharedLibrary = {
    sintonias: [...defaultLibrary.sintonias],
    sintonias_precargadas: getStoredPreloadedSounds(),
    efectos: [...defaultLibrary.efectos],
    musica: [...defaultLibrary.musica]
};

function normalizeSoundCategory(rawCategory) {
    if (!rawCategory) return 'sintonias';
    const c = String(rawCategory).toLowerCase().trim().replace(/[-\s]/g, '_');
    if (c.includes('precarga') || c === 'sintonias_precargadas' || c === 'sintonia_precargada') {
        return 'sintonias_precargadas';
    }
    if (c.includes('musica')) {
        return 'musica';
    }
    if (c.includes('efecto')) {
        return 'efectos';
    }
    if (c.includes('sintonia')) {
        return 'sintonias';
    }
    return c;
}

let activeModalCategory = null;

function loadSharedLibrary() {
    // 1. Asegurar que memoria tiene lo guardado en localStorage
    const localSounds = getStoredPreloadedSounds();
    if (localSounds.length > 0) {
        if (!sharedLibrary.sintonias_precargadas || sharedLibrary.sintonias_precargadas.length === 0) {
            sharedLibrary.sintonias_precargadas = [...localSounds];
        }
    }

    return dbService.getSoundLibrary().then(sounds => {
        if (sounds && sounds.length > 0) {
            const newLib = { sintonias: [], sintonias_precargadas: [], efectos: [], musica: [] };
            sounds.forEach(s => {
                const cat = normalizeSoundCategory(s.category);
                if (!newLib[cat]) newLib[cat] = [];
                newLib[cat].push({ 
                    title: s.title, 
                    url: s.url, 
                    publicId: s.publicId || null,
                    icon: s.icon || (cat === 'sintonias_precargadas' ? 'fa-star' : 'fa-music'),
                    docId: s.docId || s.id,
                    createdAt: s.createdAt || null
                });
            });

            // FUSIONAR: combinar las sintonías precargadas de Firestore con las de localStorage
            const mergedPreloaded = [...newLib.sintonias_precargadas];
            const currentLocal = getStoredPreloadedSounds();
            currentLocal.forEach(loc => {
                const exists = mergedPreloaded.some(m => (loc.url && m.url === loc.url) || (loc.title && m.title === loc.title));
                if (!exists) {
                    mergedPreloaded.push(loc);
                }
            });
            newLib.sintonias_precargadas = mergedPreloaded;

            // Guardar de vuelta en localStorage para persistencia offline instantánea
            if (mergedPreloaded.length > 0) {
                saveStoredPreloadedSounds(mergedPreloaded);
            }

            sharedLibrary = newLib;

            // Si el modal de librería está actualmente visible con una categoría abierta, actualizar la lista en vivo
            const listWrapper = document.getElementById('modalAudioListWrapper');
            if (listWrapper && listWrapper.style.display !== 'none' && activeModalCategory) {
                renderCategoryAudioList(activeModalCategory, false);
            }
        } else {
            // Si Firestore devolvió vacío o falló, asegurar que mantenemos lo local
            const currentLocal = getStoredPreloadedSounds();
            if (currentLocal.length > 0) {
                sharedLibrary.sintonias_precargadas = [...currentLocal];
            }
        }
        return sharedLibrary;
    }).catch(e => {
        console.warn('Aviso cargando librería en segundo plano:', e);
        const currentLocal = getStoredPreloadedSounds();
        if (currentLocal.length > 0) {
            sharedLibrary.sintonias_precargadas = [...currentLocal];
        }
        return sharedLibrary;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializar Componentes
    let onEscaletaUpdate;
    const ganttUI = new GanttUI('ganttContainer', () => {
        if (onEscaletaUpdate) onEscaletaUpdate();
    });
    
    let autoSaveTimer = null;
    const triggerAutoSave = () => {
        if (!isInitialized || isReadOnly) return;
        hasUnsavedChanges = true;
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(async () => {
            try {
                await saveCurrentProgram();
                console.log("Programa autoguardado con éxito.");
            } catch (e) {
                console.warn("Auto-save falló:", e);
            }
        }, 1500);
    };

    // Callback cuando la escaleta cambia para actualizar la botonera y el gantt (si está activo)
    onEscaletaUpdate = () => {
        if (isInitialized) {
            triggerAutoSave();
        }
        if (document.body.classList.contains('gantt-active')) {
            ganttUI.render(currentProgram);
        }
        renderEditorSoundboard();
    };

    escaletaUI = new EscaletaUI('escaletaList', currentProgram, onEscaletaUpdate);

    // === MODO SÓLO LECTURA ===
    urlParams = new URLSearchParams(window.location.search);
    isReadOnly = urlParams.get('readonly') === '1';

    window.applyReadOnlyMode = function(roleName = "Lector") {
        isReadOnly = true;
        document.title = `👁️ ${roleName} — ` + document.title;

        // Quitar banner anterior si hay
        const oldBanner = document.getElementById('ro-banner');
        if (oldBanner) oldBanner.remove();

        const banner = document.createElement('div');
        banner.id = 'ro-banner';
        banner.style.cssText = 'background:#1565c0; color:white; text-align:center; padding:8px; font-size:14px; font-weight:bold;';
        banner.innerHTML = `<i class="fa-solid fa-eye"></i> Modo ${roleName} (sólo lectura) — Puedes reproducir el directo pero no guardar cambios.`;
        document.body.insertBefore(banner, document.body.firstChild);

        // Ocultar botones de edición en modo solo lectura
        const editBtns = ['btnSave', 'btnAddText', 'btnAddAudio', 'btnUploadDrive', 'btnShare', 'btnOpenStudio'];
        editBtns.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        // Deshabilitar auto-save
        if (escaletaUI) escaletaUI.onUpdateCallback = null;
        
        // Deshabilitar Inputs de título
        const pt = document.getElementById('programTitle');
        if (pt) pt.readOnly = true;
    };

    if (isReadOnly) {
        window.applyReadOnlyMode("Supervisión");
    }

    // Controles de Vistas
    const btnViewList = document.getElementById('btnViewList');
    const btnViewGantt = document.getElementById('btnViewGantt');
    
    btnViewList.addEventListener('click', () => {
        document.body.classList.remove('gantt-active');
        btnViewList.style.background = 'var(--primary-color)';
        btnViewGantt.style.background = '#9e9e9e';
    });
    
    btnViewGantt.addEventListener('click', () => {
        document.body.classList.add('gantt-active');
        btnViewGantt.style.background = 'var(--primary-color)';
        btnViewList.style.background = '#9e9e9e';
        ganttUI.render(currentProgram);
    });

    // 2. CARGA INSTANTÁNEA DESDE CACHÉ (0ms perceived load)
    const programId = urlParams.get('id');
    let loadedFromCache = false;

    if (programId) {
        try {
            const cachedStr = sessionStorage.getItem(`prog_${programId}`) || localStorage.getItem(`prog_${programId}`);
            if (cachedStr) {
                const cachedData = JSON.parse(cachedStr);
                currentProgram = Program.fromFirestore(cachedData);
                escaletaUI.program = currentProgram;
                const pt = document.getElementById('programTitle');
                if (pt) pt.value = currentProgram.title;
                escaletaUI.render();
                onEscaletaUpdate();
                loadedFromCache = true;
                console.log("⚡ Escaleta renderizada instantáneamente desde caché.");
            }
        } catch (cacheErr) {
            console.warn("Aviso leyendo caché local:", cacheErr);
        }
    } else {
        // Programa nuevo en blanco
        escaletaUI.render();
        onEscaletaUpdate();
    }

    // 3. Carga no bloqueante de la librería compartida en segundo plano
    loadSharedLibrary();

    // 4. Verificación de Autenticación y Sincronización en segundo plano con Firebase
    authService.onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        currentUser = user;

        // Cargar inmediatamente la librería compartida ya con el token de auth
        loadSharedLibrary();

        // Actualizar datos de usuario en segundo plano (fire-and-forget)
        dbService.saveUser(user).catch(() => {});

        // Peticiones paralelas a Firebase (perfil + datos frescos de escaleta)
        const [profile, serverData] = await Promise.all([
            dbService.getUserProfile(user.uid).catch(() => null),
            programId ? dbService.getProgramById(programId).catch(() => null) : Promise.resolve(null)
        ]);

        if (profile) {
            setupUserProfile(user, profile);
        }

        if (programId) {
            if (serverData) {
                // Guardar en caché para próximas aperturas
                try {
                    sessionStorage.setItem(`prog_${programId}`, JSON.stringify(serverData));
                    localStorage.setItem(`prog_${programId}`, JSON.stringify(serverData));
                } catch (_) {}

                // Comprobar permisos de colaborador
                if (serverData.ownerId !== user.uid) {
                    if (serverData.collaborators && serverData.collaborators[user.uid] === 'lector') {
                        window.applyReadOnlyMode("Lector");
                    }
                }

                // Si no hay cambios locales sin guardar y los datos difieren o no se cargó de caché:
                if (!hasUnsavedChanges) {
                    currentProgram = Program.fromFirestore(serverData);
                    escaletaUI.program = currentProgram;
                    const pt = document.getElementById('programTitle');
                    if (pt) pt.value = currentProgram.title;
                    escaletaUI.render();
                    onEscaletaUpdate();
                }
            } else if (!loadedFromCache) {
                Swal.fire('Error', 'No se pudo cargar el programa solicitado.', 'error');
            }
        } else {
            currentProgram.ownerId = user.uid;
        }

        isInitialized = true;
        hasUnsavedChanges = false;
    });

    // 4. Configurar Event Listeners UI
    const titleInput = document.getElementById('programTitle');
    titleInput.addEventListener('input', (e) => {
        currentProgram.title = e.target.value;
        if (isInitialized) {
            triggerAutoSave();
        }
    });
    titleInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            titleInput.blur();
        }
    });

    // Guardar automáticamente al hacer clic en el enlace de volver a Dashboard
    const backLink = document.querySelector('.logo a');
    if (backLink) {
        backLink.addEventListener('click', async (e) => {
            if (hasUnsavedChanges && !isReadOnly) {
                e.preventDefault();
                const targetUrl = backLink.href;
                clearTimeout(autoSaveTimer);
                try {
                    await saveCurrentProgram();
                } catch(err) {
                    console.error("Error guardando al salir:", err);
                }
                window.location.href = targetUrl;
            }
        });
    }

    // Toast helper
    function showToast(message) {
        Swal.fire({
            toast: true,
            position: 'bottom',
            icon: 'success',
            title: message,
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });
    }

    const btnSave = document.getElementById('btnSave');
    btnSave.addEventListener('click', async () => {
        clearTimeout(autoSaveTimer);
        const originalText = btnSave.innerHTML;
        try {
            btnSave.disabled = true;
            btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
            await saveCurrentProgram();
            btnSave.innerHTML = '<i class="fa-solid fa-check"></i> Guardado';
            setTimeout(() => {
                btnSave.disabled = false;
                btnSave.innerHTML = originalText;
            }, 2000);
            showToast("Programa guardado correctamente");
        } catch (e) {
            btnSave.disabled = false;
            btnSave.innerHTML = originalText;
            showToast("Error al guardar: " + e.message);
        }
    });

    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    document.getElementById('btnDownloadPdf').addEventListener('click', () => {
        ganttUI.render(currentProgram); // Renderizar por si no se había abierto antes
        downloadPDF('escaletaList', `${currentProgram.title}.pdf`);
    });


    // Configuración de Voces TTS (Global)
    window.availableVoices = [];
    function populateVoiceList() {
        if (typeof speechSynthesis === 'undefined') return;
        window.availableVoices = speechSynthesis.getVoices().filter(v => 
            v.lang.startsWith('es') || v.name.toLowerCase().includes('español') || v.name.toLowerCase().includes('spanish')
        );
        window.dispatchEvent(new Event('tts_voices_loaded'));
    }
    
    if (typeof speechSynthesis !== 'undefined') {
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = populateVoiceList;
        }
        setTimeout(populateVoiceList, 500); // Fallback
    }
    
    window.getVoiceByURI = function(uri) {
        if (!window.availableVoices || window.availableVoices.length === 0) return null;
        return window.availableVoices.find(v => v.voiceURI === uri) || window.availableVoices[0];
    };


    document.getElementById('btnAddText').addEventListener('click', () => {
        escaletaUI.addBlock('text');
    });

    // === ABRIR ESTUDIO EN DIRECTO ===
    document.getElementById('btnOpenStudio').addEventListener('click', async () => {
        // 1. Si el programa nunca se ha guardado, ofrecer guardar y entrar al Estudio
        if (!currentProgram.id) {
            const result = await Swal.fire({
                title: 'Guarda primero',
                text: 'Guarda el programa antes de abrirlo en el Estudio. ¿Quieres guardarlo ahora y entrar?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: '<i class="fa-solid fa-floppy-disk"></i> Guardar y entrar al Estudio',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#ff9800'
            });

            if (result.isConfirmed) {
                try {
                    Swal.fire({
                        title: 'Guardando...',
                        text: 'Preparando el Estudio en Directo...',
                        allowOutsideClick: false,
                        didOpen: () => {
                            Swal.showLoading();
                        }
                    });
                    const savedId = await saveCurrentProgram();
                    hasUnsavedChanges = false;
                    window.location.href = 'studio.html?id=' + savedId;
                } catch (e) {
                    Swal.fire('Error', 'Error al guardar el programa: ' + e.message, 'error');
                }
            }
            return;
        }

        // 2. Si el programa ya tiene ID pero hay cambios pendientes sin guardar
        if (hasUnsavedChanges) {
            const result = await Swal.fire({
                title: 'Cambios sin guardar',
                text: 'Tienes cambios sin guardar en la escaleta. ¿Deseas guardarlos antes de abrir el Estudio?',
                icon: 'question',
                showCancelButton: true,
                showDenyButton: true,
                confirmButtonText: '<i class="fa-solid fa-floppy-disk"></i> Guardar y entrar al Estudio',
                denyButtonText: 'Entrar sin guardar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#ff9800'
            });

            if (result.isConfirmed) {
                try {
                    Swal.fire({
                        title: 'Guardando...',
                        text: 'Preparando el Estudio en Directo...',
                        allowOutsideClick: false,
                        didOpen: () => {
                            Swal.showLoading();
                        }
                    });
                    const savedId = await saveCurrentProgram();
                    hasUnsavedChanges = false;
                    window.location.href = 'studio.html?id=' + savedId;
                } catch (e) {
                    Swal.fire('Error', 'Error al guardar el programa: ' + e.message, 'error');
                }
                return;
            } else if (result.isDenied) {
                hasUnsavedChanges = false;
                window.location.href = 'studio.html?id=' + currentProgram.id;
                return;
            } else {
                return; // Cancelar
            }
        }

        // 3. Ya está guardado y sin cambios pendientes
        window.location.href = 'studio.html?id=' + currentProgram.id;
    });

    document.getElementById('btnAddAudio').addEventListener('click', () => {
        openLibraryModal(null, (selected) => {
            window.addAudioWithTimeCalculation(selected.title, selected.url, selected.category);
        });
    });

    // Categorías de audio en el sidebar
    document.querySelectorAll('.audio-category').forEach(el => {
        el.addEventListener('click', () => {
            openLibraryModal(el.dataset.category, (selected) => {
                window.addAudioWithTimeCalculation(selected.title, selected.url, selected.category);
            });
        });
    });

    // Subir a Firebase Storage
    document.getElementById('btnUploadDrive').addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'audio/*';
        fileInput.onchange = async (e) => {
            if (!e.target.files.length) return;
            const file = e.target.files[0];
            const btn = document.getElementById('btnUploadDrive');
            try {
                const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

                // Detectar si el usuario venía desde el modal de Sintonías Precargadas
                const wantsPreloaded = (window._uploadCategoryPreset === 'sintonias_precargadas' || activeModalCategory === 'sintonias_precargadas');
                window._uploadCategoryPreset = null; // resetear preset

                // 1. Preguntar título, categoría y opción de Sintonía Precargada
                const catResult = await Swal.fire({
                    title: '<div style="color:#00acc1;display:flex;align-items:center;gap:8px;justify-content:center;"><i class="fa-solid fa-cloud-arrow-up"></i> Subir Audio</div>',
                    html: `
                        <div style="text-align:left;display:flex;flex-direction:column;gap:14px;padding:6px 0;">
                            <div>
                                <label style="font-size:13px;font-weight:600;color:#334155;display:block;margin-bottom:4px;">Nombre del audio:</label>
                                <input type="text" id="swalUploadTitle" value="${cleanName}" style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;">
                            </div>
                            <div>
                                <label style="font-size:13px;font-weight:600;color:#334155;display:block;margin-bottom:4px;">Canal / Categoría en la escaleta:</label>
                                <select id="swalUploadCat" style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;">
                                    <option value="sintonia" ${!wantsPreloaded ? 'selected' : ''}>🎙️ Sintonía (cabecera, ráfaga o cierre)</option>
                                    <option value="sintonias_precargadas" ${wantsPreloaded ? 'selected' : ''}>⭐ Sintonía Precargada (compartida para todos)</option>
                                    <option value="efectos">⚡ Efecto de sonido</option>
                                    <option value="musica">🎵 Música de fondo</option>
                                </select>
                            </div>
                            <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:8px;padding:12px;">
                                <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;font-size:13px;color:#166534;font-weight:600;">
                                    <input type="checkbox" id="swalAssignPreloaded" style="width:18px;height:18px;accent-color:#16a34a;margin-top:2px;" ${wantsPreloaded ? 'checked' : ''}>
                                    <div>
                                        <span>⭐ Asignar al paquete de Sintonías Precargadas</span>
                                        <div style="font-size:11px;font-weight:normal;color:#15803d;margin-top:3px;line-height:1.4;">
                                            Guardar en la biblioteca compartida para reutilizar en cualquier programa nuevo desde el botón "Sintonías precargadas".
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    `,
                    showCancelButton: true,
                    confirmButtonText: 'Subir y Añadir',
                    cancelButtonText: 'Cancelar',
                    confirmButtonColor: '#00acc1',
                    didOpen: () => {
                        const catSel = document.getElementById('swalUploadCat');
                        const check = document.getElementById('swalAssignPreloaded');
                        catSel.addEventListener('change', () => {
                            if (catSel.value === 'sintonias_precargadas') {
                                check.checked = true;
                            } else {
                                check.checked = false;
                            }
                        });
                    },
                    preConfirm: () => {
                        const title = document.getElementById('swalUploadTitle').value.trim() || cleanName;
                        const category = document.getElementById('swalUploadCat').value;
                        const assignPreloaded = document.getElementById('swalAssignPreloaded').checked;
                        return { title, category, assignPreloaded };
                    }
                });

                if (!catResult.isConfirmed) return;
                const { title: finalTitle, category: chosenCategory, assignPreloaded } = catResult.value;

                // 2. Mostrar modal interactivo con barra de progreso
                Swal.fire({
                    title: 'Subiendo audio...',
                    html: `
                        <div style="margin: 15px 0; text-align: left;">
                            <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:8px; color:#444;">
                                <span style="font-weight:bold; overflow:hidden; text-overflow:ellipsis; max-width:240px; white-space:nowrap;">${finalTitle}</span>
                                <span id="uploadPercent" style="font-weight:bold; color:#f06292;">0%</span>
                            </div>
                            <div style="background:#e0e0e0; border-radius:10px; height:12px; overflow:hidden; width:100%;">
                                <div id="uploadProgressBar" style="width:0%; height:100%; background:linear-gradient(90deg, #f06292, #00acc1); border-radius:10px; transition:width 0.2s ease;"></div>
                            </div>
                            <p id="uploadStatusText" style="font-size:12px; color:#777; margin-top:10px; text-align:center;">
                                <i class="fa-solid fa-cloud-arrow-up"></i> Transfiriendo archivo a la nube...
                            </p>
                        </div>
                    `,
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    showConfirmButton: false
                });

                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo...';

                // 3. Subir a Cloudinary con progreso en tiempo real
                const result = await cloudinaryService.uploadAudio(file, (percent) => {
                    const bar = document.getElementById('uploadProgressBar');
                    const text = document.getElementById('uploadPercent');
                    const status = document.getElementById('uploadStatusText');
                    if (bar) bar.style.width = percent + '%';
                    if (text) text.innerText = percent + '%';
                    if (percent >= 100 && status) {
                        status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando audio y calculando duración...';
                    }
                });

                // 4. Esperar a calcular duración y añadir el bloque
                const status = document.getElementById('uploadStatusText');
                if (status) status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Añadiendo a la escaleta...';

                const escaletaCat = (chosenCategory === 'sintonias_precargadas') ? 'sintonia' : chosenCategory;
                await window.addAudioWithTimeCalculation(finalTitle, result.url, escaletaCat);

                // 5. Guardar de forma inmediata e infalible en Sintonías Precargadas si aplica
                if (assignPreloaded || chosenCategory === 'sintonias_precargadas') {
                    // A. Guardar de inmediato en localStorage y memoria activa
                    const localSound = addPreloadedSoundLocally({
                        title: finalTitle,
                        url: result.url,
                        publicId: result.id || null,
                        icon: 'fa-star'
                    });

                    if (!sharedLibrary.sintonias_precargadas) {
                        sharedLibrary.sintonias_precargadas = [];
                    }
                    const alreadyInMem = sharedLibrary.sintonias_precargadas.some(s => s.url === result.url);
                    if (!alreadyInMem) {
                        sharedLibrary.sintonias_precargadas.unshift(localSound);
                    }

                    // B. Si el modal de sintonías precargadas está actualmente en pantalla, actualizarlo inmediatamente
                    const listWrapper = document.getElementById('modalAudioListWrapper');
                    if (listWrapper && listWrapper.style.display !== 'none' && activeModalCategory === 'sintonias_precargadas') {
                        renderCategoryAudioList('sintonias_precargadas', false);
                    }

                    // C. Intentar sincronizar con Firestore sounds en la nube
                    try {
                        const orderCount = sharedLibrary.sintonias_precargadas.length;
                        const newSoundId = await dbService.addSound({
                            title: finalTitle,
                            url: result.url,
                            publicId: result.id || null,
                            category: 'sintonias_precargadas',
                            icon: 'fa-star',
                            order: orderCount
                        });
                        if (newSoundId) {
                            localSound.docId = newSoundId;
                            addPreloadedSoundLocally(localSound);
                            console.log("Sintonía precargada registrada con éxito en Firestore:", newSoundId);
                        }
                    } catch (dbErr) {
                        console.warn("Aviso: No se pudo registrar en Firestore sounds (pero queda disponible localmente):", dbErr);
                    }

                    // D. Refrescar librería completa en segundo plano
                    loadSharedLibrary();
                }

                // 6. Confirmación final una vez visible en la escaleta
                Swal.fire({
                    icon: 'success',
                    title: '¡Audio añadido!',
                    html: `<b>"${finalTitle}"</b> se ha añadido a la escaleta${(assignPreloaded || chosenCategory === 'sintonias_precargadas') ? ' y guardado en <b>Sintonías Precargadas</b>' : ''}.`,
                    timer: 2200,
                    showConfirmButton: false
                });

            } catch (err) {
                console.error(err);
                Swal.fire("Error al subir", err.message || "Error desconocido al subir el archivo.", "error");
            } finally {
                btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Subir';
            }
        };
        fileInput.click();
    });
});

// Lógica de Modales
const modal = document.getElementById('libraryModal');
const closeBtn = document.querySelector('.close-modal');

// Lógica Modal Bibliotecas Externas
const externalLibsModal = document.getElementById('externalLibsModal');
const btnExternalLibs = document.getElementById('btnExternalLibs');
const closeExternalLibs = document.getElementById('closeExternalLibs');

if (btnExternalLibs) {
    btnExternalLibs.onclick = () => externalLibsModal.style.display = "block";
}
if (closeExternalLibs) {
    closeExternalLibs.onclick = () => externalLibsModal.style.display = "none";
}

// Lógica Modal Compartir
const shareModal = document.getElementById('shareModal');
const btnShare = document.getElementById('btnShare');
const closeShareModal = document.getElementById('closeShareModal');
const btnConfirmShare = document.getElementById('btnConfirmShare');

window.renderCollaborators = async function() {
    const list = document.getElementById('collaboratorsList');
    const loading = document.getElementById('collaboratorsLoading');
    list.innerHTML = '';
    loading.style.display = 'block';
    
    if (!currentProgram.collaborators || Object.keys(currentProgram.collaborators).length === 0) {
        loading.style.display = 'none';
        list.innerHTML = '<li style="color: #666; font-size: 13px; text-align: center;">No hay colaboradores aún.</li>';
        return;
    }
    
    const owner = await dbService.getUserProfile(currentProgram.ownerId);
    let html = `<li style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #f5f5f5; border-radius: 5px;">
        <span style="font-size: 14px;"><b>${owner ? owner.email : 'Dueño'}</b> <span style="color:#888; font-size: 12px;">(Propietario)</span></span>
    </li>`;

    for (const [uid, role] of Object.entries(currentProgram.collaborators)) {
        const user = await dbService.getUserProfile(uid);
        if (user) {
            html += `<li style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border: 1px solid #eee; border-radius: 5px;">
                <div style="display: flex; flex-direction: column;">
                    <span style="font-size: 14px;"><b>${user.email}</b></span>
                    <span style="font-size: 12px; color: #666; text-transform: capitalize;">${role}</span>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button class="btn btn-secondary btn-sm" onclick="changeCollaboratorRole('${uid}', '${role === 'editor' ? 'lector' : 'editor'}')" title="Cambiar a ${role === 'editor' ? 'Lector' : 'Editor'}" style="padding: 5px 8px; font-size: 12px; background: #e0e0e0; color: #333;"><i class="fa-solid fa-rotate"></i></button>
                    <button class="btn btn-secondary btn-sm" onclick="removeCollaborator('${uid}')" title="Quitar acceso" style="padding: 5px 8px; font-size: 12px; background: #ffebee; color: #d32f2f;"><i class="fa-solid fa-trash"></i></button>
                </div>
            </li>`;
        }
    }
    loading.style.display = 'none';
    list.innerHTML = html;
};

window.changeCollaboratorRole = async function(uid, newRole) {
    currentProgram.collaborators[uid] = newRole;
    try {
        await saveCurrentProgram();
        window.renderCollaborators();
    } catch(e) {
        Swal.fire("Error", e.message, "error");
    }
};

window.removeCollaborator = async function(uid) {
    delete currentProgram.collaborators[uid];
    try {
        await saveCurrentProgram();
        window.renderCollaborators();
    } catch(e) {
        Swal.fire("Error", e.message, "error");
    }
};

if (btnShare) {
    btnShare.onclick = () => {
        shareModal.style.display = "block";
        window.renderCollaborators();
    };
}
if (closeShareModal) {
    closeShareModal.onclick = () => shareModal.style.display = "none";
}

if (btnConfirmShare) {
    btnConfirmShare.onclick = async () => {
        const email = document.getElementById('shareEmail').value.trim();
        const role = document.getElementById('shareRole').value;
        if (!email) return;

        btnConfirmShare.innerText = "Buscando...";
        const collaborator = await dbService.getUserByEmail(email);
        
        if (collaborator) {
            if (!currentProgram.collaborators) currentProgram.collaborators = {};
            currentProgram.collaborators[collaborator.uid] = role;
            try {
                await saveCurrentProgram();
                document.getElementById('shareEmail').value = "";
                window.renderCollaborators();
            } catch (e) {
                Swal.fire("Error", "Error al compartir: " + e.message, "error");
            }
        } else {
            Swal.fire("Usuario no encontrado", `No se encontró ningún usuario con el correo ${email}. Debe iniciar sesión en Radioescaleta al menos una vez.`, "warning");
        }
        btnConfirmShare.innerText = "Invitar";
    };
}

let currentPreviewAudio = null;
let onSelectAudioCallback = null;

function stopPreviewAudio() {
    if (currentPreviewAudio) {
        try {
            currentPreviewAudio.pause();
            if (currentPreviewAudio._btn) {
                currentPreviewAudio._btn.innerHTML = '<i class="fa-solid fa-play"></i>';
            }
        } catch (e) {}
        currentPreviewAudio = null;
    }
}

// Cerrar modal de librería de audios
const closeLibraryModalBtn = document.getElementById('closeLibraryModal');
if (closeLibraryModalBtn) {
    closeLibraryModalBtn.onclick = function() {
        stopPreviewAudio();
        modal.style.display = "none";
    };
}
if (closeBtn) {
    closeBtn.onclick = function() {
        stopPreviewAudio();
        modal.style.display = "none";
    };
}

// Botón volver a categorías dentro del modal
const modalBtnBack = document.getElementById('modalBtnBack');
if (modalBtnBack) {
    modalBtnBack.onclick = function() {
        openLibraryModal(null, onSelectAudioCallback);
    };
}

// Botón crear audio vacío personalizado
const btnCreateBlankAudio = document.getElementById('btnCreateBlankAudio');
if (btnCreateBlankAudio) {
    btnCreateBlankAudio.onclick = function() {
        stopPreviewAudio();
        modal.style.display = "none";
        escaletaUI.addBlock('audio');
    };
}

// Opciones del selector de categorías (Sintonías, Música de fondo, Sintonías precargadas)
document.querySelectorAll('.audio-type-option').forEach(opt => {
    opt.onclick = function() {
        renderCategoryAudioList(opt.dataset.cat);
    };
});

// Pestañas de categorías dentro del modal
document.querySelectorAll('.modal-cat-tab').forEach(tab => {
    tab.onclick = function() {
        renderCategoryAudioList(tab.dataset.cat);
    };
});

window.onclick = function(event) {
    if (event.target == modal) {
        stopPreviewAudio();
        modal.style.display = "none";
    }
    if (event.target == externalLibsModal) {
        externalLibsModal.style.display = "none";
    }
    if (event.target == shareModal) {
        shareModal.style.display = "none";
    }
};

function openLibraryModal(category = null, onSelect = null) {
    stopPreviewAudio();
    if (onSelect) {
        onSelectAudioCallback = onSelect;
    } else if (!onSelectAudioCallback) {
        onSelectAudioCallback = (selected) => {
            window.addAudioWithTimeCalculation(selected.title, selected.url, selected.category);
        };
    }

    // Refrescar la librería de sonidos en segundo plano para asegurar que siempre esté actualizada
    loadSharedLibrary();

    const chooserView = document.getElementById('modalCategoryChooser');
    const listWrapper = document.getElementById('modalAudioListWrapper');
    const tabsBar = document.getElementById('modalTabsBar');
    const btnBack = document.getElementById('modalBtnBack');
    const modalTitle = document.getElementById('modalTitle');

    if (!category) {
        activeModalCategory = null;
        // Modo selector: Elegir entre Sintonías, Música de fondo o Sintonías precargadas
        if (chooserView) chooserView.style.display = 'block';
        if (listWrapper) listWrapper.style.display = 'none';
        if (tabsBar) tabsBar.style.display = 'none';
        if (btnBack) btnBack.style.display = 'none';
        if (modalTitle) modalTitle.innerHTML = '<i class="fa-solid fa-volume-high" style="color: #00acc1;"></i> Añadir Bloque de Audio';
    } else {
        // Desplegar directamente la categoría elegida
        renderCategoryAudioList(category);
    }

    modal.style.display = "block";
}

function renderCategoryAudioList(category, reloadIfEmpty = true) {
    stopPreviewAudio();
    activeModalCategory = category;

    const chooserView = document.getElementById('modalCategoryChooser');
    const listWrapper = document.getElementById('modalAudioListWrapper');
    const tabsBar = document.getElementById('modalTabsBar');
    const btnBack = document.getElementById('modalBtnBack');
    const modalTitle = document.getElementById('modalTitle');
    const list = document.getElementById('libraryList');

    if (chooserView) chooserView.style.display = 'none';
    if (listWrapper) listWrapper.style.display = 'block';
    if (tabsBar) tabsBar.style.display = 'flex';
    if (btnBack) btnBack.style.display = 'inline-flex';

    // Actualizar tabs activas
    document.querySelectorAll('.modal-cat-tab').forEach(tab => {
        if (tab.dataset.cat === category) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    const isPreloaded = (category === 'sintonias_precargadas' || category === 'sintonias-precargadas');
    const titleMap = {
        'sintonias': 'Sintonías',
        'sintonias_precargadas': 'Sintonías precargadas',
        'sintonias-precargadas': 'Sintonías precargadas',
        'efectos': 'Efectos de Sonido',
        'musica': 'Música de Fondo'
    };
    if (modalTitle) {
        modalTitle.innerHTML = `<i class="fa-solid fa-volume-high" style="color: #00acc1;"></i> ${titleMap[category] || 'Seleccionar Audio'}`;
    }

    const actualCategory = (category === 'musica') ? 'musica' : 'sintonia';

    let items = [];
    if (isPreloaded) {
        const localList = getStoredPreloadedSounds();
        const memList = (sharedLibrary && Array.isArray(sharedLibrary.sintonias_precargadas)) ? sharedLibrary.sintonias_precargadas : [];
        const combined = [...memList];
        localList.forEach(l => {
            if (!combined.some(c => (l.url && c.url === l.url) || (l.title && c.title === l.title))) {
                combined.push(l);
            }
        });
        items = combined;
        sharedLibrary.sintonias_precargadas = combined;
    } else {
        if (sharedLibrary && Array.isArray(sharedLibrary[category])) {
            // Mostramos exactamente los audios de Firestore (respetando los audios borrados por el usuario)
            items = [...sharedLibrary[category]];
        } else {
            // Solo si no hay Firestore (modo demo / sin conexión), usamos los predeterminados locales
            items = defaultLibrary[category] ? [...defaultLibrary[category]] : [];
        }
    }

    // Si la lista está vacía o es preloaded, pedir datos frescos a Firestore
    if (reloadIfEmpty && (items.length === 0 || isPreloaded)) {
        if (items.length === 0) {
            list.innerHTML = `
                <div style="text-align:center; padding:35px 20px; color:#64748b;">
                    <i class="fa-solid fa-spinner fa-spin" style="font-size:26px; color:#00acc1; margin-bottom:10px; display:block;"></i>
                    <p style="font-size:13px; font-weight:600; color:#334155; margin:0;">Cargando sintonías de la biblioteca...</p>
                </div>
            `;
        }
        loadSharedLibrary().then(() => {
            if (activeModalCategory === category) {
                renderCategoryAudioList(category, false);
            }
        });
        if (items.length === 0) return;
    }

    list.innerHTML = '';
    if (items.length === 0) {
        if (isPreloaded) {
            // Comprobar si hay bloques de audio ya existentes en esta escaleta para importarlos con 1 clic
            const escaletaAudios = (currentProgram && Array.isArray(currentProgram.blocks))
                ? currentProgram.blocks.filter(b => b.type === 'audio' && b.audioUrl)
                : [];

            let importHtml = '';
            if (escaletaAudios.length > 0) {
                importHtml = `
                    <div style="margin-top:16px; padding:12px 14px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; text-align:left;">
                        <p style="font-size:12px; font-weight:700; color:#166534; margin:0 0 6px 0; display:flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-wand-magic-sparkles" style="color:#16a34a;"></i> Audios detectados en esta escaleta:
                        </p>
                        <p style="font-size:11px; color:#15803d; margin:0 0 10px 0;">
                            Puedes añadir cualquiera de estos audios a tu lista de sintonías precargadas con un clic:
                        </p>
                        <div style="display:flex; flex-direction:column; gap:6px;">
                            ${escaletaAudios.map((b, idx) => `
                                <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; padding:6px 10px; border-radius:6px; border:1px solid #dcfce7;">
                                    <span style="font-size:12px; font-weight:600; color:#1f2937; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:240px;">
                                        <i class="fa-solid fa-music" style="color:#00acc1; margin-right:6px;"></i>${b.title || 'Audio ' + (idx + 1)}
                                    </span>
                                    <button type="button" class="btn-import-escaleta-audio" data-title="${encodeURIComponent(b.title || '')}" data-url="${encodeURIComponent(b.audioUrl || '')}" style="background:#16a34a; color:#fff; border:none; padding:4px 10px; border-radius:5px; font-size:11px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                                        <i class="fa-solid fa-star"></i> Añadir a precargadas
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            list.innerHTML = `
                <div style="text-align:center; padding:30px 20px; color:#64748b; background:#f8fafc; border-radius:10px; border:1px dashed #cbd5e1; margin:10px 0;">
                    <i class="fa-solid fa-star" style="font-size:32px; color:#f59e0b; margin-bottom:10px; display:block;"></i>
                    <p style="font-size:15px; font-weight:600; color:#334155; margin:0 0 6px 0;">(Aún no hay sintonías precargadas)</p>
                    <p style="font-size:12px; color:#64748b; margin:0 0 14px 0; line-height:1.4;">
                        Los profesores pueden subir melodías desde el botón <b>«Subir»</b> y marcarlas como sintonía precargada para que aparezcan aquí disponibles para todos.
                    </p>
                    <button type="button" id="btnUploadInPreloadedEmpty" style="background:linear-gradient(135deg, #00acc1, #00838f); color:white; border:none; padding:8px 16px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-cloud-arrow-up"></i> Subir sintonía precargada ahora
                    </button>
                    ${importHtml}
                </div>
            `;
            const btnUp = document.getElementById('btnUploadInPreloadedEmpty');
            if (btnUp) {
                btnUp.onclick = () => {
                    window._uploadCategoryPreset = 'sintonias_precargadas';
                    const btnUploadDrive = document.getElementById('btnUploadDrive');
                    if (btnUploadDrive) btnUploadDrive.click();
                };
            }

            list.querySelectorAll('.btn-import-escaleta-audio').forEach(btn => {
                btn.onclick = async () => {
                    const soundTitle = decodeURIComponent(btn.dataset.title);
                    const soundUrl = decodeURIComponent(btn.dataset.url);
                    const localItem = addPreloadedSoundLocally({
                        title: soundTitle,
                        url: soundUrl,
                        icon: 'fa-star'
                    });
                    if (!sharedLibrary.sintonias_precargadas) sharedLibrary.sintonias_precargadas = [];
                    sharedLibrary.sintonias_precargadas.unshift(localItem);
                    dbService.addSound({
                        title: soundTitle,
                        url: soundUrl,
                        category: 'sintonias_precargadas',
                        icon: 'fa-star',
                        order: sharedLibrary.sintonias_precargadas.length
                    }).catch(e => console.warn("Aviso Firestore:", e));
                    renderCategoryAudioList('sintonias_precargadas', false);
                    Swal.fire({
                        icon: 'success',
                        title: '¡Sintonía precargada guardada!',
                        text: `"${soundTitle}" ya está disponible en sintonías precargadas para todos los programas.`,
                        timer: 2000,
                        showConfirmButton: false
                    });
                };
            });
        } else {
            list.innerHTML = '<li style="color:#aaa; padding:15px; text-align:center;">No hay audios disponibles en esta categoría.</li>';
        }
    } else {
        if (isPreloaded) {
            // Barra superior con botón rápido para subir más sintonías precargadas
            const headerRow = document.createElement('div');
            headerRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding:6px 10px; background:#f8fafc; border-radius:6px; border:1px solid #e2e8f0;';
            headerRow.innerHTML = `
                <span style="font-size:12px; color:#475569; font-weight:600;"><i class="fa-solid fa-star" style="color:#f59e0b;"></i> ${items.length} sintonía(s) precargada(s)</span>
                <button type="button" id="btnUploadMorePreloaded" style="background:#00acc1; color:white; border:none; border-radius:5px; padding:4px 10px; font-size:11px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
                    <i class="fa-solid fa-plus"></i> Subir otra sintonía
                </button>
            `;
            list.appendChild(headerRow);
            const btnMore = headerRow.querySelector('#btnUploadMorePreloaded');
            if (btnMore) {
                btnMore.onclick = () => {
                    window._uploadCategoryPreset = 'sintonias_precargadas';
                    const btnUploadDrive = document.getElementById('btnUploadDrive');
                    if (btnUploadDrive) btnUploadDrive.click();
                };
            }
        }

        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'library-item';

            const iconClass = item.icon || ((actualCategory === 'musica') ? 'fa-headphones' : 'fa-music');
            const iconColor = isPreloaded ? '#f59e0b' : ((actualCategory === 'musica') ? '#0d9488' : '#e11d48');
            const icon = `<i class="fa-solid ${iconClass}" style="margin-right:10px; color:${iconColor}; width:18px; text-align:center;"></i>`;

            const span = document.createElement('span');
            span.style.cssText = 'font-weight: 500; font-size: 14px; color: #1e293b; display: flex; align-items: center;';
            span.innerHTML = icon + item.title;

            // Mini play button
            const btnPlay = document.createElement('button');
            btnPlay.type = 'button';
            btnPlay.className = 'btn btn-secondary';
            btnPlay.style.cssText = 'padding:6px 10px; font-size:12px; background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; border-radius:6px; cursor:pointer;';
            btnPlay.innerHTML = '<i class="fa-solid fa-play"></i>';

            btnPlay.onclick = (e) => {
                e.stopPropagation();
                if (currentPreviewAudio && currentPreviewAudio._btn === btnPlay) {
                    stopPreviewAudio();
                    btnPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
                    return;
                }
                stopPreviewAudio();
                const playUrl = (item.url || '').replace('res.cloudinary.com', 'res-1.cloudinary.com');
                const audio = new Audio(playUrl);
                audio._btn = btnPlay;
                currentPreviewAudio = audio;
                btnPlay.innerHTML = '<i class="fa-solid fa-stop"></i>';
                audio.play().catch(err => console.error("Error pre-escucha", err));
                audio.onended = () => {
                    btnPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
                    currentPreviewAudio = null;
                };
            };

            const btnUse = document.createElement('button');
            btnUse.type = 'button';
            btnUse.className = 'btn btn-primary';
            btnUse.style.cssText = 'padding:6px 14px; font-size:12px; font-weight:600; border-radius:6px; cursor:pointer;';
            btnUse.innerText = 'Usar';
            btnUse.onclick = () => {
                stopPreviewAudio();
                const soundUrl = (item.url || '').replace('res.cloudinary.com', 'res-1.cloudinary.com');
                modal.style.display = 'none';
                if (onSelectAudioCallback) {
                    onSelectAudioCallback({ category: actualCategory, title: item.title, url: soundUrl });
                }
            };

            const actions = document.createElement('div');
            actions.style.cssText = 'display:flex; align-items:center; gap:8px;';
            actions.appendChild(btnPlay);
            actions.appendChild(btnUse);

            if (isPreloaded) {
                const btnDel = document.createElement('button');
                btnDel.type = 'button';
                btnDel.className = 'btn btn-secondary';
                btnDel.style.cssText = 'padding:6px 10px; font-size:12px; background:#fff1f2; color:#e11d48; border:1px solid #fecdd3; border-radius:6px; cursor:pointer; margin-left:2px;';
                btnDel.title = 'Quitar de sintonías precargadas';
                btnDel.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
                btnDel.onclick = async (e) => {
                    e.stopPropagation();
                    const conf = await Swal.fire({
                        title: `¿Quitar "${item.title}"?`,
                        text: 'Se eliminará de la lista de sintonías precargadas.',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Sí, quitar',
                        confirmButtonColor: '#e11d48',
                        cancelButtonText: 'Cancelar'
                    });
                    if (conf.isConfirmed) {
                        const curLocal = getStoredPreloadedSounds().filter(s => s.url !== item.url && s.title !== item.title);
                        saveStoredPreloadedSounds(curLocal);
                        sharedLibrary.sintonias_precargadas = sharedLibrary.sintonias_precargadas.filter(s => s.url !== item.url && s.title !== item.title);
                        if (item.docId && !String(item.docId).startsWith('local_')) {
                            dbService.deleteSound(item.docId).catch(err => console.warn("Aviso Firestore al borrar:", err));
                        }
                        renderCategoryAudioList('sintonias_precargadas', false);
                    }
                };
                actions.appendChild(btnDel);
            }

            li.appendChild(span);
            li.appendChild(actions);
            list.appendChild(li);
        });
    }
}

// ──────────────────────────────────────────────
//  BOTONERA DE EFECTOS (EDITOR)
// ──────────────────────────────────────────────
const DEFAULT_SOUNDBOARD_KEYS = ['Q', 'W', 'E', 'R', 'T', 'Y'];

function renderEditorSoundboard() {
    const grid = document.getElementById('editorSoundboardGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const pads = currentProgram.soundboard || DEFAULT_SOUNDBOARD;

    pads.forEach((pad, index) => {
        const assignedKey = (pad.key && !/^[1-6]$/.test(pad.key) && !/^F[1-6]$/i.test(pad.key))
            ? pad.key
            : (DEFAULT_SOUNDBOARD_KEYS[index] || 'Q');
        pad.key = assignedKey;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'editor-soundboard-pad';
        btn.style.setProperty('--pad-color', pad.color || '#ef4444');
        btn.title = `Botón ${index + 1} (Tecla: ${assignedKey}): ${pad.name}. Clic para configurar`;

        btn.innerHTML = `
            <div class="pad-shortcut">${assignedKey}</div>
            <div class="pad-icon"><i class="fa-solid ${pad.icon || 'fa-bolt'}"></i></div>
            <div class="pad-name">${pad.name || 'Sin asignar'}</div>
        `;

        btn.addEventListener('click', () => {
            openConfigureSoundboardModal(pad, index);
        });

        grid.appendChild(btn);
    });
}

function openConfigureSoundboardModal(pad, index) {
    const library = sharedLibrary || defaultLibrary;
    const allEffects = library.efectos || defaultLibrary.efectos || [];

    let optionsHtml = '';
    allEffects.forEach(ef => {
        const isSelected = (pad.name === ef.title) || (pad.url && pad.url.includes(ef.title));
        optionsHtml += `<option value="${ef.url}" data-title="${ef.title}" data-icon="${ef.icon || 'fa-bolt'}" ${isSelected ? 'selected' : ''}>${ef.title}</option>`;
    });

    const currentKey = (pad.key && !/^[1-6]$/.test(pad.key) && !/^F[1-6]$/i.test(pad.key))
        ? pad.key
        : (DEFAULT_SOUNDBOARD_KEYS[index] || 'Q');

    Swal.fire({
        title: `<div style="color:${pad.color || '#00acc1'};display:flex;align-items:center;gap:8px;justify-content:center;"><i class="fa-solid fa-bullhorn"></i> Configurar Botón ${index + 1}</div>`,
        html: `
            <div style="text-align:left;display:flex;flex-direction:column;gap:12px;padding:6px 0;">
                <div>
                    <label style="font-size:12px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Efecto de sonido asignado:</label>
                    <div style="display:flex;gap:8px;">
                        <select id="padSoundSelect" style="flex:1;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;">
                            ${optionsHtml}
                        </select>
                        <button type="button" id="btnPreviewPad" class="btn" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;padding:6px 12px;border-radius:6px;font-size:13px;cursor:pointer;">
                            <i class="fa-solid fa-play"></i> Probar
                        </button>
                    </div>
                </div>
                <div style="display:flex;gap:10px;">
                    <div style="flex:2;">
                        <label style="font-size:12px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Etiqueta en el botón:</label>
                        <input type="text" id="padNameInput" value="${pad.name}" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;">
                    </div>
                    <div style="flex:1;">
                        <label style="font-size:12px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Tecla rápida:</label>
                        <input type="text" id="padKeyInput" maxlength="3" value="${currentKey}" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;text-align:center;font-weight:bold;text-transform:uppercase;" placeholder="${DEFAULT_SOUNDBOARD_KEYS[index] || 'Q'}">
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Guardar en Botonera',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: pad.color || '#00acc1',
        didOpen: () => {
            const sel = document.getElementById('padSoundSelect');
            const nameInput = document.getElementById('padNameInput');
            const btnPreview = document.getElementById('btnPreviewPad');
            let testAudio = null;

            sel.addEventListener('change', () => {
                const opt = sel.options[sel.selectedIndex];
                if (opt) {
                    nameInput.value = opt.dataset.title || opt.text;
                }
            });

            btnPreview.addEventListener('click', () => {
                if (testAudio && !testAudio.paused) {
                    testAudio.pause();
                    testAudio = null;
                    btnPreview.innerHTML = '<i class="fa-solid fa-play"></i> Probar';
                    return;
                }
                const url = sel.value;
                if (!url) return;
                testAudio = new Audio(url.replace('res.cloudinary.com', 'res-1.cloudinary.com'));
                testAudio.play().then(() => {
                    btnPreview.innerHTML = '<i class="fa-solid fa-stop"></i> Detener';
                }).catch(e => console.warn(e));
                testAudio.onended = () => {
                    btnPreview.innerHTML = '<i class="fa-solid fa-play"></i> Probar';
                    testAudio = null;
                };
            });
        }
    }).then(res => {
        if (res.isConfirmed) {
            const sel = document.getElementById('padSoundSelect');
            const opt = sel.options[sel.selectedIndex];
            const newName = document.getElementById('padNameInput').value.trim() || (opt ? opt.text : `FX ${index + 1}`);
            const newKey = document.getElementById('padKeyInput').value.trim().toUpperCase() || (DEFAULT_SOUNDBOARD_KEYS[index] || 'Q');
            const newUrl = sel.value;
            const newIcon = opt ? (opt.dataset.icon || 'fa-bolt') : 'fa-bolt';

            if (!currentProgram.soundboard) {
                currentProgram.soundboard = JSON.parse(JSON.stringify(DEFAULT_SOUNDBOARD));
            }

            currentProgram.soundboard[index] = {
                ...currentProgram.soundboard[index],
                name: newName,
                key: newKey,
                url: newUrl,
                icon: newIcon
            };

            renderEditorSoundboard();
            if (typeof onEscaletaUpdate === 'function') {
                onEscaletaUpdate();
            }
        }
    });
}



window.addAudioWithTimeCalculation = function(title, rawUrl, category) {
    return new Promise((resolve) => {
        const url = (rawUrl || '').replace('res.cloudinary.com', 'res-1.cloudinary.com');
        import('./utils/timeUtils.js').then(module => {
            const audio = new Audio(url);
            let settled = false;

            const addAndResolve = (durSec = 0) => {
                if (settled) return;
                settled = true;

                let maxEnd = 0;
                currentProgram.blocks.forEach(b => {
                    const e = module.timeToSeconds(b.endTime);
                    if (e > maxEnd) maxEnd = e;
                });
                
                const startSec = maxEnd;
                const endSec = durSec > 0 ? Math.floor(startSec + durSec) : startSec;
                
                escaletaUI.addBlock('audio', {
                    title: title,
                    audioUrl: url,
                    category: category,
                    startTime: module.secondsToTime(startSec),
                    endTime: module.secondsToTime(endSec),
                    maxDuration: durSec
                });

                resolve();
            };

            audio.onloadedmetadata = () => addAndResolve(audio.duration || 0);
            audio.onerror = () => addAndResolve(0);
            setTimeout(() => addAndResolve(0), 4000);
        });
    });
};
