import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSyncVersion } from '../SyncContext';

function ClienteDetalhes() {
    const { id } = useParams();
    const navigate = useNavigate();
    const syncVersion = useSyncVersion();

    const [cliente, setCliente] = useState(null);
    const [orcamentos, setOrcamentos] = useState([]);
    const [vendas, setVendas] = useState([]);

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('orcamentos'); // 'orcamentos' | 'vendas'
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    // Estado para edição
    const [editData, setEditData] = useState({});

    useEffect(() => {
        loadData();
    }, [id, syncVersion]);

    const loadData = async () => {
        try {
            if (window.electronAPI) {
                const clienteData = await window.electronAPI.getClienteById(id);
                setCliente(clienteData);
                setEditData(clienteData); // Inicializa dados de edição

                const orcamentosData = await window.electronAPI.getOrcamentosByCliente(id);
                setOrcamentos(orcamentosData || []);

                const vendasData = await window.electronAPI.getVendasByCliente(id);
                setVendas(vendasData || []);
            }
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (window.electronAPI) {
                await window.electronAPI.updateCliente(id, editData);
                setCliente(editData);
                setIsEditing(false);
                alert('Cliente atualizado com sucesso!');
            }
        } catch (error) {
            console.error('Erro ao atualizar cliente:', error);
            alert('Erro ao atualizar cliente.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.')) {
            return;
        }

        try {
            if (window.electronAPI) {
                await window.electronAPI.deleteCliente(id);
                alert('Cliente excluído com sucesso!');
                navigate('/clientes');
            }
        } catch (error) {
            console.error('Erro ao excluir cliente:', error);
            alert('Erro ao excluir cliente: ' + error.message);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        // Correção de timezone para datas YYYY-MM-DD
        if (typeof dateStr === 'string' && !dateStr.includes('T') && dateStr.includes('-')) {
            const [year, month, day] = dateStr.split('-');
            return `${day}/${month}/${year}`;
        }
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR');
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        );
    }

    if (!cliente) {
        return (
            <div className="empty-state">
                <h3>Cliente não encontrado</h3>
                <button className="btn btn-primary" onClick={() => navigate('/clientes')}>
                    Voltar
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">{isEditing ? 'Editar Cliente' : cliente.nome}</h1>
                    <p className="page-subtitle">Detalhes do Cliente</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-secondary" onClick={() => navigate('/clientes')}>
                        <i className="fas fa-arrow-left"></i>
                        Voltar
                    </button>
                    {!isEditing && (
                        <>
                            <button className="btn btn-danger" onClick={handleDelete} style={{ backgroundColor: '#dc3545', color: 'white', border: 'none' }}>
                                <i className="fas fa-trash"></i>
                                Excluir
                            </button>
                            <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
                                <i className="fas fa-edit"></i>
                                Editar
                            </button>
                        </>
                    )}
                    {isEditing && (
                        <>
                            <button className="btn btn-secondary" onClick={() => { setIsEditing(false); setEditData(cliente); }}>
                                Cancelar
                            </button>
                            <button className="btn btn-success" onClick={handleSave} disabled={saving} style={{ backgroundColor: '#28a745', color: 'white', border: 'none' }}>
                                <i className="fas fa-save"></i>
                                Salvar
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Informações Cadastrais</h2>
                </div>

                {isEditing ? (
                    <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className="form-group">
                            <label className="form-label">Nome</label>
                            <input className="form-input" name="nome" value={editData.nome || ''} onChange={handleEditChange} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">CPF/CNPJ</label>
                            <input className="form-input" name="cpf_cnpj" value={editData.cpf_cnpj || ''} onChange={handleEditChange} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input className="form-input" name="email" value={editData.email || ''} onChange={handleEditChange} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Telefone</label>
                            <input className="form-input" name="telefone" value={editData.telefone || ''} onChange={handleEditChange} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">CEP</label>
                            <input className="form-input" name="cep" value={editData.cep || ''} onChange={handleEditChange} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Endereço</label>
                            <input className="form-input" name="endereco" value={editData.endereco || ''} onChange={handleEditChange} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Número</label>
                            <input className="form-input" name="numero" value={editData.numero || ''} onChange={handleEditChange} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Complemento</label>
                            <input className="form-input" name="complemento" value={editData.complemento || ''} onChange={handleEditChange} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Bairro</label>
                            <input className="form-input" name="bairro" value={editData.bairro || ''} onChange={handleEditChange} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Cidade</label>
                            <input className="form-input" name="cidade" value={editData.cidade || ''} onChange={handleEditChange} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Condomínio</label>
                            <input className="form-input" name="condominio" value={editData.condominio || ''} onChange={handleEditChange} />
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                            <p><strong>CPF/CNPJ:</strong> {cliente.cpf_cnpj || '-'}</p>
                            <p><strong>Email:</strong> {cliente.email || '-'}</p>
                            <p><strong>Telefone:</strong> {cliente.telefone || '-'}</p>
                        </div>
                        <div>
                            <p><strong>Endereço:</strong> {cliente.endereco}, {cliente.numero} {cliente.complemento ? `- ${cliente.complemento}` : ''}</p>
                            <p><strong>Bairro:</strong> {cliente.bairro}</p>
                            <p><strong>Cidade:</strong> {cliente.cidade}</p>
                            <p><strong>CEP:</strong> {cliente.cep}</p>
                            {cliente.condominio && <p><strong>Condomínio:</strong> {cliente.condominio}</p>}
                        </div>
                    </div>
                )}
            </div>

            <div className="tabs" style={{ marginBottom: '20px', borderBottom: '1px solid #ddd' }}>
                <button
                    className={`btn ${activeTab === 'orcamentos' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('orcamentos')}
                    style={{ marginRight: '10px', borderRadius: '8px 8px 0 0' }}
                >
                    Orçamentos ({orcamentos.length})
                </button>
                <button
                    className={`btn ${activeTab === 'vendas' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('vendas')}
                    style={{ borderRadius: '8px 8px 0 0' }}
                >
                    Vendas ({vendas.length})
                </button>
            </div>

            {activeTab === 'orcamentos' && (
                <div className="card">
                    {orcamentos.length === 0 ? (
                        <div className="empty-state">
                            <p>Nenhum orçamento encontrado para este cliente.</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Número</th>
                                        <th>Data</th>
                                        <th>Status</th>
                                        <th>Valor Total</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orcamentos.map((orc) => (
                                        <tr key={orc.id}>
                                            <td><strong>{orc.numero}</strong></td>
                                            <td>{formatDate(orc.created_at)}</td>
                                            <td>
                                                <span className={`status-badge status-${orc.status?.toLowerCase()}`}>
                                                    {orc.status}
                                                </span>
                                            </td>
                                            <td>{formatCurrency(orc.valor_total)}</td>
                                            <td>
                                                <button
                                                    className="btn-icon"
                                                    title="Visualizar Orçamento"
                                                    onClick={() => navigate(`/orcamentos/editar/${orc.id}`)}
                                                >
                                                    <i className="fas fa-eye"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'vendas' && (
                <div className="card">
                    {vendas.length === 0 ? (
                        <div className="empty-state">
                            <p>Nenhuma venda encontrada para este cliente.</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Número</th>
                                        <th>Data</th>
                                        <th>Orçamento</th>
                                        <th>Valor</th>
                                        <th>Lucro</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {vendas.map((v) => (
                                        <tr key={v.id}>
                                            <td><strong>{v.numero}</strong></td>
                                            <td>{formatDate(v.data_venda)}</td>
                                            <td>{v.orcamento_numero || '-'}</td>
                                            <td>{formatCurrency(v.valor)}</td>
                                            <td style={{ color: v.lucro >= 0 ? 'green' : 'red', fontWeight: 'bold' }}>
                                                {formatCurrency(v.lucro)}
                                            </td>
                                            <td>
                                                <button
                                                    className="btn-icon"
                                                    title="Detalhes da Venda"
                                                    onClick={() => navigate(`/vendas/${v.id}`)}
                                                >
                                                    <i className="fas fa-eye"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default ClienteDetalhes;
