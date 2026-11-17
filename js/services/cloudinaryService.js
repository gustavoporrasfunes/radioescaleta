// js/services/cloudinaryService.js
const CLOUD_NAME = 'etzlhosw';
const UPLOAD_PRESET = 'radioescaleta';
const API_KEY = '462961382817615';
const API_SECRET = 'BTIS8ZsxkYdIJ9DJZKx_7qQdxZ8';

class CloudinaryService {
    uploadAudio(file, onProgress = null) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', UPLOAD_PRESET);
            formData.append('resource_type', 'video'); // Cloudinary trata audio como 'video'
            formData.append('folder', 'radioescaleta');

            const xhr = new XMLHttpRequest();
            xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`);

            if (xhr.upload && typeof onProgress === 'function') {
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const percent = Math.round((event.loaded / event.total) * 100);
                        onProgress(percent);
                    }
                };
            }

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        // En redes corporativas educativas (ej. Andared en la Junta de Andalucía),
                        // res.cloudinary.com suele estar bloqueado o provocar avisos SSL,
                        // mientras que res-1.cloudinary.com resuelve sin bloqueos.
                        let secureUrl = data.secure_url || '';
                        if (secureUrl.includes('res.cloudinary.com')) {
                            secureUrl = secureUrl.replace('res.cloudinary.com', 'res-1.cloudinary.com');
                        }

                        resolve({
                            id: data.public_id,
                            name: file.name,
                            url: secureUrl
                        });
                    } catch (e) {
                        reject(new Error('Respuesta inválida del servidor'));
                    }
                } else {
                    try {
                        const err = JSON.parse(xhr.responseText);
                        reject(new Error(err.error?.message || 'Error subiendo a Cloudinary'));
                    } catch (_) {
                        reject(new Error(`Error en la subida (${xhr.status})`));
                    }
                }
            };

            xhr.onerror = () => {
                reject(new Error('Error de conexión al subir el archivo a Cloudinary'));
            };

            xhr.send(formData);
        });
    }

    /**
     * Extrae el public_id de una URL de Cloudinary si no se dispone del campo directo
     */
    extractPublicId(url) {
        if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) return null;
        const match = url.match(/\/upload\/(?:v\d+\/)?([^\.]+)/);
        return match ? match[1] : null;
    }

    /**
     * Calcula la firma SHA-1 requerida por la API de Cloudinary
     */
    async sha1(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Borrado automático y permanente de un audio en Cloudinary
     */
    async deleteAudio(publicIdOrUrl) {
        if (!publicIdOrUrl) return false;

        let publicId = publicIdOrUrl;
        if (typeof publicIdOrUrl === 'string' && (publicIdOrUrl.startsWith('http://') || publicIdOrUrl.startsWith('https://'))) {
            publicId = this.extractPublicId(publicIdOrUrl);
        }
        if (!publicId) return false;

        const timestamp = Math.floor(Date.now() / 1000);
        const stringToSign = `public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`;
        const signature = await this.sha1(stringToSign);

        const formData = new FormData();
        formData.append('public_id', publicId);
        formData.append('api_key', API_KEY);
        formData.append('timestamp', timestamp);
        formData.append('signature', signature);

        try {
            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/destroy`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                console.warn(`Aviso borrando archivo en Cloudinary (${response.status}):`, await response.text());
                return false;
            }

            const data = await response.json();
            console.log("Cloudinary auto-delete completado con éxito:", publicId, data);
            return data.result === 'ok';
        } catch (error) {
            console.warn("No se pudo completar el borrado en Cloudinary:", error);
            return false;
        }
    }
}

export const cloudinaryService = new CloudinaryService();
