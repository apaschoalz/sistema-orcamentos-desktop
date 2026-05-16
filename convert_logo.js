// Script para converter PNG para JPEG e gerar base64
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

async function convert() {
    try {
        const img = await loadImage('./Vertical ImpressoPNG.png');
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');

        // Fundo branco para eliminar transparência
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, img.width, img.height);
        ctx.drawImage(img, 0, 0);

        const jpegData = canvas.toDataURL('image/jpeg', 0.95);
        fs.writeFileSync('logo.js', 'const logoEntreTramas = \'' + jpegData + '\';');
        console.log('Logo JPEG criada com sucesso!');
    } catch (err) {
        console.error('Erro:', err);
    }
}

convert();
