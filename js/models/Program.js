// js/models/Program.js
import { TextBlock, AudioBlock } from "./Block.js";

export const DEFAULT_SOUNDBOARD = [
    { id: 'sb_1', key: 'F1', name: 'Aplausos', url: './assets/sounds/efectos/Aplausos1.mp3', color: '#e53935', icon: 'fa-hands-clapping' },
    { id: 'sb_2', key: 'F2', name: 'Risas', url: './assets/sounds/efectos/Cartoon2.mp3', color: '#00acc1', icon: 'fa-face-laugh' },
    { id: 'sb_3', key: 'F3', name: 'Campanas', url: './assets/sounds/efectos/Campanas.mp3', color: '#fb8c00', icon: 'fa-bell' },
    { id: 'sb_4', key: 'F4', name: 'Alarma', url: './assets/sounds/efectos/Alarma2.mp3', color: '#7cb342', icon: 'fa-triangle-exclamation' },
    { id: 'sb_5', key: 'F5', name: 'Golpe', url: './assets/sounds/efectos/Golpe.mp3', color: '#8e24aa', icon: 'fa-burst' },
    { id: 'sb_6', key: 'F6', name: 'Clank', url: './assets/sounds/efectos/Clank1.mp3', color: '#1e40af', icon: 'fa-bolt' }
];

export class Program {
    constructor(title = "Mi Programa de Radio", ownerId = null) {
        this.id = null;
        this.title = title;
        this.ownerId = ownerId;
        this.blocks = [];
        this.soundboard = JSON.parse(JSON.stringify(DEFAULT_SOUNDBOARD));
        this.collaborators = {};
        this.createdAt = new Date().toISOString();
    }

    addBlock(block) {
        this.blocks.push(block);
    }

    removeBlock(blockId) {
        this.blocks = this.blocks.filter(b => b.id !== blockId);
    }

    updateBlockOrder(newOrderIds) {
        const newBlocks = [];
        newOrderIds.forEach(id => {
            const block = this.blocks.find(b => b.id === id);
            if (block) newBlocks.push(block);
        });
        this.blocks = newBlocks;
    }

    toFirestore() {
        return {
            id: this.id,
            title: this.title,
            ownerId: this.ownerId,
            blocks: this.blocks.map(b => ({...b})), // Simplificar para firestore
            soundboard: this.soundboard || DEFAULT_SOUNDBOARD,
            collaborators: this.collaborators,
            createdAt: this.createdAt
        };
    }

    static fromFirestore(data) {
        const p = new Program(data.title, data.ownerId);
        p.id = data.id;
        if (data.soundboard && data.soundboard.length === 6) {
            p.soundboard = data.soundboard.map((item, idx) => {
                let key = item.key;
                if (!key || /^[1-6]$/.test(key)) {
                    key = `F${idx + 1}`;
                }
                return { ...item, key };
            });
        } else {
            p.soundboard = JSON.parse(JSON.stringify(DEFAULT_SOUNDBOARD));
        }
        p.collaborators = data.collaborators || {};
        p.createdAt = data.createdAt || new Date().toISOString();
        
        p.blocks = (data.blocks || []).map(bData => {
            let block;
            if (bData.type === 'text') {
                block = new TextBlock(bData.content, bData.id, bData.speaker || "");
            } else if (bData.type === 'audio') {
                block = new AudioBlock(
                    bData.category, 
                    bData.title, 
                    bData.audioUrl ? bData.audioUrl.replace(".ogg", ".mp3") : "", 
                    bData.keyboardKey, 
                    bData.id, 
                    bData.maxDuration || 0,
                    !!bData.isFullProgram
                );
            }
            if (block) {
                block.startTime = bData.startTime || "00:00";
                block.endTime = bData.endTime || bData.duration || "00:00";
                if (block.type === 'audio') {
                    block.isBackground = !!bData.isBackground;
                    block.isFullProgram = !!bData.isFullProgram;
                }
            }
            return block;
        });
        return p;
    }
}
