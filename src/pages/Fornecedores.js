import React, { useState, useEffect, useMemo } from 'react';
import { useSyncVersion } from '../SyncContext';

const CATEGORIAS = ['Tecidos', 'Persianas', 'Ferragens', 'Papel de Parede', 'Serviços', 'Outros'];

const FORM_EMPTY = {
    nome: '', contato: '', telefone: '', email: '',
    endereco: '', categoria: '', observacoes: ''
};

const catColor = (cat) => {
    const map = {
        'Tecidos':        { bg: 'rgba(139,115,85,0.12)', color: 'var(--primary)' },
        'Persianas':      { bg: 'rgba(99,179,237,0.15)', color: '#2b7da1' },
        'Ferragens':      { bg: 'rgba(107,101,96,0.12)', color: 'var(--text-muted)' },
        'Papel de Parede':{ bg: 'rgba(232,184,74,0.15)', color: '#a07820' },
        'Serviços':       { bg: 'rgba(72,187,120,0.15)', color: '#2f855a' },
    };
    return map[cat] || { bg: 'rgba(139,115,85,0.08)', color: 'var(--text-muted)' };
};

const Fornecedores = () => {
    const syncVersion = useSyncVersion();
    const [fornecedores, setFornecedores] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(FORM_EMPTY);
    const [busca, setBusca] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => { loadFornecedores(); }, [syncVersion]);

    const loadFornecedores = async () => {
        try {
            const data = await window.electronAPI.getFornecedores();
            setFornecedores(data || []);
        } catch (e) {
            console.error('Erro ao carregar fornecedores:', e);
        }
    };

    const fornecedoresFiltrados = useMemo(() => {
        if (!busca.trim()) return fornecedores;
        const b = busca.toLowerCase();
        return fornecedores.filter(f =>
            f.nome?.toLowerCase().includes(b) ||
            f.contato?.toLowerCase().includes(b) ||
            f.telefone?.toLowerCase().includes(b) ||
            f.email?.toLowerCase().includes(b) ||
            f.categoria?.toLowerCase().includes(b)
        );
    }, [fornecedores, busca]);

    const openForm = (f = null) => {
        setForm(f ? { ...f } : FORM_EMPTY);
        setEditingId(f ? f.id : null);
        setShowForm(true);
        setTimeout(() => document.getElementById('forn-nome')?.focus(), 50);
    };

    const closeForm = () => { setShowForm(false); setEditingId(null); };

    const handleInput = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingId) {
                await window.electronAPI.updateFornecedor(editingId, form);
            } else {
                await window.electronAPI.createFornecedor(form);
            }
            closeForm();
            await loadFornecedores();
        } catch (err) {
            alert('Erro ao salvar: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Excluir este fornecedor?')) return;
        try {
            await window.electronAPI.deleteFornecedor(id);
            await loadFornecedores();
        } catch (err) {
            alert('Erro ao excluir: ' + err.message);
        }
    };

    return (
        <div>
            {/* ── Page Header ──────────────────────────────────────────── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <i className="fas fa-truck" style={{ marginRight: '12px', color: 'var(--primary)' }}></i>
                        Fornecedores
                    </h1>
                    <p className="page-subtitle">Base de dados dos fornecedores</p>
                </div>
                <button className="btn btn-primary" onClick={() => openForm()}>
                    <i className="fas fa-plus"></i>
                    Novo Fornecedor
                </button>
            </div>

            {/* ── Stats ────────────────────────────────────────────────── */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', marginBottom: '28px' }}>
                <div className="stat-card primary">
                    <div className="stat-icon"><i className="fas fa-truck"></i></div>
                    <div className="stat-value">{fornecedores.length}</div>
                    <div className="stat-label">Total de fornecedores</div>
                </div>
                {CATEGORIAS.map(cat => {
                    const count = fornecedores.filter(f => f.categoria === cat).length;
                    if (count === 0) return null;
                    const cc = catColor(cat);
                    return (
                        <div key={cat} className="stat-card" style={{ borderLeft: `4px solid ${cc.color}` }}>
                            <div className="stat-icon" style={{ background: cc.bg, color: cc.color }}>
                                <i className="fas fa-tag"></i>
                            </div>
                            <div className="stat-value" style={{ color: cc.color }}>{count}</div>
                            <div className="stat-label">{cat}</div>
                        </div>
                    );
                })}
            </div>

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
                            {editingId ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                        </h2>
                        <button className="btn btn-secondary btn-sm" onClick={closeForm}>
                            <i className="fas fa-times"></i>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* Row 1 */}
                        <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                            <div className="form-group">
                                <label className="form-label">Nome da Empresa *</label>
                                <input
                                    id="forn-nome"
                                    type="text"
                                    className="form-input"
                                    name="nome"
                                    value={form.nome}
                                    onChange={handleInput}
                                    required
                                    placeholder="Nome da empresa..."
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Nome do Contato</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="contato"
                                    value={form.contato}
                                    onChange={handleInput}
                                    placeholder="Responsável pelo contato..."
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Categoria</label>
                                <select className="form-input form-select" name="categoria" value={form.categoria} onChange={handleInput}>
                                    <option value="">Selecione...</option>
                                    {CATEGORIAS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Row 2 */}
                        <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                            <div className="form-group">
                                <label className="form-label">Telefone</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="telefone"
                                    value={form.telefone}
                                    onChange={handleInput}
                                    placeholder="(00) 00000-0000"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input
                                    type="email"
                                    className="form-input"
                                    name="email"
                                    value={form.email}
                                    onChange={handleInput}
                                    placeholder="email@empresa.com"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Endereço</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="endereco"
                                    value={form.endereco}
                                    onChange={handleInput}
                                    placeholder="Rua, número, cidade..."
                                />
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

            {/* ── Search ───────────────────────────────────────────────── */}
            <div className="card" style={{ padding: '16px 22px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <i className="fas fa-search" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}></i>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Buscar por nome, contato, telefone, categoria..."
                            value={busca}
                            onChange={e => setBusca(e.target.value)}
                            style={{ paddingLeft: '42px', marginBottom: 0 }}
                        />
                    </div>
                    {busca && (
                        <button className="btn btn-secondary btn-sm" onClick={() => setBusca('')}>
                            <i className="fas fa-times"></i> Limpar
                        </button>
                    )}
                </div>
                <div style={{ marginTop: '10px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {fornecedoresFiltrados.length} fornecedor{fornecedoresFiltrados.length !== 1 ? 'es' : ''}
                    {fornecedores.length !== fornecedoresFiltrados.length && ` de ${fornecedores.length}`}
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
                {fornecedores.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-truck"></i>
                        <h3>Nenhum fornecedor cadastrado</h3>
                        <p>Clique em "Novo Fornecedor" para começar.</p>
                        <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => openForm()}>
                            <i className="fas fa-plus"></i> Novo Fornecedor
                        </button>
                    </div>
                ) : fornecedoresFiltrados.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-search"></i>
                        <h3>Nenhum resultado</h3>
                        <p>Tente outros termos de busca.</p>
                    </div>
                ) : (
                    <table className="table" style={{ tableLayout: 'fixed' }}>
                        <colgroup>
                            <col style={{ width: '25%' }} />
                            <col style={{ width: '15%' }} />
                            <col style={{ width: '16%' }} />
                            <col style={{ width: '18%' }} />
                            <col style={{ width: '14%' }} />
                            <col style={{ width: '12%' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Contato</th>
                                <th>Telefone</th>
                                <th>Email</th>
                                <th>Categoria</th>
                                <th style={{ textAlign: 'right' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fornecedoresFiltrados.map(f => {
                                const cc = catColor(f.categoria);
                                return (
                                    <tr key={f.id}>
                                        <td
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => openForm(f)}
                                            title="Clique para editar"
                                        >
                                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                <span style={{
                                                    width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                                                    background: cc.bg, color: cc.color,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem'
                                                }}>
                                                    <i className="fas fa-truck"></i>
                                                </span>
                                                <span style={{
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    color: 'var(--primary)', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '3px'
                                                }}>
                                                    {f.nome}
                                                </span>
                                            </div>
                                            {f.observacoes && (
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {f.observacoes}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {f.contato || '—'}
                                        </td>
                                        <td style={{ fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {f.telefone ? (
                                                <a href={`tel:${f.telefone}`} style={{ color: 'var(--text)', textDecoration: 'none' }}>
                                                    <i className="fas fa-phone" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: '5px' }}></i>
                                                    {f.telefone}
                                                </a>
                                            ) : '—'}
                                        </td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {f.email || '—'}
                                        </td>
                                        <td>
                                            {f.categoria ? (
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                    padding: '4px 10px', borderRadius: '20px',
                                                    fontSize: '0.78rem', fontWeight: 500,
                                                    background: cc.bg, color: cc.color
                                                }}>
                                                    {f.categoria}
                                                </span>
                                            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                <button
                                                    className="action-btn"
                                                    title="Editar"
                                                    onClick={() => openForm(f)}
                                                >
                                                    <i className="fas fa-edit"></i>
                                                </button>
                                                <button
                                                    className="action-btn"
                                                    title="Excluir"
                                                    onClick={() => handleDelete(f.id)}
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

export default Fornecedores;
