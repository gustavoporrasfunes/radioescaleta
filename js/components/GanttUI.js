// js/components/GanttUI.js
import { timeToSeconds, secondsToTime, formatTime } from "../utils/timeUtils.js";

export class GanttUI {
    constructor(containerId, onUpdateCallback = null) {
        this.container = document.getElementById(containerId);
        // Escala: 1 segundo = 18 píxeles (cómodo para arrastrar y visualizar)
        this.pixelsPerSecond = 18;
        this.onUpdateCallback = onUpdateCallback;
    }

    calculateLanes(blocks) {
        blocks.sort((a, b) => a.startSec - b.startSec);
        const lanes = [];
        blocks.forEach(b => {
            let placed = false;
            for (let i = 0; i < lanes.length; i++) {
                if (lanes[i] <= b.startSec) {
                    b.lane = i;
                    lanes[i] = b.startSec + Math.max(1, b.durSec);
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                b.lane = lanes.length;
                lanes.push(b.startSec + Math.max(1, b.durSec));
            }
        });
        return Math.max(1, lanes.length);
    }

    render(program) {
        this.container.innerHTML = '';
        if (!program || !program.blocks || program.blocks.length === 0) {
            this.container.innerHTML = `
                <div style="text-align:center; padding: 40px; color:#64748b;">
                    <i class="fa-solid fa-chart-gantt" style="font-size: 3em; margin-bottom: 12px; color:#cbd5e1;"></i>
                    <p style="font-size: 15px; font-weight: 500;">No hay bloques en la escaleta para dibujar el Diagrama de Gantt.</p>
                    <small>Añade bloques de texto o audio para visualizar la línea de tiempo.</small>
                </div>
            `;
            return;
        }

        // 3 PISTAS DEDICADAS: Voz, Sintonías, Música de fondo
        const vozTrack = [];
        const sintoniaTrack = [];
        const musicaTrack = [];
        let maxTime = 0;

        // Calcular primero la duración máxima real de los bloques no-fullProgram
        program.blocks.forEach(b => {
            if (!b.isFullProgram) {
                const endSec = timeToSeconds(b.endTime || b.duration || b.startTime);
                if (endSec > maxTime) maxTime = endSec;
            }
        });
        if (maxTime <= 0) maxTime = 60; // Mínimo 1 minuto si no hay tiempos fijados

        program.blocks.forEach(b => {
            let startSec = timeToSeconds(b.startTime);
            let endSec = timeToSeconds(b.endTime || b.duration || b.startTime);

            if (b.isFullProgram) {
                startSec = 0;
                endSec = maxTime;
            } else if (endSec <= startSec) {
                endSec = startSec + 10; // Duración mínima visual de 10s si fin <= inicio
            }

            const durSec = Math.max(3, endSec - startSec);
            if (endSec > maxTime) maxTime = endSec;

            const blockData = {
                ...b,
                rawBlock: b,
                startSec,
                endSec,
                durSec
            };

            const isAudio = (b.type === 'audio' || !!b.audioUrl || (b.category && b.category !== 'text'));
            if (!isAudio) {
                vozTrack.push(blockData);
            } else {
                if (b.isFullProgram || b.isBackground || b.category === 'musica') {
                    musicaTrack.push(blockData);
                } else {
                    sintoniaTrack.push(blockData);
                }
            }
        });

        // Dar margen de 30 segundos al final
        const totalDuration = maxTime + 30;
        const totalWidth = Math.max(800, totalDuration * this.pixelsPerSecond);

        // Barra de ayuda e instrucciones
        const headerInfo = document.createElement('div');
        headerInfo.style.cssText = 'padding: 8px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #475569; display: flex; justify-content: space-between; align-items: center;';
        headerInfo.innerHTML = `
            <span><i class="fa-solid fa-arrows-left-right" style="color:#0284c7; margin-right:4px;"></i> <b>Arrastra horizontalmente</b> las barras para situar cada bloque exactamente cuando debe sonar.</span>
            <span><i class="fa-solid fa-hand-pointer" style="color:#0284c7; margin-right:4px;"></i> Haz doble clic en una barra para editar sus tiempos con precisión.</span>
        `;
        this.container.appendChild(headerInfo);

        // Contenedor scrollable
        const scrollWrapper = document.createElement('div');
        scrollWrapper.className = 'gantt-scroll-wrapper';

        const ganttCanvas = document.createElement('div');
        ganttCanvas.className = 'gantt-canvas';
        ganttCanvas.style.width = `${totalWidth}px`;

        // Regla de tiempo (marcas cada 5 y 10 segundos)
        const timeline = document.createElement('div');
        timeline.className = 'gantt-timeline';
        for (let s = 0; s <= totalDuration; s += 5) {
            const mark = document.createElement('div');
            mark.className = 'gantt-mark' + (s % 30 === 0 ? ' major' : '');
            mark.style.left = `${s * this.pixelsPerSecond}px`;
            
            const m = Math.floor(s / 60);
            const r = s % 60;
            mark.innerText = `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
            timeline.appendChild(mark);
        }
        ganttCanvas.appendChild(timeline);

        // Pista 1: Voz
        const vozLanes = this.calculateLanes(vozTrack);
        const track1 = document.createElement('div');
        track1.className = 'gantt-track voz-track';
        track1.innerHTML = '<div class="track-label"><i class="fa-solid fa-microphone"></i> Voz</div>';
        const h1 = Math.max(75, 35 + (vozLanes * 50) + 15);
        track1.style.height = `${h1}px`;
        vozTrack.forEach(b => this.createBar(b, track1, program));
        ganttCanvas.appendChild(track1);

        // Pista 2: Sintonías
        const sintoniaLanes = this.calculateLanes(sintoniaTrack);
        const track2 = document.createElement('div');
        track2.className = 'gantt-track sintonia-track';
        track2.innerHTML = '<div class="track-label"><i class="fa-solid fa-music"></i> Sintonías</div>';
        const h2 = Math.max(75, 35 + (sintoniaLanes * 50) + 15);
        track2.style.height = `${h2}px`;
        sintoniaTrack.forEach(b => this.createBar(b, track2, program));
        ganttCanvas.appendChild(track2);

        // Pista 3: Música de fondo
        const musicaLanes = this.calculateLanes(musicaTrack);
        const track3 = document.createElement('div');
        track3.className = 'gantt-track musica-track';
        track3.innerHTML = '<div class="track-label"><i class="fa-solid fa-headphones"></i> Música de fondo</div>';
        const h3 = Math.max(75, 35 + (musicaLanes * 50) + 15);
        track3.style.height = `${h3}px`;
        musicaTrack.forEach(b => this.createBar(b, track3, program));
        ganttCanvas.appendChild(track3);

        scrollWrapper.appendChild(ganttCanvas);
        this.container.appendChild(scrollWrapper);
    }

    createBar(bData, trackEl, program) {
        if (!bData || bData.durSec <= 0) return;

        const block = bData.rawBlock || bData;
        const isAudio = (block.type === 'audio' || !!block.audioUrl || (block.category && block.category !== 'text'));
        
        const bar = document.createElement('div');
        bar.className = `gantt-bar ${isAudio ? 'audio' : 'text'}`;
        if (isAudio && block.category) bar.classList.add(`audio-${block.category}`);
        if (block.isFullProgram) bar.classList.add('full-program-bar');

        bar.style.left = `${bData.startSec * this.pixelsPerSecond}px`;
        bar.style.width = `${Math.max(45, bData.durSec * this.pixelsPerSecond)}px`;
        const lane = (bData.lane !== undefined) ? bData.lane : 0;
        bar.style.top = `${35 + (lane * 50)}px`;

        // Título del bloque (locutor si es texto)
        let displayTitle = '';
        if (!isAudio) {
            const speakerTag = block.speaker ? `[${block.speaker}] ` : '';
            const cleanContent = (block.content || 'Guión de texto').replace(/\s+/g, ' ').trim();
            displayTitle = speakerTag + cleanContent;
        } else {
            displayTitle = (block.isFullProgram ? '🎵 [TODO EL PROGRAMA] ' : '') + (block.title || 'Audio');
        }

        const contentDiv = document.createElement('div');
        contentDiv.className = 'gantt-bar-content';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'bar-title';
        titleSpan.textContent = displayTitle;

        const badgeSpan = document.createElement('span');
        badgeSpan.className = 'bar-badge';
        badgeSpan.textContent = `${block.startTime || '00:00'} - ${block.endTime || '00:00'}`;

        contentDiv.appendChild(titleSpan);
        contentDiv.appendChild(badgeSpan);
        bar.appendChild(contentDiv);

        bar.title = `[${block.startTime} a ${block.endTime}] ${displayTitle} (Haz doble clic para editar o arrastra para mover)`;

        // === ARRASTRAR PARA SITUAR EN EL TIEMPO ===
        if (!block.isFullProgram) {
            bar.style.cursor = 'grab';

            let isDragging = false;
            let startClientX = 0;
            let initialStartSec = bData.startSec;
            let currentDeltaSec = 0;
            let dragTooltip = null;

            const onMouseDown = (e) => {
                if (e.button !== 0) return; // Solo clic izquierdo
                e.preventDefault();
                isDragging = true;
                startClientX = e.clientX;
                initialStartSec = timeToSeconds(block.startTime);
                currentDeltaSec = 0;
                bar.style.cursor = 'grabbing';
                bar.classList.add('is-dragging');

                // Tooltip flotante con horas
                dragTooltip = document.createElement('div');
                dragTooltip.className = 'gantt-drag-tooltip';
                dragTooltip.innerText = `${block.startTime} → ${block.endTime}`;
                bar.appendChild(dragTooltip);

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            };

            const onMouseMove = (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startClientX;
                currentDeltaSec = Math.round(dx / this.pixelsPerSecond);
                const newStartSec = Math.max(0, initialStartSec + currentDeltaSec);
                const newEndSec = newStartSec + bData.durSec;

                bar.style.left = `${newStartSec * this.pixelsPerSecond}px`;
                if (dragTooltip) {
                    dragTooltip.innerText = `${secondsToTime(newStartSec)} → ${secondsToTime(newEndSec)}`;
                }
            };

            const onMouseUp = () => {
                if (!isDragging) return;
                isDragging = false;
                bar.style.cursor = 'grab';
                bar.classList.remove('is-dragging');
                if (dragTooltip) {
                    dragTooltip.remove();
                    dragTooltip = null;
                }

                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);

                if (currentDeltaSec !== 0) {
                    const finalStartSec = Math.max(0, initialStartSec + currentDeltaSec);
                    const finalEndSec = finalStartSec + bData.durSec;
                    block.startTime = secondsToTime(finalStartSec);
                    block.endTime = secondsToTime(finalEndSec);

                    if (this.onUpdateCallback) {
                        this.onUpdateCallback();
                    }
                    this.render(program);
                }
            };

            bar.addEventListener('mousedown', onMouseDown);
        } else {
            bar.style.cursor = 'pointer';
        }

        // Doble clic para editar tiempos
        bar.addEventListener('dblclick', () => {
            this.openEditTimesModal(block, program);
        });

        trackEl.appendChild(bar);
    }

    openEditTimesModal(block, program) {
        const isAudio = block.type === 'audio';
        Swal.fire({
            title: `<div style="font-size:18px;color:#0284c7;"><i class="fa-solid fa-clock"></i> Ajustar Tiempos del Bloque</div>`,
            html: `
                <div style="text-align:left;display:flex;flex-direction:column;gap:12px;padding:5px 0;">
                    <div style="font-weight:600;font-size:14px;color:#1e293b;">
                        ${block.type === 'text' ? (block.speaker ? `Locutor: <b>${block.speaker}</b>` : 'Bloque de texto') : block.title}
                    </div>
                    <div style="display:flex;gap:10px;">
                        <div style="flex:1;">
                            <label style="font-size:12px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Inicio (MM:SS):</label>
                            <input type="text" id="ganttStart" value="${block.startTime}" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;text-align:center;">
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:12px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Fin (MM:SS):</label>
                            <input type="text" id="ganttEnd" value="${block.endTime}" ${block.isFullProgram ? 'disabled' : ''} style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;text-align:center;">
                        </div>
                    </div>
                    ${isAudio ? `
                        <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#0f766e;cursor:pointer;margin-top:5px;font-weight:600;">
                            <input type="checkbox" id="ganttFullProg" ${block.isFullProgram ? 'checked' : ''} style="width:16px;height:16px;">
                            <span>Marcar como música para "Todo el programa"</span>
                        </label>
                    ` : ''}
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Guardar Tiempos',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#0284c7'
        }).then(res => {
            if (res.isConfirmed) {
                const sVal = formatTime(document.getElementById('ganttStart').value) || block.startTime;
                const eVal = formatTime(document.getElementById('ganttEnd').value) || block.endTime;
                const fullProgCheck = document.getElementById('ganttFullProg');
                const isFull = fullProgCheck ? fullProgCheck.checked : false;

                block.startTime = sVal;
                block.endTime = eVal;
                if (isAudio) {
                    block.isFullProgram = isFull;
                    if (isFull) {
                        block.isBackground = true;
                        block.startTime = "00:00";
                    }
                }

                if (this.onUpdateCallback) {
                    this.onUpdateCallback();
                }
                this.render(program);
            }
        });
    }
}
