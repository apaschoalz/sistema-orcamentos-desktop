const path = require('path');
const os = require('os');

const appDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'entre-tramas-orcamentos', 'orcamentos.db');

try {
    const Database = require('better-sqlite3');
    const db = new Database(appDataPath);
    const rows = db.prepare("SELECT chave, valor FROM configuracoes WHERE chave LIKE 'supabase.%'").all();
    console.log(JSON.stringify(rows, null, 2));
    db.close();
} catch (e) {
    console.error('Erro:', e.message);
}
