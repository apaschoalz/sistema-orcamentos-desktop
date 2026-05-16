import React, { useState, useEffect } from 'react';

const Custos = () => {
    const [custos, setCustos] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        descricao: '',
        categoria: '',
        fornecedor: '',
        valor: '',
        data_vencimento: '',
        data_pagamento: '',
        status: 'Pendente',
        observacoes: ''
    });
    const [editingId, setEditingId] = useState(null);

    const categoriasExemplo = [
        'Aluguel', 'IPTU', 'Luz', 'Água', 'Internet', 'Gasolina',
        'Pro Labore', 'Materiais de Escritório', 'Costureira',
        'Instalador', 'Google Ads', 'Outros'
    ];

    const fornecedoresExemplo = [
        'Tapecaria Americana',
        'Fineflex',
        'Persianas Garcia',
        'Piradecore'
    ];

    useEffect(() => {
        loadCustos();
    }, []);

    const loadCustos = async () => {
        try {
            const data = await window.electronAPI.getCustos();
            setCustos(data);
        } catch (error) {
            console.error('Erro ao carregar custos:', error);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                valor: parseFloat(formData.valor) || 0
            };

            if (editingId) {
                await window.electronAPI.updateCusto(editingId, payload);
            } else {
                await window.electronAPI.createCusto(payload);
            }
            setShowForm(false);
            setEditingId(null);
            setFormData({
                descricao: '', categoria: '', fornecedor: '', valor: '',
                data_vencimento: '', data_pagamento: '',
                status: 'Pendente', observacoes: ''
            });
            loadCustos();
        } catch (error) {
            alert('Erro ao salvar custo: ' + error.message);
        }
    };

    const handleEdit = (custo) => {
        setFormData(custo);
        setEditingId(custo.id);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Tem certeza que deseja excluir este custo?')) {
            try {
                await window.electronAPI.deleteCusto(id);
                loadCustos();
            } catch (error) {
                alert('Erro ao excluir: ' + error.message);
            }
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('pt-BR');
    };

    return (
        <div className="container-fluid p-4">
            <div className="mb-5" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingBottom: '20px' }}>
                <div>
                    <h2 className="mb-1"><i className="fas fa-money-bill-wave me-2"></i>Custos e Despesas</h2>
                    <p className="text-muted mb-0">Lançamento de custos</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => {
                        setShowForm(!showForm);
                        setEditingId(null);
                        setFormData({
                            descricao: '', categoria: '', fornecedor: '', valor: '',
                            data_vencimento: '', data_pagamento: '',
                            status: 'Pendente', observacoes: ''
                        });
                    }}
                >
                    <i className={`fas ${showForm ? 'fa-minus' : 'fa-plus'} me-2`}></i>
                    {showForm ? 'Cancelar' : 'Novo Custo'}
                </button>
            </div>

            {showForm && (
                <div className="card mb-4">
                    <div className="card-header bg-light">
                        <h5 className="mb-0">{editingId ? 'Editar Custo' : 'Novo Custo'}</h5>
                    </div>
                    <div className="card-body">
                        <form onSubmit={handleSubmit}>
                            <div className="row g-3">
                                <div className="col-md-5">
                                    <label className="form-label">Descrição *</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        name="descricao"
                                        value={formData.descricao || ''}
                                        onChange={handleInputChange}
                                        required
                                        placeholder="Ex: Aluguel Fevereiro"
                                    />
                                </div>
                                <div className="col-md-3">
                                    <label className="form-label">Fornecedor</label>
                                    <select
                                        className="form-select"
                                        name="fornecedor"
                                        value={formData.fornecedor || ''}
                                        onChange={handleInputChange}
                                    >
                                        <option value="">Selecione...</option>
                                        {fornecedoresExemplo.map(f => (
                                            <option key={f} value={f}>{f}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label">Categoria</label>
                                    <select
                                        className="form-select"
                                        name="categoria"
                                        value={formData.categoria || ''}
                                        onChange={handleInputChange}
                                        required
                                    >
                                        <option value="">Selecione...</option>
                                        {categoriasExemplo.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label">Valor (R$)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="form-control"
                                        name="valor"
                                        value={formData.valor || ''}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Data Vencimento</label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        name="data_vencimento"
                                        value={formData.data_vencimento || ''}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Data Pagamento</label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        name="data_pagamento"
                                        value={formData.data_pagamento || ''}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Status</label>
                                    <select
                                        className="form-select"
                                        name="status"
                                        value={formData.status || 'Pendente'}
                                        onChange={handleInputChange}
                                    >
                                        <option value="Pendente">Pendente</option>
                                        <option value="Pago">Pago</option>
                                    </select>
                                </div>
                                <div className="col-12">
                                    <label className="form-label">Observações</label>
                                    <textarea
                                        className="form-control"
                                        name="observacoes"
                                        value={formData.observacoes || ''}
                                        onChange={handleInputChange}
                                        rows="2"
                                    ></textarea>
                                </div>
                                <div className="col-12 text-end">
                                    <button type="submit" className="btn btn-success">
                                        <i className="fas fa-save me-2"></i>Salvar
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="card">
                <div className="card-body">
                    {custos.length === 0 ? (
                        <p className="text-muted text-center my-4">Nenhum custo registrado.</p>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle">
                                <thead>
                                    <tr>
                                        <th>Data Venc.</th>
                                        <th>Descrição</th>
                                        <th>Fornecedor</th>
                                        <th>Categoria</th>
                                        <th>Valor</th>
                                        <th>Status</th>
                                        <th className="text-end">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {custos.map(c => (
                                        <tr key={c.id}>
                                            <td>{formatDate(c.data_vencimento)}</td>
                                            <td>{c.descricao}</td>
                                            <td>{c.fornecedor || '-'}</td>
                                            <td><span className="badge bg-light text-dark border">{c.categoria}</span></td>
                                            <td className="fw-bold">{formatCurrency(c.valor)}</td>
                                            <td>
                                                <span className={`badge ${c.status === 'Pago' ? 'bg-success' : 'bg-warning text-dark'}`}>
                                                    {c.status}
                                                </span>
                                            </td>
                                            <td className="text-end">
                                                <button
                                                    className="btn btn-sm btn-outline-primary me-2"
                                                    onClick={() => handleEdit(c)}
                                                >
                                                    <i className="fas fa-edit"></i>
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-outline-danger"
                                                    onClick={() => handleDelete(c.id)}
                                                >
                                                    <i className="fas fa-trash"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Custos;
