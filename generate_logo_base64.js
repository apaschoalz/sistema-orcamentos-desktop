const fs = require('fs');

const data = fs.readFileSync('./Vertical ImpressoPNG.png');
const base64 = data.toString('base64');

console.log('Base64 gerado com', base64.length, 'caracteres');

// Salvar o base64 em um arquivo de texto
fs.writeFileSync('./logo_base64.txt', base64);
console.log('Arquivo logo_base64.txt atualizado com sucesso!');
