import React, { useState } from 'react';
import { Link } from 'react-router-dom';

function Buscar() {
    const [termo, setTermo] = useState('');
    const [resultados, setResultados] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const handleSearch = async () => {
        if (!termo.trim()) return;

        setLoading(true);
        setSearched(true);
        try {
            if (window.electronAPI) {
                const data = await window.electronAPI.searchOrcamentos(termo);
                setResultados(data);
            }
        } catch (error) {
            console.error('Erro na busca:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR');
    };

    const getStatusBadge = (status) => {
        const badges = {
            'Pendente': 'badge-pending',
            'Aprovado': 'badge-approved',
            'Reprovado': 'badge-rejected'
        };
        return badges[status] || 'badge-pending';
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Buscar Orçamentos</h1>
                    <p className="page-subtitle">Pesquise por número, nome do cliente ou CPF/CNPJ</p>
                </div>
            </div>

            {/* Campo de Busca */}
            <div className="card">
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div className="search-box" style={{ flex: 1, maxWidth: 'none' }}>
                        <i className="fas fa-search"></i>
                        <input
                            type="text"
                            value={termo}
                            onChange={(e) => setTermo(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="form-input"
                            placeholder="Digite o número do orçamento, nome do cliente ou CPF/CNPJ..."
                            autoFocus
                        />
                    </div>
                    <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
                        <i className="fas fa-search"></i>
                        {loading ? 'Buscando...' : 'Buscar'}
                    </button>
                </div>
            </div>

            {/* Resultados */}
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Resultados</h2>
                    {searched && (
                        <span style={{ color: 'var(--text-muted)' }}>
                            {resultados.length} {resultados.length === 1 ? 'encontrado' : 'encontrados'}
                        </span>
                    )}
                </div>

                {!searched ? (
                    <div className="empty-state">
                        <i className="fas fa-search"></i>
                        <h3>Faça uma pesquisa</h3>
                        <p>Digite um termo de busca para encontrar orçamentos</p>
                    </div>
                ) : loading ? (
                    <div className="loading">
                        <div className="spinner"></div>
                    </div>
                ) : resultados.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-file-invoice"></i>
                        <h3>Nenhum resultado encontrado</h3>
                        <p>Tente buscar por outro termo</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Número</th>
                                    <th>Cliente</th>
                                    <th>CPF/CNPJ</th>
                                    <th>Data</th>
                                    <th>Valor</th>
                                    <th>Status</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {resultados.map((orc) => (
                                    <tr key={orc.id}>
                                        <td><strong>{orc.numero}</strong></td>
                                        <td>{orc.cliente_nome || 'N/A'}</td>
                                        <td>{orc.cliente_cpf_cnpj || '-'}</td>
                                        <td>{formatDate(orc.created_at)}</td>
                                        <td>{formatCurrency(orc.valor_total)}</td>
                                        <td>
                                            <span className={`badge ${getStatusBadge(orc.status)}`}>
                                                {orc.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="actions">
                                                <Link to={`/editar/${orc.id}`} className="action-btn" title="Editar">
                                                    <i className="fas fa-edit"></i>
                                                </Link>
                                                <button className="action-btn" title="Ver PDF">
                                                    <i className="fas fa-file-pdf"></i>
                                                </button>
                                                <button className="action-btn" title="Duplicar">
                                                    <i className="fas fa-copy"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Buscar;
