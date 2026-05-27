import React, { useState, useEffect } from 'react';
import { useSyncVersion } from '../SyncContext';

const Fornecedores = () => {
    const syncVersion = useSyncVersion();
    const [fornecedores, setFornecedores] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        nome: '',
        contato: '',
        telefone: '',
        email: '',
        endereco: '',
        categoria: '',
        observacoes: ''
    });
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        loadFornecedores();
    }, [syncVersion]);

    const loadFornecedores = async () => {
        try {
            const data = await window.electronAPI.getFornecedores();
            setFornecedores(data);
        } catch (error) {
            console.error('Erro ao carregar fornecedores:', error);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await window.electronAPI.updateFornecedor(editingId, formData);
            } else {
                await window.electronAPI.createFornecedor(formData);
            }
            setShowForm(false);
            setEditingId(null);
            setFormData({
                nome: '', contato: '', telefone: '', email: '',
                endereco: '', categoria: '', observacoes: ''
            });
            loadFornecedores();
        } catch (error) {
            alert('Erro ao salvar fornecedor: ' + error.message);
        }
    };

    const handleEdit = (fornecedor) => {
        setFormData(fornecedor);
        setEditingId(fornecedor.id);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Tem certeza que deseja excluir este fornecedor?')) {
            try {
                await window.electronAPI.deleteFornecedor(id);
                loadFornecedores();
            } catch (error) {
                alert('Erro ao excluir: ' + error.message);
            }
        }
    };

    return (
        <div className="container-fluid p-4">
            <div className="mb-5" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingBottom: '20px' }}>
                <div>
                    <h2 className="mb-1"><i className="fas fa-truck me-2"></i>Fornecedores</h2>
                    <p className="text-muted mb-0">Base de dados dos Fornecedores</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => {
                        setShowForm(!showForm);
                        setEditingId(null);
                        setFormData({
                            nome: '', contato: '', telefone: '', email: '',
                            endereco: '', categoria: '', observacoes: ''
                        });
                    }}
                >
                    <i className={`fas ${showForm ? 'fa-minus' : 'fa-plus'} me-2`}></i>
                    {showForm ? 'Cancelar' : 'Novo Fornecedor'}
                </button>
            </div>

            {showForm && (
                <div className="card mb-4">
                    <div className="card-header bg-light">
                        <h5 className="mb-0">{editingId ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h5>
                    </div>
                    <div className="card-body">
                        <form onSubmit={handleSubmit}>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label className="form-label">Nome da Empresa *</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        name="nome"
                                        value={formData.nome || ''}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label">Nome do Contato</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        name="contato"
                                        value={formData.contato || ''}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Telefone</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        name="telefone"
                                        value={formData.telefone || ''}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Email</label>
                                    <input
                                        type="email"
                                        className="form-control"
                                        name="email"
                                        value={formData.email || ''}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Categoria</label>
                                    <select
                                        className="form-select"
                                        name="categoria"
                                        value={formData.categoria || ''}
                                        onChange={handleInputChange}
                                    >
                                        <option value="">Selecione...</option>
                                        <option value="Tecidos">Tecidos</option>
                                        <option value="Persianas">Persianas</option>
                                        <option value="Ferragens">Ferragens</option>
                                        <option value="Papel de Parede">Papel de Parede</option>
                                        <option value="Serviços">Serviços</option>
                                        <option value="Outros">Outros</option>
                                    </select>
                                </div>
                                <div className="col-12">
                                    <label className="form-label">Endereço</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        name="endereco"
                                        value={formData.endereco || ''}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="col-12">
                                    <label className="form-label">Observações</label>
                                    <textarea
                                        className="form-control"
                                        name="observacoes"
                                        value={formData.observacoes || ''}
                                        onChange={handleInputChange}
                                        rows="3"
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
                    {fornecedores.length === 0 ? (
                        <p className="text-muted text-center my-4">Nenhum fornecedor cadastrado.</p>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover">
                                <thead>
                                    <tr>
                                        <th>Nome</th>
                                        <th>Contato</th>
                                        <th>Telefone</th>
                                        <th>Categoria</th>
                                        <th className="text-end">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fornecedores.map(f => (
                                        <tr key={f.id}>
                                            <td>{f.nome}</td>
                                            <td>{f.contato}</td>
                                            <td>{f.telefone}</td>
                                            <td><span className="badge bg-secondary">{f.categoria || 'N/A'}</span></td>
                                            <td className="text-end">
                                                <button
                                                    className="btn btn-sm btn-outline-primary me-2"
                                                    onClick={() => handleEdit(f)}
                                                >
                                                    <i className="fas fa-edit"></i>
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-outline-danger"
                                                    onClick={() => handleDelete(f.id)}
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

export default Fornecedores;
