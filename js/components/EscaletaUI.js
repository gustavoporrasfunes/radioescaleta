import { TextBlock, AudioBlock } from "../models/Block.js";
import { formatTime, timeToSeconds, secondsToTime } from "../utils/timeUtils.js";

export class EscaletaUI {
    constructor(containerId, program, onUpdateCallback) {
        this.container = document.getElementById(containerId);
        this.program = program;
        this.onUpdateCallback = onUpdateCallback;
        this.initSortable();
    }

    initSortable() {
        if (typeof Sortable !== 'undefined') {
            this.sortable = Sortable.create(this.container, {
                animation: 150,
                scroll: true,
                scrollSensitivity: 50,
                scrollSpeed: 15,
                bubbleScroll: true,
                handle: '.block-time-container, .speaker-row, .block-drag-handle',
                onEnd: () => {
                    this.updateOrderFromDOM();
                }
            });
        }
    }

    setSortable(enabled) {
        if (this.sortable) {
            this.sortable.option('disabled', !enabled);
        }
    }

    syncFullProgramDurations() {
        let maxSec = 0;
        this.program.blocks.forEach(b => {
            if (!b.isFullProgram) {
                const eSec = timeToSeconds(b.endTime || b.duration || b.startTime);
                if (eSec > maxSec) maxSec = eSec;
            }
        });
        if (maxSec <= 0) maxSec = 60; // Mínimo 1 minuto
        const maxTimeStr = secondsToTime(maxSec);
        
        this.program.blocks.forEach(b => {
            if (b.isFullProgram) {
                b.startTime = "00:00";
                b.endTime = maxTimeStr;
            }
        });
    }

    addBlock(type, data = {}) {
        let block;
        
        // Calcular tiempo de inicio secuencial por defecto según el final del bloque anterior
        let defaultStart = "00:00";
        if (this.program.blocks.length > 0) {
            const regularBlocks = this.program.blocks.filter(b => !b.isFullProgram);
            if (regularBlocks.length > 0) {
                const last = regularBlocks[regularBlocks.length - 1];
                defaultStart = last.endTime || last.startTime || "00:00";
            }
        }
        const startTime = data.startTime || defaultStart;

        if (type === 'text') {
            const initialText = data.content || "Nuevo guión de radio...";
            block = new TextBlock(initialText, null, data.speaker || "");
            block.startTime = startTime;

            // Calcular duración estimada basada en 130 palabras por minuto
            const words = initialText.trim().split(/\s+/).filter(w => w.length > 0).length;
            const estSec = Math.max(3, Math.round((words / 130) * 60));
            block.endTime = data.endTime || secondsToTime(timeToSeconds(startTime) + estSec);
        } else if (type === 'audio') {
            const isFull = !!data.isFullProgram;
            block = new AudioBlock(
                data.category || 'sintonia', 
                data.title || "Audio", 
                data.url || data.audioUrl || "", 
                '', 
                null, 
                data.maxDuration || 0,
                isFull
            );
            if (isFull) {
                block.isFullProgram = true;
                block.isBackground = true;
                block.startTime = "00:00";
            } else {
                block.startTime = startTime;
                const dur = data.maxDuration ? Math.round(data.maxDuration) : 10;
                block.endTime = data.endTime || secondsToTime(timeToSeconds(startTime) + dur);
            }
        }
        
        if (block) {
            this.program.addBlock(block);
            this.syncFullProgramDurations();
            this.render();
            this.notifyUpdate();

            requestAnimationFrame(() => {
                const escaletaContainer = document.getElementById('escaletaContainer');
                if (escaletaContainer) {
                    escaletaContainer.scrollTo({
                        top: escaletaContainer.scrollHeight,
                        behavior: 'smooth'
                    });
                }
            });
        }
    }

    removeBlock(id) {
        this.program.removeBlock(id);
        this.syncFullProgramDurations();
        this.render();
        this.notifyUpdate();
    }

    highlightLiveBlocks(currentSeconds) {
        Array.from(this.container.children).forEach(el => {
            const blockId = el.dataset.id;
            const block = this.program.blocks.find(b => b.id === blockId);
            if (block) {
                const startSec = timeToSeconds(block.startTime);
                const endSec = timeToSeconds(block.endTime || block.duration || block.startTime);
                
                if (currentSeconds >= startSec && currentSeconds < endSec) {
                    el.classList.add('live-active');
                } else {
                    el.classList.remove('live-active');
                }
            }
        });
    }

    updateOrderFromDOM() {
        const orderIds = Array.from(this.container.children).map(el => el.dataset.id);
        this.program.updateBlockOrder(orderIds);
        this.syncFullProgramDurations();
        this.notifyUpdate();
    }

    notifyUpdate() {
        if (this.onUpdateCallback) {
            this.onUpdateCallback();
        }
    }

    render() {
        this.container.innerHTML = '';
        this.syncFullProgramDurations();

        this.program.blocks.forEach(block => {
            const el = document.createElement('div');
            el.className = `escaleta-block ${block.type}`;
            if (block.type === 'audio') {
                el.classList.add(`audio-${block.category}`);
            }
            if (block.isFullProgram) {
                el.classList.add('full-program-block');
            }
            el.dataset.id = block.id;

            // === TIEMPOS (INICIO / FIN / DURACIÓN) ===
            const timeContainer = document.createElement('div');
            timeContainer.className = 'block-time-container';
            
            const startInput = document.createElement('input');
            startInput.type = 'text';
            startInput.className = 'time-input';
            startInput.placeholder = '00:00';
            startInput.title = 'Inicio (MM:SS)';
            startInput.value = block.startTime;

            const endInput = document.createElement('input');
            endInput.type = 'text';
            endInput.className = 'time-input';
            endInput.placeholder = '00:00';
            endInput.title = 'Fin (MM:SS)';
            endInput.value = block.endTime || "00:00";

            if (block.isFullProgram) {
                startInput.disabled = true;
                endInput.disabled = true;
                startInput.title = 'Fijo al inicio';
                endInput.title = 'Ajustado a la duración total';
            }

            const durationSpan = document.createElement('span');
            durationSpan.style.cssText = 'font-size: 11px; color: #64748b; align-self: center; min-width: 45px; font-weight: 500;';

            const updateDurationDisplay = () => {
                if (block.isFullProgram) {
                    durationSpan.innerText = '(Todo)';
                    return;
                }
                const s = timeToSeconds(block.startTime);
                const e = timeToSeconds(block.endTime);
                let d = e - s;
                if (d < 0) d = 0;
                durationSpan.innerText = `(${secondsToTime(d)})`;
            };
            updateDurationDisplay();

            const applyStartTime = (rawVal) => {
                const valid = formatTime(rawVal);
                if (valid) {
                    startInput.value = valid;
                    block.startTime = valid;
                    startInput.style.borderColor = 'rgba(0,0,0,0.2)';
                } else {
                    startInput.value = block.startTime; 
                    startInput.style.borderColor = 'red';
                }
                this.syncFullProgramDurations();
                updateDurationDisplay();
                this.notifyUpdate();
            };

            startInput.addEventListener('change', (e) => applyStartTime(e.target.value));
            startInput.addEventListener('blur', (e) => applyStartTime(e.target.value));
            startInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') startInput.blur();
            });

            const applyEndTime = (rawVal) => {
                const valid = formatTime(rawVal);
                if (valid) {
                    const newEndSec = timeToSeconds(valid);
                    const startSec = timeToSeconds(block.startTime);
                    const requestedDuration = newEndSec - startSec;

                    if (block.type === 'audio' && block.maxDuration && requestedDuration > block.maxDuration) {
                        Swal.fire({
                            toast: true,
                            position: "bottom",
                            icon: "warning",
                            title: `Audio acortado: el archivo físico solo dura ${secondsToTime(block.maxDuration)}.`,
                            showConfirmButton: false,
                            timer: 3500
                        });
                        block.endTime = secondsToTime(startSec + block.maxDuration);
                        endInput.value = block.endTime;
                    } else if (newEndSec < startSec) {
                        block.endTime = block.startTime;
                        endInput.value = block.endTime;
                    } else {
                        endInput.value = valid;
                        block.endTime = valid;
                        endInput.style.borderColor = 'rgba(0,0,0,0.2)';
                    }
                } else {
                    endInput.value = block.endTime; 
                    endInput.style.borderColor = 'red';
                }
                this.syncFullProgramDurations();
                updateDurationDisplay();
                this.notifyUpdate();
            };

            endInput.addEventListener('change', (e) => applyEndTime(e.target.value));
            endInput.addEventListener('blur', (e) => applyEndTime(e.target.value));
            endInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') endInput.blur();
            });

            timeContainer.appendChild(startInput);
            timeContainer.appendChild(endInput);
            timeContainer.appendChild(durationSpan);

            // === CONTENEDOR CENTRAL DEL BLOQUE ===
            const contentContainer = document.createElement('div');
            contentContainer.style.flex = '1';
            contentContainer.style.display = 'flex';
            contentContainer.style.flexDirection = 'column';
            contentContainer.style.gap = '6px';
            contentContainer.style.minWidth = '0';
            contentContainer.style.overflow = 'hidden';

            if (block.type === 'text') {
                // 1) CAMPO LOCUTOR / RESPONSABLE DE LECTURA
                const speakerRow = document.createElement('div');
                speakerRow.className = 'speaker-row';
                speakerRow.style.cssText = 'display:flex; align-items:center; gap:8px;';
                
                const speakerBadge = document.createElement('span');
                speakerBadge.style.cssText = 'font-size:11px; font-weight:700; color:#0284c7; background:#e0f2fe; padding:3px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px; flex-shrink:0;';
                speakerBadge.innerHTML = '<i class="fa-solid fa-microphone-lines"></i> Locutor/a:';
                
                const speakerInput = document.createElement('input');
                speakerInput.type = 'text';
                speakerInput.className = 'speaker-input';
                speakerInput.placeholder = 'Alumno/a responsable (ej. Laura)...';
                speakerInput.value = block.speaker || '';
                speakerInput.title = 'Escribe aquí el alumno/a que leerá este bloque';
                speakerInput.style.cssText = 'padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px; width:220px; font-weight:500; background:#ffffff; outline:none; transition:border 0.2s;';
                speakerInput.onfocus = () => speakerInput.style.borderColor = '#0284c7';
                speakerInput.onblur = () => speakerInput.style.borderColor = '#cbd5e1';

                speakerInput.addEventListener('input', (e) => {
                    block.speaker = e.target.value;
                    this.notifyUpdate();
                });

                speakerRow.appendChild(speakerBadge);
                speakerRow.appendChild(speakerInput);
                contentContainer.appendChild(speakerRow);

                // 2) PREVIEW Y POPUP DE REDACCIÓN DEL GUIÓN
                const textPreview = document.createElement('div');
                textPreview.className = 'block-content text-preview';
                textPreview.style.cssText = 'padding:8px 12px; background:rgba(255,255,255,0.85); border:1px solid rgba(0,0,0,0.15); border-radius:6px; cursor:pointer; min-height:36px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; width:100%; box-sizing:border-box; flex:1; font-size:13px; color:#1e293b; transition:all 0.2s;';
                
                const helper = document.createElement('small');
                helper.style.cssText = 'color:#64748b; font-size:11px; display:flex; align-items:center; gap:6px;';
                
                const updateView = () => {
                    const txt = block.content || '✏️ Haz clic aquí para escribir el guión...';
                    textPreview.innerText = txt;
                    
                    const words = (block.content || "").trim().split(/\s+/).filter(w => w.length > 0).length;
                    const sec = Math.max(2, Math.round((words / 130) * 60));
                    helper.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> Lectura est.: <b style="color:#0284c7;">${secondsToTime(sec)}</b> (${words} palabras a 130 pal/min)`;
                };
                updateView();

                textPreview.addEventListener('mouseover', () => {
                    textPreview.style.background = '#ffffff';
                    textPreview.style.borderColor = '#0284c7';
                    textPreview.style.boxShadow = '0 2px 4px rgba(2,132,199,0.15)';
                });
                textPreview.addEventListener('mouseout', () => {
                    textPreview.style.background = 'rgba(255,255,255,0.85)';
                    textPreview.style.borderColor = 'rgba(0,0,0,0.15)';
                    textPreview.style.boxShadow = 'none';
                });

                // Modal de redacción completa con cálculo exacto
                textPreview.addEventListener('click', () => {
                    if (document.body.classList.contains('live-mode') || document.title.includes('👁️')) return;
                    
                    const wordsInit = (block.content || "").trim().split(/\s+/).filter(w => w.length > 0).length;
                    const secInit = Math.max(2, Math.round((wordsInit / 130) * 60));

                    Swal.fire({
                        title: '<div style="display:flex;align-items:center;gap:10px;justify-content:center;color:#0284c7;"><i class="fa-solid fa-file-lines"></i> Redactar Guión de Radio</div>',
                        html: `
                            <div style="text-align:left;display:flex;flex-direction:column;gap:12px;margin-top:10px;">
                                <div>
                                    <label style="font-size:13px;font-weight:600;color:#334155;display:block;margin-bottom:4px;">
                                        <i class="fa-solid fa-microphone-lines" style="color:#0284c7;"></i> Locutor/a responsable (alumno/a):
                                    </label>
                                    <input type="text" id="swalSpeaker" value="${(block.speaker || '').replace(/"/g, '&quot;')}" placeholder="Nombre del alumno/a (ej. Laura García)" style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;">
                                </div>
                                <div>
                                    <label style="font-size:13px;font-weight:600;color:#334155;display:block;margin-bottom:4px;">
                                        <i class="fa-solid fa-align-left" style="color:#0284c7;"></i> Texto a leer en antena:
                                    </label>
                                    <textarea id="swalContent" rows="12" placeholder="Escribe aquí el guión que se leerá en antena..." style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;line-height:1.6;font-family:inherit;resize:vertical;">${(block.content || '').replace(/</g, '&lt;')}</textarea>
                                </div>
                                <div style="display:flex;justify-content:space-between;align-items:center;background:#f8fafc;padding:10px 14px;border-radius:8px;border:1px solid #e2e8f0;">
                                    <div id="swalCounter" style="font-size:13px;color:#475569;">
                                        <b>${wordsInit} palabras</b> — Tiempo estimado: <b style="color:#0284c7;">${secondsToTime(secInit)}</b> (a 130 palabras/min)
                                    </div>
                                </div>
                                <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#334155;cursor:pointer;margin-top:2px;">
                                    <input type="checkbox" id="swalSyncDuration" checked style="width:16px;height:16px;cursor:pointer;">
                                    <span><b>Ajustar automáticamente</b> el tiempo fin del bloque según la lectura estimada</span>
                                </label>
                            </div>
                        `,
                        width: '780px',
                        showCancelButton: true,
                        confirmButtonText: '<i class="fa-solid fa-check"></i> Guardar Guión',
                        cancelButtonText: 'Cancelar',
                        confirmButtonColor: '#0284c7',
                        didOpen: () => {
                            const textarea = document.getElementById('swalContent');
                            const counter = document.getElementById('swalCounter');
                            const updateCount = () => {
                                const w = textarea.value.trim().split(/\s+/).filter(x => x.length > 0).length;
                                const s = Math.max(2, Math.round((w / 130) * 60));
                                counter.innerHTML = `<b>${w} palabras</b> — Tiempo estimado: <b style="color:#0284c7;">${secondsToTime(s)}</b> (a 130 palabras/min)`;
                            };
                            textarea.addEventListener('input', updateCount);
                        }
                    }).then((result) => {
                        if (result.isConfirmed) {
                            const newSpeaker = document.getElementById('swalSpeaker').value.trim();
                            const newContent = document.getElementById('swalContent').value;
                            const syncDur = document.getElementById('swalSyncDuration').checked;

                            block.speaker = newSpeaker;
                            block.content = newContent;

                            const words = newContent.trim().split(/\s+/).filter(w => w.length > 0).length;
                            const sec = Math.max(2, Math.round((words / 130) * 60));

                            if (syncDur) {
                                const newEnd = secondsToTime(timeToSeconds(block.startTime) + sec);
                                block.endTime = newEnd;
                                endInput.value = newEnd;
                                updateDurationDisplay();
                            }

                            this.syncFullProgramDurations();
                            this.render(); // Re-renderizar completo para actualizar input de locutor y tiempos
                            this.notifyUpdate();
                        }
                    });
                });
                
                contentContainer.appendChild(textPreview);
                contentContainer.appendChild(helper);

            } else {
                // === BLOQUE DE AUDIO ===
                let prefix = "";
                const audioIndex = this.program.blocks.filter(b => b.type === 'audio').findIndex(b => b.id === block.id);
                if (audioIndex >= 0 && audioIndex < 9) {
                    prefix = `[${audioIndex + 1}] `;
                }

                const input = document.createElement('input');
                input.className = 'block-content';
                input.type = 'text';
                input.value = prefix + (block.title || 'Audio');
                input.style.cssText = 'padding:6px 10px; font-size:13px; border:1px solid #cbd5e1; border-radius:6px; font-weight:600; width:100%; box-sizing:border-box;';
                
                input.addEventListener('change', (e) => {
                    let val = e.target.value;
                    if (val.startsWith(prefix)) {
                        val = val.substring(prefix.length);
                    }
                    block.title = val;
                    this.notifyUpdate();
                });
                contentContainer.appendChild(input);

                // Opciones de fondo y "Todo el programa"
                const audioOptionsRow = document.createElement('div');
                audioOptionsRow.style.cssText = 'display:flex; align-items:center; gap:15px; font-size:12px; color:#475569;';

                // Checkbox: Suena de fondo
                const bgLabel = document.createElement('label');
                bgLabel.style.cssText = 'display:flex; align-items:center; gap:5px; cursor:pointer;';
                const bgCheck = document.createElement('input');
                bgCheck.type = 'checkbox';
                bgCheck.checked = !!block.isBackground || block.category === 'musica' || !!block.isFullProgram;
                bgCheck.addEventListener('change', (e) => {
                    block.isBackground = e.target.checked;
                    this.notifyUpdate();
                });
                bgLabel.appendChild(bgCheck);
                bgLabel.appendChild(document.createTextNode('Música / Fondo'));
                audioOptionsRow.appendChild(bgLabel);

                // Checkbox: "Todo el programa"
                const fullProgLabel = document.createElement('label');
                fullProgLabel.style.cssText = 'display:flex; align-items:center; gap:5px; cursor:pointer; color:#0f766e; font-weight:600;';
                const fullProgCheck = document.createElement('input');
                fullProgCheck.type = 'checkbox';
                fullProgCheck.checked = !!block.isFullProgram;
                fullProgCheck.addEventListener('change', (e) => {
                    block.isFullProgram = e.target.checked;
                    if (block.isFullProgram) {
                        block.isBackground = true;
                        bgCheck.checked = true;
                    }
                    this.syncFullProgramDurations();
                    this.render();
                    this.notifyUpdate();
                });
                fullProgLabel.appendChild(fullProgCheck);
                fullProgLabel.appendChild(document.createTextNode('🎵 Todo el programa'));
                audioOptionsRow.appendChild(fullProgLabel);

                contentContainer.appendChild(audioOptionsRow);
            }

            // === BOTONES DE ACCIÓN (TTS, PRE-ESCUCHA, BORRAR) ===
            const actions = document.createElement('div');
            actions.className = 'block-actions';
            
            if (block.type === 'text') {
                const btnSpeak = document.createElement('button');
                btnSpeak.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
                btnSpeak.title = "Leer texto en voz alta (TTS)";
                btnSpeak.className = 'btn-speak';
                btnSpeak.style.marginRight = '5px';
                btnSpeak.addEventListener('click', () => {
                    if (window.speechSynthesis.speaking) {
                        window.speechSynthesis.cancel();
                        btnSpeak.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
                    } else if (block.content && block.content.trim() !== '') {
                        const utterance = new SpeechSynthesisUtterance(block.content);
                        utterance.lang = 'es-ES';
                        if (typeof window.getVoiceByURI === 'function') {
                            const selectedVoice = window.getVoiceByURI(block.voiceURI);
                            if (selectedVoice) utterance.voice = selectedVoice;
                        }
                        utterance.onstart = () => btnSpeak.innerHTML = '<i class="fa-solid fa-stop"></i>';
                        utterance.onend = () => btnSpeak.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
                        utterance.onerror = () => btnSpeak.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
                        window.speechSynthesis.speak(utterance);
                    }
                });
                actions.appendChild(btnSpeak);
            }

            if (block.type === 'audio' && block.audioUrl) {
                const btnAudioPreview = document.createElement('button');
                btnAudioPreview.innerHTML = '<i class="fa-solid fa-play"></i>';
                btnAudioPreview.title = "Pre-escuchar audio";
                btnAudioPreview.className = 'btn-speak btn-audio-preview';
                btnAudioPreview.style.marginRight = '5px';
                
                btnAudioPreview.addEventListener('click', () => {
                    let globalPlayer = document.getElementById('globalAudioPlayer');
                    if (globalPlayer && !globalPlayer.paused && globalPlayer.dataset.currentBlock === block.id) {
                        globalPlayer.pause();
                        btnAudioPreview.innerHTML = '<i class="fa-solid fa-play"></i>';
                        globalPlayer.dataset.currentBlock = '';
                        return;
                    }
                    if (globalPlayer && !globalPlayer.paused) {
                        globalPlayer.pause();
                    }
                    document.querySelectorAll('.btn-audio-preview').forEach(b => {
                        b.innerHTML = '<i class="fa-solid fa-play"></i>';
                    });
                    if (globalPlayer) {
                        const playUrl = (block.audioUrl || '').replace('res.cloudinary.com', 'res-1.cloudinary.com');
                        globalPlayer.src = playUrl;
                        globalPlayer.dataset.currentBlock = block.id;
                        globalPlayer.play().then(() => {
                            btnAudioPreview.innerHTML = '<i class="fa-solid fa-stop"></i>';
                        }).catch(e => {
                            console.error("Error reproduciendo", e);
                            btnAudioPreview.innerHTML = '<i class="fa-solid fa-play"></i>';
                            globalPlayer.dataset.currentBlock = '';
                        });
                        globalPlayer.onended = () => {
                            btnAudioPreview.innerHTML = '<i class="fa-solid fa-play"></i>';
                            globalPlayer.dataset.currentBlock = '';
                        };
                    }
                });
                actions.appendChild(btnAudioPreview);
            }
            
            const btnDelete = document.createElement('button');
            btnDelete.innerHTML = '<i class="fa-solid fa-trash"></i>';
            btnDelete.title = "Eliminar bloque";
            btnDelete.className = 'btn-delete';
            btnDelete.addEventListener('click', () => this.removeBlock(block.id));
            actions.appendChild(btnDelete);

            el.appendChild(timeContainer);
            el.appendChild(contentContainer);
            el.appendChild(actions);

            this.container.appendChild(el);
        });
    }
}
