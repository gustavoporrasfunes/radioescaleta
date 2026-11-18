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
        if (typeof Sortable !== 'undefined' && this.container) {
            this.sortable = Sortable.create(this.container, {
                animation: 180,
                scroll: true,
                scrollSensitivity: 60,
                scrollSpeed: 15,
                bubbleScroll: true,
                handle: '.block-drag-handle, .escaleta-block',
                filter: 'input, textarea, button, select, label, .text-preview, a',
                preventOnFilter: false,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
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
        const orderIds = Array.from(this.container.children).map(el => el.dataset.id).filter(Boolean);
        this.program.updateBlockOrder(orderIds);
        this.syncFullProgramDurations();
        this.render();
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

            // === AGARRE PARA ARRASTRAR (DRAG HANDLE) ===
            const dragHandle = document.createElement('div');
            dragHandle.className = 'block-drag-handle';
            dragHandle.title = 'Arrastrar para reordenar bloque';
            dragHandle.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';

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

                // Botón directo para dictar texto en este bloque
                const dictateBtn = document.createElement('button');
                dictateBtn.type = 'button';
                dictateBtn.className = 'btn-quick-dictate';
                dictateBtn.title = 'Dictar texto por voz para este bloque';
                dictateBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> Dictar por voz';
                dictateBtn.style.cssText = 'padding:3px 10px; font-size:11px; font-weight:600; color:#0284c7; background:#f0f9ff; border:1px solid #bae6fd; border-radius:12px; cursor:pointer; display:inline-flex; align-items:center; gap:5px; transition:all 0.2s; flex-shrink:0;';
                dictateBtn.onmouseover = () => { dictateBtn.style.background = '#e0f2fe'; dictateBtn.style.borderColor = '#0284c7'; };
                dictateBtn.onmouseout = () => { dictateBtn.style.background = '#f0f9ff'; dictateBtn.style.borderColor = '#bae6fd'; };
                dictateBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openTextEditorModal(block, endInput, updateDurationDisplay, true);
                });
                speakerRow.appendChild(dictateBtn);

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

                // Abrir editor modal
                textPreview.addEventListener('click', () => {
                    this.openTextEditorModal(block, endInput, updateDurationDisplay, false);
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
                const btnDictateAction = document.createElement('button');
                btnDictateAction.innerHTML = '<i class="fa-solid fa-microphone"></i>';
                btnDictateAction.title = "Dictar texto por voz (hablar para escribir)";
                btnDictateAction.className = 'btn-speak btn-dictate';
                btnDictateAction.style.marginRight = '5px';
                btnDictateAction.style.color = '#0284c7';
                btnDictateAction.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openTextEditorModal(block, endInput, updateDurationDisplay, true);
                });
                actions.appendChild(btnDictateAction);

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

            el.appendChild(dragHandle);
            el.appendChild(timeContainer);
            el.appendChild(contentContainer);
            el.appendChild(actions);

            this.container.appendChild(el);
        });
    }

    openTextEditorModal(block, endInput, updateDurationDisplay, autoStartDictation = false) {
        if (document.body.classList.contains('live-mode') || document.title.includes('👁️')) return;
        
        const wordsInit = (block.content || "").trim().split(/\s+/).filter(w => w.length > 0).length;
        const secInit = Math.max(2, Math.round((wordsInit / 130) * 60));

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const isSpeechSupported = !!SpeechRecognition;

        let recognition = null;
        let isDictating = false;

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
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px;">
                            <label style="font-size:13px;font-weight:600;color:#334155;margin:0;">
                                <i class="fa-solid fa-align-left" style="color:#0284c7;"></i> Texto a leer en antena:
                            </label>
                            <button type="button" id="swalBtnDictate" style="background:#f0fdf4; border:1px solid #86efac; color:#15803d; border-radius:20px; padding:6px 14px; font-size:12px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all 0.2s; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                                <i class="fa-solid fa-microphone"></i> <span>Dictar por voz</span>
                            </button>
                        </div>

                        <!-- Estado dinámico de voz -->
                        <div id="swalVoiceFeedback" style="display:none; margin-bottom:8px; padding:8px 12px; border-radius:6px; font-size:12px; align-items:center; gap:8px;"></div>

                        <textarea id="swalContent" rows="11" placeholder="Escribe aquí el guión o pulsa 'Dictar por voz' para hablar..." style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;line-height:1.6;font-family:inherit;resize:vertical;">${(block.content || '').replace(/</g, '&lt;')}</textarea>
                        
                        <!-- Barra de herramientas para alumnos: puntuación rápida -->
                        <div style="display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap;">
                            <span style="font-size:11px;color:#64748b;font-weight:600;">Puntuación rápida:</span>
                            <button type="button" class="btn-swal-punct" data-insert=". " style="padding:3px 8px;font-size:11px;font-weight:600;background:#f8fafc;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;">. Punto</button>
                            <button type="button" class="btn-swal-punct" data-insert=", " style="padding:3px 8px;font-size:11px;font-weight:600;background:#f8fafc;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;">, Coma</button>
                            <button type="button" class="btn-swal-punct" data-insert="? " style="padding:3px 8px;font-size:11px;font-weight:600;background:#f8fafc;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;">? Pregunta</button>
                            <button type="button" class="btn-swal-punct" data-insert="! " style="padding:3px 8px;font-size:11px;font-weight:600;background:#f8fafc;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;">! Exclamación</button>
                            <button type="button" class="btn-swal-punct" data-insert="\\n\\n" style="padding:3px 8px;font-size:11px;font-weight:600;background:#f8fafc;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;">↵ Párrafo</button>
                        </div>
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
            willClose: () => {
                isDictating = false;
                if (recognition) {
                    try {
                        recognition.stop();
                        recognition.abort();
                    } catch (e) {}
                }
            },
            didOpen: () => {
                const textarea = document.getElementById('swalContent');
                const counter = document.getElementById('swalCounter');
                const btnDictate = document.getElementById('swalBtnDictate');
                const feedback = document.getElementById('swalVoiceFeedback');

                const updateCount = () => {
                    const w = textarea.value.trim().split(/\s+/).filter(x => x.length > 0).length;
                    const s = Math.max(2, Math.round((w / 130) * 60));
                    counter.innerHTML = `<b>${w} palabras</b> — Tiempo estimado: <b style="color:#0284c7;">${secondsToTime(s)}</b> (a 130 palabras/min)`;
                };
                textarea.addEventListener('input', updateCount);

                // Botones de puntuación rápida
                document.querySelectorAll('.btn-swal-punct').forEach(b => {
                    b.addEventListener('click', () => {
                        const rawInsert = b.getAttribute('data-insert');
                        const insert = rawInsert === '\\n\\n' ? '\n\n' : rawInsert;
                        const start = textarea.selectionStart ?? textarea.value.length;
                        const end = textarea.selectionEnd ?? textarea.value.length;
                        const val = textarea.value;
                        textarea.value = val.substring(0, start) + insert + val.substring(end);
                        textarea.selectionStart = textarea.selectionEnd = start + insert.length;
                        textarea.focus();
                        updateCount();
                    });
                });

                const setNormalButtonUI = () => {
                    btnDictate.style.background = '#f0fdf4';
                    btnDictate.style.borderColor = '#86efac';
                    btnDictate.style.color = '#15803d';
                    btnDictate.innerHTML = '<i class="fa-solid fa-microphone"></i> <span>Dictar por voz</span>';
                };

                const setActiveButtonUI = () => {
                    btnDictate.style.background = '#fee2e2';
                    btnDictate.style.borderColor = '#ef4444';
                    btnDictate.style.color = '#b91c1c';
                    btnDictate.innerHTML = '<i class="fa-solid fa-circle-dot fa-fade" style="color:#ef4444;"></i> <span>Detener dictado</span>';
                };

                const startVoiceDictation = () => {
                    if (!isSpeechSupported) {
                        feedback.style.display = 'flex';
                        feedback.style.background = '#fffbeb';
                        feedback.style.border = '1px solid #fde68a';
                        feedback.style.color = '#b45309';
                        feedback.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#d97706;"></i> El dictado por voz requiere Google Chrome, Microsoft Edge o Safari.';
                        return;
                    }

                    if (isDictating) {
                        isDictating = false;
                        if (recognition) {
                            try { recognition.stop(); } catch(e) {}
                        }
                        setNormalButtonUI();
                        feedback.style.display = 'flex';
                        feedback.style.background = '#f0fdf4';
                        feedback.style.border = '1px solid #bbf7d0';
                        feedback.style.color = '#166534';
                        feedback.innerHTML = '<i class="fa-solid fa-circle-check"></i> Dictado finalizado. Puedes revisar el texto o pulsar "Dictar por voz" para continuar.';
                        return;
                    }

                    try {
                        recognition = new SpeechRecognition();
                        recognition.lang = 'es-ES';
                        recognition.continuous = true;
                        recognition.interimResults = true;

                        recognition.onstart = () => {
                            isDictating = true;
                            setActiveButtonUI();
                            feedback.style.display = 'flex';
                            feedback.style.background = '#fef2f2';
                            feedback.style.border = '1px dashed #fca5a5';
                            feedback.style.color = '#991b1b';
                            feedback.innerHTML = '<i class="fa-solid fa-microphone-lines"></i> <b>Escuchando...</b> Habla claro al micrófono de tu dispositivo';
                        };

                        recognition.onresult = (event) => {
                            let interim = '';
                            for (let i = event.resultIndex; i < event.results.length; ++i) {
                                const res = event.results[i];
                                const transcript = res[0].transcript;
                                if (res.isFinal) {
                                    let clean = transcript.trim();
                                    if (clean) {
                                        // Conversión inteligente de comandos de dictado comunes
                                        clean = clean
                                            .replace(/\\bpunto y aparte\\b/gi, '.\\n')
                                            .replace(/\\bpunto y seguido\\b/gi, '. ')
                                            .replace(/\\bdos puntos\\b/gi, ': ')
                                            .replace(/\\bsigno de interrogación\\b/gi, '?')
                                            .replace(/\\bsigno de exclamación\\b/gi, '!')
                                            .replace(/\\s+([.,:?!])/g, '$1');

                                        let formatted = clean;
                                        const currentVal = textarea.value;
                                        const trimmed = currentVal.trim();
                                        
                                        // Capitalizar si es inicio o tras puntuación
                                        if (!trimmed || trimmed.endsWith('.') || trimmed.endsWith('!') || trimmed.endsWith('?') || trimmed.endsWith('\n')) {
                                            formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
                                        }

                                        if (currentVal.length > 0 && !currentVal.endsWith(' ') && !currentVal.endsWith('\n')) {
                                            textarea.value += ' ' + formatted;
                                        } else {
                                            textarea.value += formatted;
                                        }
                                        updateCount();
                                        textarea.scrollTop = textarea.scrollHeight;
                                    }
                                    feedback.innerHTML = `<span style="color:#15803d;"><i class="fa-solid fa-check"></i> Reconocido: "<b>${clean}</b>"</span>`;
                                } else {
                                    interim += transcript;
                                }
                            }
                            if (interim) {
                                feedback.innerHTML = `<span style="color:#b91c1c;"><i class="fa-solid fa-circle-dot fa-fade" style="color:#ef4444;"></i> Escuchando: <i>"${interim}"</i></span>`;
                            }
                        };

                        recognition.onerror = (e) => {
                            console.warn('SpeechRecognition error:', e.error);
                            if (e.error === 'no-speech') return;
                            isDictating = false;
                            setNormalButtonUI();
                            feedback.style.display = 'flex';
                            feedback.style.background = '#fffbeb';
                            feedback.style.border = '1px solid #fde68a';
                            feedback.style.color = '#b45309';
                            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                                feedback.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#d97706;"></i> <b>Permiso denegado:</b> Debes permitir el uso del micrófono en el navegador para dictar.';
                            } else if (e.error === 'network') {
                                feedback.innerHTML = '<i class="fa-solid fa-wifi" style="color:#d97706;"></i> Se necesita conexión a Internet para el dictado por voz.';
                            } else {
                                feedback.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Aviso de micrófono: ${e.error}`;
                            }
                        };

                        recognition.onend = () => {
                            if (isDictating) {
                                try {
                                    recognition.start();
                                } catch (err) {
                                    isDictating = false;
                                    setNormalButtonUI();
                                }
                            } else {
                                setNormalButtonUI();
                            }
                        };

                        recognition.start();
                    } catch (err) {
                        console.error('Error starting recognition:', err);
                        isDictating = false;
                        setNormalButtonUI();
                    }
                };

                btnDictate.addEventListener('click', startVoiceDictation);

                if (autoStartDictation) {
                    setTimeout(() => {
                        startVoiceDictation();
                    }, 350);
                }
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
                    if (endInput) endInput.value = newEnd;
                    if (typeof updateDurationDisplay === 'function') updateDurationDisplay();
                }

                this.syncFullProgramDurations();
                this.render();
                this.notifyUpdate();
            }
        });
    }
}
