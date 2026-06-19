import React, { useState, useEffect } from 'react';

function Configuracoes() {
    const [config, setConfig] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState(null);
    const [message, setMessage] = useState('');
    const [appVersion, setAppVersion] = useState('');
    const [checkingUpdate, setCheckingUpdate] = useState(false);
    const [updateMsg, setUpdateMsg] = useState('');
    const [passwordSet, setPasswordSet] = useState(false);
    const [senhaAtual, setSenhaAtual] = useState('');
    const [senhaNova, setSenhaNova] = useState('');
    const [senhaConfirm, setSenhaConfirm] = useState('');
    const [senhaMsg, setSenhaMsg] = useState('');

    useEffect(() => {
        loadConfig();
        if (window.electronAPI?.getAppVersion) {
            window.electronAPI.getAppVersion().then(v => setAppVersion(v));
        }
        if (window.electronAPI?.isAdminPasswordSet) {
            window.electronAPI.isAdminPasswordSet().then(set => setPasswordSet(set));
        }
    }, []);

    const loadConfig = async () => {
        try {
            if (window.electronAPI) {
                const data = await window.electronAPI.getAllConfig();
                setConfig(data);
            }
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (key, value) => {
        setConfig({ ...config, [key]: value });
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage('');
        try {
            if (window.electronAPI) {
                for (const [key, value] of Object.entries(config)) {
                    await window.electronAPI.setConfig(key, value);
                }
                setMessage('✅ Configurações salvas com sucesso!');
                // Reinicializar sync com novas credenciais
                if (window.electronAPI.syncInitialize) {
                    await window.electronAPI.syncInitialize();
                }
            }
        } catch (error) {
            setMessage('❌ Erro ao salvar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleBackup = async () => {
        setSyncing(true);
        setSyncStatus({ type: 'backup', message: 'Iniciando backup...' });
        setMessage('');
        try {
            if (window.electronAPI && window.electronAPI.syncBackup) {
                const result = await window.electronAPI.syncBackup();
                if (result.success) {
                    setSyncStatus({
                        type: 'backup',
                        success: true,
                        message: '✅ Backup realizado com sucesso! Seus dados locais estão salvos na nuvem.'
                    });
                } else {
                    setSyncStatus({
                        type: 'backup',
                        success: false,
                        message: 'Erro no backup: ' + (result.error || 'Erro desconhecido')
                    });
                }
            }
        } catch (error) {
            setSyncStatus({ type: 'backup', success: false, message: 'Erro: ' + error.message });
        } finally {
            setSyncing(false);
        }
    };

    const handleRestore = async () => {
        const confirmacao = window.confirm("ATENÇÃO: Restaurar o backup irá APAGAR todos os dados atuais deste computador e substituir pelos da nuvem.\n\nTem certeza que deseja continuar?");
        if (!confirmacao) return;

        setSyncing(true);
        setSyncStatus({ type: 'restore', message: 'Restaurando backup...' });
        setMessage('');
        try {
            if (window.electronAPI && window.electronAPI.syncRestore) {
                const result = await window.electronAPI.syncRestore();
                if (result.success) {
                    setSyncStatus({
                        type: 'restore',
                        success: true,
                        message: '✅ Restauração concluída! Dados atualizados com sucesso.'
                    });
                    // Recarregar app pode ser boa ideia, mas state reload já deve ajudar se usuário navegar
                    alert("Restauração concluída com sucesso!");
                } else {
                    setSyncStatus({
                        type: 'restore',
                        success: false,
                        message: 'Erro na restauração: ' + (result.error || 'Erro desconhecido')
                    });
                }
            }
        } catch (error) {
            setSyncStatus({ type: 'restore', success: false, message: 'Erro: ' + error.message });
        } finally {
            setSyncing(false);
        }
    };

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Configurações</h1>
                    <p className="page-subtitle">Personalize o sistema</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                >
                    <i className="fas fa-save"></i>
                    {saving ? 'Salvando...' : 'Salvar'}
                </button>
            </div>

            {message && (
                <div className="card" style={{
                    padding: '16px',
                    borderLeft: message.includes('✅') ? '4px solid var(--secondary)' : '4px solid var(--danger)',
                    marginBottom: '24px'
                }}>
                    <p style={{ margin: 0 }}>{message}</p>
                </div>
            )}

            {/* Dados da Empresa */}
            <div className="card">
                <h3 style={{ marginBottom: '20px' }}>
                    <i className="fas fa-building" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>
                    Dados da Empresa
                </h3>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Nome da Empresa</label>
                        <input
                            type="text"
                            value={config['empresa.nome'] || ''}
                            onChange={(e) => handleChange('empresa.nome', e.target.value)}
                            className="form-input"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Subtítulo</label>
                        <input
                            type="text"
                            value={config['empresa.subtitulo'] || ''}
                            onChange={(e) => handleChange('empresa.subtitulo', e.target.value)}
                            className="form-input"
                        />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">CNPJ</label>
                        <input
                            type="text"
                            value={config['empresa.cnpj'] || ''}
                            onChange={(e) => handleChange('empresa.cnpj', e.target.value)}
                            className="form-input"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Telefone</label>
                        <input
                            type="text"
                            value={config['empresa.telefone'] || ''}
                            onChange={(e) => handleChange('empresa.telefone', e.target.value)}
                            className="form-input"
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Endereço Completo</label>
                    <input
                        type="text"
                        value={config['empresa.endereco'] || ''}
                        onChange={(e) => handleChange('empresa.endereco', e.target.value)}
                        className="form-input"
                    />
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            value={config['empresa.email'] || ''}
                            onChange={(e) => handleChange('empresa.email', e.target.value)}
                            className="form-input"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Instagram</label>
                        <input
                            type="text"
                            value={config['empresa.instagram'] || ''}
                            onChange={(e) => handleChange('empresa.instagram', e.target.value)}
                            className="form-input"
                        />
                    </div>
                </div>
            </div>

            {/* Configurações Padrão */}
            <div className="card">
                <h3 style={{ marginBottom: '20px' }}>
                    <i className="fas fa-cog" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>
                    Valores Padrão
                </h3>

                <div className="form-group">
                    <label className="form-label">Vendedor Padrão</label>
                    <input
                        type="text"
                        value={config['vendedor.padrao'] || ''}
                        onChange={(e) => handleChange('vendedor.padrao', e.target.value)}
                        className="form-input"
                    />
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Prazo de Pagamento Padrão</label>
                        <input
                            type="text"
                            value={config['observacoes.prazo_pagamento'] || ''}
                            onChange={(e) => handleChange('observacoes.prazo_pagamento', e.target.value)}
                            className="form-input"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Prazo de Entrega Padrão</label>
                        <input
                            type="text"
                            value={config['observacoes.prazo_entrega'] || ''}
                            onChange={(e) => handleChange('observacoes.prazo_entrega', e.target.value)}
                            className="form-input"
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Garantia Padrão</label>
                    <textarea
                        value={config['observacoes.garantia'] || ''}
                        onChange={(e) => handleChange('observacoes.garantia', e.target.value)}
                        className="form-input form-textarea"
                        style={{ minHeight: '80px' }}
                    />
                </div>
            </div>

            {/* Gestão de Dados (Nuvem) */}
            <div className="card">
                <h3 style={{ marginBottom: '20px' }}>
                    <i className="fas fa-cloud" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>
                    Gestão de Dados na Nuvem (Backup & Restore)
                </h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
                    Salva seus dados na nuvem para segurança ou restaura em caso de perda.
                    <br />
                    <small>Configure a URL e Chave do Supabase abaixo.</small>
                </p>

                <div className="form-group">
                    <label className="form-label">URL do Supabase</label>
                    <input
                        type="text"
                        value={config['supabase.url'] || ''}
                        onChange={(e) => handleChange('supabase.url', e.target.value)}
                        className="form-input"
                        placeholder="https://xxxxx.supabase.co"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Anon Key</label>
                    <input
                        type="password"
                        value={config['supabase.anon_key'] || ''}
                        onChange={(e) => handleChange('supabase.anon_key', e.target.value)}
                        className="form-input"
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                    />
                </div>

                <div style={{ marginTop: '30px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>

                    {/* Cartão de Backup */}
                    <div style={{ flex: 1, minWidth: '280px', padding: '15px', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)' }}>
                        <h4 style={{ marginBottom: '10px' }}>⬆️ Fazer Backup (Enviar)</h4>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '15px' }}>
                            Envia todos os seus dados locais para a nuvem.
                            <strong>Os dados na nuvem serão substituídos pelos dados deste computador.</strong>
                        </p>
                        <button
                            className="btn btn-primary"
                            onClick={handleBackup}
                            disabled={syncing || !config['supabase.url'] || !config['supabase.anon_key']}
                            style={{ width: '100%' }}
                        >
                            <i className={`fas ${syncing && syncStatus?.type === 'backup' ? 'fa-spinner fa-spin' : 'fa-cloud-upload-alt'}`}></i>
                            {syncing && syncStatus?.type === 'backup' ? 'Enviando...' : 'Fazer Backup Agora'}
                        </button>
                    </div>

                    {/* Cartão de Restore */}
                    <div style={{ flex: 1, minWidth: '280px', padding: '15px', border: '1px solid var(--danger)', borderRadius: '8px', backgroundColor: 'rgba(244, 67, 54, 0.05)' }}>
                        <h4 style={{ marginBottom: '10px', color: 'var(--danger)' }}>⬇️ Restaurar (Baixar)</h4>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '15px' }}>
                            Baixa os dados da nuvem para este computador.
                            <strong>CUIDADO: Todos os dados locais atuais serão APAGADOS e substituídos pelo backup.</strong>
                        </p>
                        <button
                            className="btn btn-danger"
                            onClick={handleRestore}
                            disabled={syncing || !config['supabase.url'] || !config['supabase.anon_key']}
                            style={{ width: '100%', backgroundColor: 'var(--danger)', color: 'white', border: 'none' }}
                        >
                            <i className={`fas ${syncing && syncStatus?.type === 'restore' ? 'fa-spinner fa-spin' : 'fa-cloud-download-alt'}`}></i>
                            {syncing && syncStatus?.type === 'restore' ? 'Restaurando...' : 'Restaurar Backup'}
                        </button>
                    </div>
                </div>

                {syncStatus && syncStatus.message && (
                    <div style={{
                        marginTop: '20px',
                        padding: '10px 16px',
                        borderRadius: '8px',
                        backgroundColor: syncStatus.success ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
                        border: `1px solid ${syncStatus.success ? 'var(--secondary)' : 'var(--danger)'}`,
                        color: syncStatus.success ? 'var(--secondary)' : 'var(--danger)',
                        fontSize: '14px'
                    }}>
                        <i className={`fas ${syncStatus.success ? 'fa-check-circle' : 'fa-exclamation-circle'}`} style={{ marginRight: '8px' }}></i>
                        {syncStatus.message}
                    </div>
                )}
            </div>

            {/* Google Drive */}
            <div className="card">
                <h3 style={{ marginBottom: '20px' }}>
                    <i className="fab fa-google-drive" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>
                    Google Drive
                </h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
                    Configure para salvar PDFs automaticamente no Google Drive.
                </p>

                <div className="form-group">
                    <label className="form-label">ID da Pasta no Drive</label>
                    <input
                        type="text"
                        value={config['google_drive.folder_id'] || ''}
                        onChange={(e) => handleChange('google_drive.folder_id', e.target.value)}
                        className="form-input"
                        placeholder="Copie o ID da URL da pasta"
                    />
                </div>
            </div>

            {/* Segurança */}
            <div className="card">
                <h3 style={{ marginBottom: '20px' }}>
                    <i className="fas fa-shield-alt" style={{ marginRight: '10px', color: 'var(--warning)' }}></i>
                    Segurança
                </h3>

                {!passwordSet && (
                    <div style={{ background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: 'var(--warning)', fontSize: '0.9rem' }}>
                        <i className="fas fa-exclamation-triangle" style={{ marginRight: '8px' }}></i>
                        Nenhuma senha de acesso definida. Defina uma abaixo para proteger esta área.
                    </div>
                )}

                <div style={{ display: 'grid', gap: '14px', maxWidth: '380px' }}>
                    {passwordSet && (
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Senha atual</label>
                            <input type="password" className="form-input" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} placeholder="Digite a senha atual" />
                        </div>
                    )}
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Nova senha</label>
                        <input type="password" className="form-input" value={senhaNova} onChange={e => setSenhaNova(e.target.value)} placeholder="Nova senha (mínimo 6 caracteres)" />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Confirmar nova senha</label>
                        <input type="password" className="form-input" value={senhaConfirm} onChange={e => setSenhaConfirm(e.target.value)} placeholder="Repita a nova senha" />
                    </div>

                    {senhaMsg && (
                        <p style={{ margin: 0, fontSize: '0.9rem', color: senhaMsg.startsWith('✅') ? 'var(--secondary)' : 'var(--danger)' }}>{senhaMsg}</p>
                    )}

                    <button
                        className="btn btn-warning"
                        style={{ alignSelf: 'flex-start' }}
                        onClick={async () => {
                            setSenhaMsg('');
                            if (senhaNova.length < 6) { setSenhaMsg('❌ A nova senha deve ter pelo menos 6 caracteres.'); return; }
                            if (senhaNova !== senhaConfirm) { setSenhaMsg('❌ As senhas não coincidem.'); return; }
                            if (passwordSet) {
                                const ok = await window.electronAPI.checkAdminPassword(senhaAtual);
                                if (!ok) { setSenhaMsg('❌ Senha atual incorreta.'); return; }
                            }
                            await window.electronAPI.setConfig('admin.password', senhaNova);
                            setPasswordSet(true);
                            setSenhaAtual(''); setSenhaNova(''); setSenhaConfirm('');
                            setSenhaMsg('✅ Senha alterada com sucesso!');
                        }}
                    >
                        <i className="fas fa-key" style={{ marginRight: '8px' }}></i>
                        {passwordSet ? 'Alterar Senha' : 'Definir Senha'}
                    </button>
                </div>
            </div>

            {/* Sobre / Atualizações */}
            <div className="card">
                <h3 style={{ marginBottom: '20px' }}>
                    <i className="fas fa-sync-alt" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>
                    Sobre &amp; Atualizações
                </h3>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <p style={{ margin: 0, fontWeight: '600' }}>Entre Tramas — Orçamentos</p>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Versão atual: <strong>{appVersion ? `v${appVersion}` : 'carregando...'}</strong>
                        </p>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            O app verifica atualizações automaticamente a cada 2 horas.
                        </p>
                    </div>

                    <button
                        className="btn btn-secondary"
                        disabled={checkingUpdate}
                        onClick={async () => {
                            setCheckingUpdate(true);
                            setUpdateMsg('');
                            try {
                                const res = await window.electronAPI.checkForUpdates();
                                if (res?.status === 'dev') {
                                    setUpdateMsg('ℹ️ Auto-update desabilitado em modo desenvolvimento.');
                                } else {
                                    setUpdateMsg('✅ Verificação iniciada. Se houver atualização, você será avisado em instantes.');
                                }
                            } catch (e) {
                                setUpdateMsg('❌ Erro ao verificar: ' + e.message);
                            } finally {
                                setCheckingUpdate(false);
                            }
                        }}
                    >
                        <i className={`fas ${checkingUpdate ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`}></i>
                        {checkingUpdate ? 'Verificando...' : 'Verificar Atualização Agora'}
                    </button>
                </div>

                {updateMsg && (
                    <p style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{updateMsg}</p>
                )}
            </div>
        </div>
    );
}

export default Configuracoes;
