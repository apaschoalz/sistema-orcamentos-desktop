const fs = require('fs');

const data = fs.readFileSync('./logo.jpg');
const base64 = data.toString('base64');
const content = 'const logoEntreTramas = "data:image/jpeg;base64,' + base64 + '";';
fs.writeFileSync('./logo.js', content);
console.log('Logo JPEG base64 criado com sucesso!');
