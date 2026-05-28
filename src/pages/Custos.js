import React, { useState, useEffect, useMemo } from 'react';
import { useSyncVersion } from '../SyncContext';

const CATEGORIAS = [
    'Aluguel', 'IPTU', 'Luz', 'Água', 'Internet', 'Gasolina',
    'Pro Labore', 'Materiais de Escritório', 'Costureira',
    'Instalador', 'Google Ads', 'Boleto Bancário', 'Outros'
];

const getLocalDateStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const fmtDate = (ds) => {
    if (!ds) return '—';
    const [y, m, d] = ds.split('-');
    return `${d}/${m}/${y}`;
};

const FORM_EMPTY = {
    descricao: '', categoria: '', fornecedor: '', valor: '',
    data_vencimento: '', data_pagamento: '', status: 'Pendente', observacoes: ''
};

const Custos = () => {
    const syncVersion = useSyncVersion();
    const [custos, setCustos] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [busca, setBusca] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('todos');
    const [filtroCategoria, setFiltroCategoria] = useState('todas');
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(FORM_EMPTY);

    const today = getLocalDateStr();
    const mesAtual = today.slice(0, 7);

    useEffect(() => { loadCustos(); }, [syncVersion]);

    const loadCustos = async () => {
        try {
            const data = await window.electronAPI.getCustos();
            setCustos(data || []);
        } catch (e) {
            console.error('Erro ao carregar custos:', e);
        }
    };

    // ── Stats ─────────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const doMes = custos.filter(c => (c.data_vencimento || '').startsWith(mesAtual));
        return {
            totalMes: doMes.reduce((s, c) => s + (c.valor || 0), 0),
            totalPago: custos.filter(c => c.status === 'Pago').reduce((s, c) => s + (c.valor || 0), 0),
            totalPendente: custos.filter(c => c.status === 'Pendente').reduce((s, c) => s + (c.valor || 0), 0),
            boletosHoje: custos.filter(c =>
                c.categoria === 'Boleto Bancário' &&
                c.data_vencimento === today &&
                c.status === 'Pendente'
            ).length,
            boletosVencidos: custos.filter(c =>
                c.categoria === 'Boleto Bancário' &&
                c.data_vencimento < today &&
                c.status === 'Pendente'
            ).length,
        };
    }, [custos, mesAtual, today]);

    // ── Filtered list ─────────────────────────────────────────────────────
    const custosVisiveis = useMemo(() => {
        let r = [...custos];
        if (filtroStatus !== 'todos') r = r.filter(c => c.status === filtroStatus);
        if (filtroCategoria !== 'todas') r = r.filter(c => c.categoria === filtroCategoria);
        if (busca) {
            const b = busca.toLowerCase();
            r = r.filter(c =>
                c.descricao?.toLowerCase().includes(b) ||
                c.fornecedor?.toLowerCase().includes(b) ||
                c.categoria?.toLowerCase().includes(b) ||
                c.observacoes?.toLowerCase().includes(b)
            );
        }
        // Sort: boletos vencidos e hoje primeiro, depois pendentes, depois pagos — por data
        return r.sort((a, b) => {
            const prioA = (a.categoria === 'Boleto Bancário' && a.status === 'Pendente' && a.data_vencimento <= today) ? 0 : a.status === 'Pendente' ? 1 : 2;
            const prioB = (b.categoria === 'Boleto Bancário' && b.status === 'Pendente' && b.data_vencimento <= today) ? 0 : b.status === 'Pendente' ? 1 : 2;
            if (prioA !== prioB) return prioA - prioB;
            return (a.data_vencimento || '').localeCompare(b.data_vencimento || '');
        });
    }, [custos, filtroStatus, filtroCategoria, busca, today]);

    // ── Form handlers ─────────────────────────────────────────────────────
    const openForm = (custo = null) => {
        setForm(custo ? { ...custo } : FORM_EMPTY);
        setEditingId(custo ? custo.id : null);
        setShowForm(true);
        setTimeout(() => document.getElementById('custo-descricao')?.focus(), 50);
    };

    const closeForm = () => { setShowForm(false); setEditingId(null); };

    const handleInput = (e) => {
        const { name, value } = e.target;
        setForm(prev => {
            const next = { ...prev, [name]: value };
            if (name === 'status' && value === 'Pago' && !prev.data_pagamento) {
                next.data_pagamento = today;
            }
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = { ...form, valor: parseFloat(form.valor) || 0 };
            if (editingId) {
                await window.electronAPI.updateCusto(editingId, payload);
            } else {
                await window.electronAPI.createCusto(payload);
            }
            closeForm();
            await loadCustos();
        } catch (err) {
            alert('Erro ao salvar: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Excluir este custo?')) return;
        try {
            await window.electronAPI.deleteCusto(id);
            await loadCustos();
        } catch (err) {
            alert('Erro ao excluir: ' + err.message);
        }
    };

    const handleMarcarPago = async (custo) => {
        try {
            await window.electronAPI.updateCusto(custo.id, {
                ...custo,
                status: 'Pago',
                data_pagamento: custo.data_pagamento || today
            });
            await loadCustos();
        } catch (err) {
            alert('Erro: ' + err.message);
        }
    };

    const handleDesmarcarPago = async (custo) => {
        try {
            await window.electronAPI.updateCusto(custo.id, {
                ...custo,
                status: 'Pendente',
                data_pagamento: ''
            });
            await loadCustos();
        } catch (err) {
            alert('Erro: ' + err.message);
        }
    };

    // ── Row classification ────────────────────────────────────────────────
    const isBoletoHoje = (c) => c.categoria === 'Boleto Bancário' && c.data_vencimento === today && c.status === 'Pendente';
    const isBoletoVencido = (c) => c.categoria === 'Boleto Bancário' && c.data_vencimento < today && c.status === 'Pendente';

    const catColor = (cat) => {
        const map = {
            'Boleto Bancário': { bg: 'rgba(232,184,74,0.15)', color: '#b8962a' },
            'Aluguel': { bg: 'rgba(139,115,85,0.12)', color: 'var(--primary)' },
            'Luz': { bg: 'rgba(232,184,74,0.12)', color: '#a07820' },
            'Água': { bg: 'rgba(99,179,237,0.15)', color: '#2b7da1' },
            'Pro Labore': { bg: 'rgba(139,115,85,0.12)', color: 'var(--primary-dark)' },
            'Google Ads': { bg: 'rgba(66,133,244,0.12)', color: '#2a5fc5' },
        };
        return map[cat] || { bg: 'rgba(139,115,85,0.08)', color: 'var(--text-muted)' };
    };

    return (
        <div>
            {/* ── Page Header ──────────────────────────────────────────── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <i className="fas fa-money-bill-wave" style={{ marginRight: '12px', color: 'var(--primary)' }}></i>
                        Custos e Despesas
                    </h1>
                    <p className="page-subtitle">Controle de custos e contas a pagar</p>
                </div>
                <button className="btn btn-primary" onClick={() => openForm()}>
                    <i className="fas fa-plus"></i>
                    Novo Custo
                </button>
            </div>

            {/* ── Stats Cards ──────────────────────────────────────────── */}
            <div className="stats-grid" style={{ marginBottom: '28px' }}>
                <div className="stat-card primary">
                    <div className="stat-icon"><i className="fas fa-calendar-alt"></i></div>
                    <div className="stat-value">{fmt(stats.totalMes)}</div>
                    <div className="stat-label">Lançado este mês</div>
                </div>
                <div className="stat-card success">
                    <div className="stat-icon"><i className="fas fa-check-circle"></i></div>
                    <div className="stat-value" style={{ color: 'var(--secondary)' }}>{fmt(stats.totalPago)}</div>
                    <div className="stat-label">Total Pago</div>
                </div>
                <div className="stat-card warning">
                    <div className="stat-icon"><i className="fas fa-clock"></i></div>
                    <div className="stat-value" style={{ color: 'var(--warning)' }}>{fmt(stats.totalPendente)}</div>
                    <div className="stat-label">Total Pendente</div>
                </div>
                <div className={`stat-card ${(stats.boletosHoje + stats.boletosVencidos) > 0 ? 'danger' : 'primary'}`}>
                    <div className="stat-icon">
                        <i className="fas fa-barcode"></i>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <div className="stat-value" style={{
                            color: stats.boletosHoje > 0 ? 'var(--danger)' : stats.boletosVencidos > 0 ? 'var(--danger)' : 'var(--text-muted)',
                        }}>
                            {stats.boletosHoje + stats.boletosVencidos}
                        </div>
                    </div>
                    <div className="stat-label">
                        {stats.boletosHoje > 0
                            ? `${stats.boletosHoje} venc. hoje${stats.boletosVencidos > 0 ? ` · ${stats.boletosVencidos} atrasado${stats.boletosVencidos > 1 ? 's' : ''}` : ''}`
                            : stats.boletosVencidos > 0
                                ? `${stats.boletosVencidos} boleto${stats.boletosVencidos > 1 ? 's' : ''} atrasado${stats.boletosVencidos > 1 ? 's' : ''}`
                                : 'Boletos pendentes'}
                    </div>
                </div>
            </div>

            {/* ── Alert banner: boletos vencendo hoje ──────────────────── */}
            {stats.boletosHoje > 0 && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(232,184,74,0.15) 0%, rgba(199,93,93,0.08) 100%)',
                    border: '1px solid rgba(232,184,74,0.5)',
                    borderLeft: '4px solid var(--warning)',
                    borderRadius: '14px',
                    padding: '14px 20px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: 'pointer'
                }} onClick={() => setFiltroCategoria('Boleto Bancário')}>
                    <span style={{ fontSize: '1.4rem' }}>🔔</span>
                    <div>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                            {stats.boletosHoje} boleto{stats.boletosHoje > 1 ? 's' : ''} vence{stats.boletosHoje > 1 ? 'm' : ''} hoje!
                        </div>
                        <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>Clique para filtrar e visualizar</div>
                    </div>
                </div>
            )}

            {/* ── Form ─────────────────────────────────────────────────── */}
            {showForm && (
                <div className="card" style={{ marginBottom: '24px', border: '2px solid var(--primary)' }}>
                    <div className="card-header">
                        <h2 className="card-title" style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{
                                width: '34px', height: '34px', borderRadius: '10px',
                                background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.9rem'
                            }}>
                                <i className={`fas ${editingId ? 'fa-edit' : 'fa-plus'}`}></i>
                            </span>
                            {editingId ? 'Editar Custo' : 'Novo Custo'}
                            {form.categoria === 'Boleto Bancário' && (
                                <span style={{
                                    marginLeft: '4px',
                                    padding: '3px 10px',
                                    borderRadius: '20px',
                                    background: 'rgba(232,184,74,0.2)',
                                    color: '#b8962a',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                }}>📄 Boleto Bancário</span>
                            )}
                        </h2>
                        <button className="btn btn-secondary btn-sm" onClick={closeForm}>
                            <i className="fas fa-times"></i>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* Row 1 */}
                        <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                            <div className="form-group">
                                <label className="form-label">Descrição *</label>
                                <input
                                    id="custo-descricao"
                                    type="text"
                                    className="form-input"
                                    name="descricao"
                                    value={form.descricao}
                                    onChange={handleInput}
                                    required
                                    placeholder="Ex: Aluguel Março, Boleto Fornecedor X..."
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Categoria *</label>
                                <select className="form-input form-select" name="categoria" value={form.categoria} onChange={handleInput} required>
                                    <option value="">Selecione...</option>
                                    {CATEGORIAS.map(cat => (
                                        <option key={cat} value={cat}>
                                            {cat === 'Boleto Bancário' ? '📄 ' : ''}{cat}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Fornecedor</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="fornecedor"
                                    value={form.fornecedor}
                                    onChange={handleInput}
                                    placeholder="Nome do fornecedor"
                                />
                            </div>
                        </div>

                        {/* Row 2 */}
                        <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                            <div className="form-group">
                                <label className="form-label">Valor (R$) *</label>
                                <input type="number" step="0.01" min="0" className="form-input" name="valor" value={form.valor} onChange={handleInput} required placeholder="0,00" />
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {form.categoria === 'Boleto Bancário' && <span style={{ color: 'var(--warning)' }}>📅</span>}
                                    Data de Vencimento
                                </label>
                                <input
                                    type="date"
                                    className="form-input"
                                    name="data_vencimento"
                                    value={form.data_vencimento}
                                    onChange={handleInput}
                                    style={form.categoria === 'Boleto Bancário' ? { borderColor: 'rgba(232,184,74,0.6)' } : {}}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Data de Pagamento</label>
                                <input type="date" className="form-input" name="data_pagamento" value={form.data_pagamento} onChange={handleInput} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Status</label>
                                <select className="form-input form-select" name="status" value={form.status} onChange={handleInput}>
                                    <option value="Pendente">⏳ Pendente</option>
                                    <option value="Pago">✅ Pago</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Observações</label>
                            <textarea
                                className="form-input form-textarea"
                                name="observacoes"
                                value={form.observacoes}
                                onChange={handleInput}
                                rows="2"
                                style={{ minHeight: '72px' }}
                                placeholder="Informações adicionais..."
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button type="button" className="btn btn-secondary" onClick={closeForm}>Cancelar</button>
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                <i className="fas fa-save"></i>
                                {saving ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── Filters ──────────────────────────────────────────────── */}
            <div className="card" style={{ padding: '16px 22px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                        <i className="fas fa-search" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}></i>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Buscar por descrição, fornecedor, categoria..."
                            value={busca}
                            onChange={e => setBusca(e.target.value)}
                            style={{ paddingLeft: '42px', marginBottom: 0 }}
                        />
                    </div>
                    <select className="form-input form-select" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ width: '160px', marginBottom: 0 }}>
                        <option value="todos">Todos os status</option>
                        <option value="Pendente">⏳ Pendente</option>
                        <option value="Pago">✅ Pago</option>
                    </select>
                    <select className="form-input form-select" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} style={{ width: '210px', marginBottom: 0 }}>
                        <option value="todas">Todas as categorias</option>
                        {CATEGORIAS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    {(busca || filtroStatus !== 'todos' || filtroCategoria !== 'todas') && (
                        <button className="btn btn-secondary btn-sm" onClick={() => { setBusca(''); setFiltroStatus('todos'); setFiltroCategoria('todas'); }}>
                            <i className="fas fa-times"></i> Limpar
                        </button>
                    )}
                </div>
                <div style={{ marginTop: '10px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {custosVisiveis.length} registro{custosVisiveis.length !== 1 ? 's' : ''}
                    {custos.length !== custosVisiveis.length && ` de ${custos.length}`}
                </div>
            </div>

            {/* ── Table ────────────────────────────────────────────────── */}
            <div style={{
                background: 'var(--bg-card)',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                marginBottom: '24px',
                overflowX: 'auto',
                overflowY: 'hidden'
            }}>
                {custos.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-receipt"></i>
                        <h3>Nenhum custo registrado</h3>
                        <p>Clique em "Novo Custo" para começar a controlar suas despesas.</p>
                        <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => openForm()}>
                            <i className="fas fa-plus"></i> Novo Custo
                        </button>
                    </div>
                ) : custosVisiveis.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-search"></i>
                        <h3>Nenhum resultado</h3>
                        <p>Tente outros termos ou remova os filtros.</p>
                    </div>
                ) : (
                    <table className="table">
                            <thead>
                                <tr>
                                    <th>Descrição</th>
                                    <th>Fornecedor</th>
                                    <th>Categoria</th>
                                    <th>Vencimento</th>
                                    <th>Pgto.</th>
                                    <th style={{ textAlign: 'right' }}>Valor</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {custosVisiveis.map(c => {
                                    const hoje = isBoletoHoje(c);
                                    const vencido = isBoletoVencido(c);
                                    const cc = catColor(c.categoria);
                                    return (
                                        <tr key={c.id} style={{
                                            background: hoje
                                                ? 'rgba(232,184,74,0.07)'
                                                : vencido
                                                    ? 'rgba(199,93,93,0.05)'
                                                    : undefined
                                        }}>
                                            <td
                                                style={{ maxWidth: '220px', cursor: 'pointer' }}
                                                onClick={() => openForm(c)}
                                                title="Clique para visualizar / editar"
                                            >
                                                <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {hoje && <span title="Vence hoje">🔔</span>}
                                                    {vencido && <span title="Vencido">⚠️</span>}
                                                    <span style={{
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                        color: 'var(--primary)', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '3px'
                                                    }}>
                                                        {c.descricao}
                                                    </span>
                                                </div>
                                                {c.observacoes && (
                                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {c.observacoes}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                                                {c.fornecedor || '—'}
                                            </td>
                                            <td>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '4px 10px',
                                                    borderRadius: '20px',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 500,
                                                    background: hoje && c.categoria === 'Boleto Bancário' ? 'rgba(232,184,74,0.22)' : cc.bg,
                                                    color: hoje && c.categoria === 'Boleto Bancário' ? '#a07820' : cc.color,
                                                }}>
                                                    {c.categoria === 'Boleto Bancário' && <i className="fas fa-barcode" style={{ fontSize: '0.68rem' }}></i>}
                                                    {c.categoria || '—'}
                                                </span>
                                            </td>
                                            <td style={{
                                                fontWeight: (hoje || vencido) ? 600 : 400,
                                                color: vencido ? 'var(--danger)' : hoje ? '#a07820' : 'var(--text-muted)',
                                                fontSize: '0.88rem',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {fmtDate(c.data_vencimento)}
                                            </td>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
                                                {fmtDate(c.data_pagamento)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                {fmt(c.valor)}
                                            </td>
                                            <td>
                                                <span className={`badge ${c.status === 'Pago' ? 'badge-approved' : 'badge-pending'}`}>
                                                    {c.status === 'Pago' ? (
                                                        <><i className="fas fa-check"></i> Pago</>
                                                    ) : (
                                                        <><i className="fas fa-clock"></i> Pendente</>
                                                    )}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                    {c.status === 'Pendente' ? (
                                                        <button
                                                            title="Marcar como Pago"
                                                            onClick={() => handleMarcarPago(c)}
                                                            style={{
                                                                padding: '6px 12px',
                                                                borderRadius: '8px',
                                                                border: '1px solid rgba(201,169,98,0.35)',
                                                                background: 'rgba(201,169,98,0.12)',
                                                                color: 'var(--secondary)',
                                                                cursor: 'pointer',
                                                                fontSize: '0.78rem',
                                                                fontWeight: 600,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '5px',
                                                                whiteSpace: 'nowrap'
                                                            }}
                                                        >
                                                            <i className="fas fa-check"></i> Pago
                                                        </button>
                                                    ) : (
                                                        <button
                                                            title="Desfazer pagamento"
                                                            onClick={() => handleDesmarcarPago(c)}
                                                            style={{
                                                                padding: '6px 12px',
                                                                borderRadius: '8px',
                                                                border: '1px solid rgba(199,93,93,0.3)',
                                                                background: 'rgba(199,93,93,0.08)',
                                                                color: 'var(--danger)',
                                                                cursor: 'pointer',
                                                                fontSize: '0.78rem',
                                                                fontWeight: 600,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '5px',
                                                                whiteSpace: 'nowrap'
                                                            }}
                                                        >
                                                            <i className="fas fa-undo"></i> Desfazer
                                                        </button>
                                                    )}
                                                    <button className="action-btn" title="Editar" onClick={() => openForm(c)}>
                                                        <i className="fas fa-edit"></i>
                                                    </button>
                                                    <button
                                                        className="action-btn"
                                                        title="Excluir"
                                                        onClick={() => handleDelete(c.id)}
                                                        style={{ color: 'var(--danger)' }}
                                                    >
                                                        <i className="fas fa-trash"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                )}
            </div>
        </div>
    );
};

export default Custos;
