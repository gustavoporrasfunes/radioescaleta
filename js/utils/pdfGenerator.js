// js/utils/pdfGenerator.js

export function downloadPDF(elementId, filename = "escaleta.pdf") {
    const element = document.getElementById(elementId);
    if (!element) return;

    // Clonamos para limpiar estilos de drag and drop o botones de borrar
    const clone = element.cloneNode(true);
    
    // 1. Extraer los nombres de locutores y formatear bloques de texto ANTES de convertir inputs
    const originalTextBlocks = element.querySelectorAll('.escaleta-block.text');
    const clonedTextBlocks = clone.querySelectorAll('.escaleta-block.text');

    clonedTextBlocks.forEach((block, idx) => {
        const origBlock = originalTextBlocks[idx];
        const speakerInput = origBlock ? origBlock.querySelector('.speaker-input') : null;
        const speakerName = speakerInput ? speakerInput.value.trim() : '';

        // Eliminar fila interactiva de edición de locutor
        const speakerRow = block.querySelector('.speaker-row');
        if (speakerRow) speakerRow.remove();

        // Crear cabecera destacada del locutor/a para el PDF
        const speakerHeader = document.createElement('div');
        speakerHeader.style.cssText = 'background: #f0f9ff; color: #0369a1; border: 1px solid #bae6fd; border-left: 5px solid #0284c7; padding: 6px 12px; border-radius: 4px; font-weight: bold; font-size: 13px; margin-bottom: 8px; display: block;';
        speakerHeader.innerHTML = `<span>🎙️ LOCUTOR/A (RESPONSABLE):</span> <span style="color: #0f172a; text-decoration: underline; margin-left: 4px;">${speakerName ? speakerName : 'No asignado'}</span>`;

        const contentPreview = block.querySelector('.text-preview') || block.querySelector('.block-content');
        if (contentPreview && contentPreview.parentNode) {
            contentPreview.parentNode.insertBefore(speakerHeader, contentPreview);
        }
    });

    // 2. Convertir inputs restantes en spans para el PDF
    const inputs = clone.querySelectorAll('input');
    inputs.forEach(input => {
        const span = document.createElement('span');
        span.innerText = input.value;
        
        if (input.classList.contains('time-input')) {
            span.style.marginRight = "5px";
            span.style.fontSize = "12px";
            span.style.color = "#475569";
            span.style.fontFamily = "monospace";
        } else {
            span.style.fontWeight = "bold";
        }
        
        input.parentNode.replaceChild(span, input);
    });

    // 3. Mejorar aspecto de los bloques para impresión
    const blocks = clone.querySelectorAll('.escaleta-block');
    blocks.forEach(block => {
        block.style.boxShadow = 'none';
        block.style.border = '1px solid #cbd5e1';
        block.style.backgroundColor = '#ffffff';
        block.style.marginBottom = '14px';
        block.style.borderRadius = '8px';
        block.style.padding = '12px 16px';
        block.style.pageBreakInside = 'avoid';
    });

    // 4. Formatear los textos largos (guiones) para que se vean enteros y elegantes
    const textPreviews = clone.querySelectorAll('.text-preview');
    textPreviews.forEach(div => {
        div.style.whiteSpace = 'pre-wrap';
        div.style.overflow = 'visible';
        div.style.textOverflow = 'clip';
        div.style.background = '#fafafa';
        div.style.border = '1px solid #e2e8f0';
        div.style.borderLeft = '4px solid #0284c7';
        div.style.padding = '10px 14px';
        div.style.fontStyle = 'normal';
        div.style.fontSize = '14px';
        div.style.lineHeight = '1.6';
        div.style.color = '#1e293b';
        div.style.marginTop = '6px';
        div.style.borderRadius = '4px';
    });

    // 5. Eliminar botones de acción (TTS, pre-escucha, borrar)
    const actions = clone.querySelectorAll('.block-actions');
    actions.forEach(a => a.remove());
    
    // 6. Añadir Diagrama de Gantt si existe
    const gantt = document.getElementById('ganttContainer');
    if (gantt && gantt.querySelector('.gantt-canvas')) {
        const ganttClone = gantt.cloneNode(true);
        ganttClone.style.display = 'block';
        ganttClone.style.marginTop = '30px';
        ganttClone.style.pageBreakBefore = 'always';
        
        const ganttTitle = document.createElement('h3');
        ganttTitle.innerText = "Diagrama de Gantt — Línea de Tiempo del Programa";
        ganttTitle.style.textAlign = "center";
        ganttTitle.style.color = "#0f172a";
        ganttTitle.style.marginBottom = "15px";
        ganttClone.insertBefore(ganttTitle, ganttClone.firstChild);
        
        clone.appendChild(ganttClone);
    }

    const opt = {
        margin:       [10, 10, 10, 10],
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (typeof html2pdf !== 'undefined') {
        html2pdf().set(opt).from(clone).save();
    } else {
        console.error("Librería html2pdf no cargada");
    }
}
