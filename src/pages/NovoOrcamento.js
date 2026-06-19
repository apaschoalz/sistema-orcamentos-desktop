import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useSyncVersion } from '../SyncContext';

function NovoOrcamento() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = !!id;
    const syncVersion = useSyncVersion();

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState({});
    const [numero, setNumero] = useState('');

    // Dados do cliente
    const [cliente, setCliente] = useState({
        id: '',
        nome: '',
        email: '',
        telefone: '',
        cpf_cnpj: '',
        cep: '',
        endereco: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        condominio: ''
    });
    const [buscandoCep, setBuscandoCep] = useState(false);
    const [cpfCnpjValido, setCpfCnpjValido] = useState(true);

    // Modal de conflito
    const [showConflictModal, setShowConflictModal] = useState(false);
    const [existingCliente, setExistingCliente] = useState(null);

    // Dados do orçamento
    const [orcamento, setOrcamento] = useState({
        vendedor: '',
        status: 'Pendente',
        observacoes: '',
        prazo_pagamento: '',
        prazo_entrega: '',
        garantia: ''
    });

    // Itens do orçamento
    const [itens, setItens] = useState([
        { id: uuidv4(), quantidade: 1, descricao: '', valor_unitario: 0, valor_total: 0, categoria: '' }
    ]);

    useEffect(() => {
        loadConfig();
        if (isEditing) {
            loadOrcamento();
        } else {
            loadNextNumero();
        }
    }, [id]);

    // Quando chega evento de sync do outro terminal, recarregar itens do banco local.
    // O SyncContext tem debounce de 250ms, garantindo que todos os itens do batch
    // já foram gravados localmente pelo Realtime antes deste efeito executar.
    useEffect(() => {
        if (!isEditing || !id) return;
        const reloadFromDB = async () => {
            try {
                const itensOrc = await window.electronAPI.getItensOrcamento(id);
                if (Array.isArray(itensOrc)) {
                    setItens(itensOrc.length > 0 ? itensOrc : [
                        { id: uuidv4(), quantidade: 1, descricao: '', valor_unitario: 0, valor_total: 0, categoria: '' }
                    ]);
                }
            } catch (e) {
                console.warn('[NovoOrcamento] Erro ao recarregar itens via syncVersion:', e);
            }
        };
        reloadFromDB();
    }, [syncVersion, id, isEditing]);

    const loadConfig = async () => {
        try {
            if (window.electronAPI) {
                const cfg = await window.electronAPI.getAllConfig();
                setConfig(cfg);
                if (!isEditing) {
                    setOrcamento(prev => ({
                        ...prev,
                        vendedor: cfg['vendedor.padrao'] || '',
                        prazo_pagamento: cfg['observacoes.prazo_pagamento'] || '',
                        prazo_entrega: cfg['observacoes.prazo_entrega'] || '',
                        garantia: cfg['observacoes.garantia'] || ''
                    }));
                }
            }
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
        }
    };

    const loadNextNumero = async () => {
        try {
            if (window.electronAPI) {
                // Usa o contador remoto (Supabase) quando disponível para evitar conflitos entre terminais
                const num = await window.electronAPI.getNextNumeroRemoto();
                setNumero(num);
            }
        } catch (error) {
            console.error('Erro ao obter número:', error);
            try {
                const num = await window.electronAPI.getNextNumero();
                setNumero(num);
            } catch (e) {
                console.error('Erro ao obter número local:', e);
            }
        }
    };

    const loadOrcamento = async () => {
        setLoading(true);
        try {
            if (window.electronAPI) {
                const orc = await window.electronAPI.getOrcamentoById(id);
                console.log('[Frontend] loadOrcamento - orc:', orc);
                if (orc) {
                    setNumero(orc.numero);
                    setCliente({
                        id: orc.cliente_id || '',
                        nome: orc.cliente_nome || '',
                        email: orc.cliente_email || '',
                        telefone: orc.cliente_telefone || '',
                        cpf_cnpj: orc.cliente_cpf_cnpj || '',
                        cep: orc.cliente_cep || '',
                        endereco: orc.cliente_endereco || '',
                        numero: orc.cliente_numero || '',
                        complemento: orc.cliente_complemento || '',
                        bairro: orc.cliente_bairro || '',
                        cidade: orc.cliente_cidade || '',
                        condominio: orc.cliente_condominio || ''
                    });
                    setOrcamento({
                        vendedor: orc.vendedor || '',
                        status: orc.status || 'Pendente',
                        observacoes: orc.observacoes || '',
                        prazo_pagamento: orc.prazo_pagamento || '',
                        prazo_entrega: orc.prazo_entrega || '',
                        garantia: orc.garantia || ''
                    });

                    // 1. Carregar itens locais (rápido)
                    const itensLocais = await window.electronAPI.getItensOrcamento(id);
                    if (itensLocais && itensLocais.length > 0) {
                        setItens(itensLocais);
                    }

                    // 2. Puxar itens frescos do Supabase (garante sincronização mesmo
                    //    que eventos Realtime tenham sido perdidos)
                    if (window.electronAPI.syncItensFromRemote) {
                        window.electronAPI.syncItensFromRemote(id).then(itensFrescos => {
                            if (Array.isArray(itensFrescos) && itensFrescos.length > 0) {
                                setItens(itensFrescos);
                            }
                        }).catch(err => console.warn('[NovoOrcamento] syncItensFromRemote:', err));
                    }
                }
            }
        } catch (error) {
            console.error('Erro ao carregar orçamento:', error);
        } finally {
            setLoading(false);
        }
    };

    // Funções de validação e formatação
    const validarCPF = (cpf) => {
        cpf = cpf.replace(/\D/g, '');
        if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
        let soma = 0, resto;
        for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
        resto = (soma * 10) % 11;
        if (resto === 10 || resto === 11) resto = 0;
        if (resto !== parseInt(cpf.substring(9, 10))) return false;
        soma = 0;
        for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
        resto = (soma * 10) % 11;
        if (resto === 10 || resto === 11) resto = 0;
        return resto === parseInt(cpf.substring(10, 11));
    };

    const validarCNPJ = (cnpj) => {
        cnpj = cnpj.replace(/\D/g, '');
        if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
        let tamanho = cnpj.length - 2;
        let numeros = cnpj.substring(0, tamanho);
        let digitos = cnpj.substring(tamanho);
        let soma = 0, pos = tamanho - 7;
        for (let i = tamanho; i >= 1; i--) {
            soma += numeros.charAt(tamanho - i) * pos--;
            if (pos < 2) pos = 9;
        }
        let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
        if (resultado !== parseInt(digitos.charAt(0))) return false;
        tamanho = tamanho + 1;
        numeros = cnpj.substring(0, tamanho);
        soma = 0;
        pos = tamanho - 7;
        for (let i = tamanho; i >= 1; i--) {
            soma += numeros.charAt(tamanho - i) * pos--;
            if (pos < 2) pos = 9;
        }
        resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
        return resultado === parseInt(digitos.charAt(1));
    };

    const formatarCpfCnpj = (valor) => {
        valor = valor.replace(/\D/g, '');
        if (valor.length <= 11) {
            // CPF
            valor = valor.replace(/(\d{3})(\d)/, '$1.$2');
            valor = valor.replace(/(\d{3})(\d)/, '$1.$2');
            valor = valor.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        } else {
            // CNPJ
            valor = valor.replace(/(\d{2})(\d)/, '$1.$2');
            valor = valor.replace(/(\d{3})(\d)/, '$1.$2');
            valor = valor.replace(/(\d{3})(\d)/, '$1/$2');
            valor = valor.replace(/(\d{4})(\d{1,2})$/, '$1-$2');
        }
        return valor;
    };

    const formatarTelefone = (valor) => {
        valor = valor.replace(/\D/g, '');
        if (valor.length > 0) {
            valor = valor.replace(/^(\d{2})(\d)/g, '($1) $2');
            valor = valor.replace(/(\d)(\d{4})$/, '$1-$2');
        }
        return valor;
    };

    const formatarCep = (valor) => {
        valor = valor.replace(/\D/g, '');
        valor = valor.replace(/(\d{5})(\d)/, '$1-$2');
        return valor;
    };

    const buscarCep = async (cep) => {
        const cepLimpo = cep.replace(/\D/g, '');
        if (cepLimpo.length !== 8) return;

        setBuscandoCep(true);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
            const data = await response.json();
            if (!data.erro) {
                setCliente(prev => ({
                    ...prev,
                    endereco: data.logradouro || '',
                    bairro: data.bairro || '',
                    cidade: `${data.localidade}${data.uf ? '/' + data.uf : ''}`
                }));
            }
        } catch (error) {
            console.error('Erro ao buscar CEP:', error);
        } finally {
            setBuscandoCep(false);
        }
    };

    const handleCpfBlur = async () => {
        const cpfCnpjLimpo = cliente.cpf_cnpj.replace(/\D/g, '');
        if ((cpfCnpjLimpo.length === 11 || cpfCnpjLimpo.length === 14) && cpfCnpjValido) {
            try {
                if (window.electronAPI) {
                    const clienteEncontrado = await window.electronAPI.getClienteByCpfCnpj(cliente.cpf_cnpj);
                    if (clienteEncontrado) {
                        // Preencher dados do cliente
                        setCliente(prev => ({
                            ...prev,
                            id: clienteEncontrado.id,
                            nome: clienteEncontrado.nome || '',
                            email: clienteEncontrado.email || '',
                            telefone: clienteEncontrado.telefone || '',
                            cep: clienteEncontrado.cep || '',
                            endereco: clienteEncontrado.endereco || '',
                            numero: clienteEncontrado.numero || '',
                            complemento: clienteEncontrado.complemento || '',
                            bairro: clienteEncontrado.bairro || '',
                            cidade: clienteEncontrado.cidade || '',
                            condominio: clienteEncontrado.condominio || ''
                        }));
                        // Feedback visual opcional? O preenchimento já é um feedback.
                        console.log('Cliente encontrado e preenchido:', clienteEncontrado.nome);
                    }
                }
            } catch (error) {
                console.error('Erro ao buscar cliente por CPF:', error);
            }
        }
    };

    const handleClienteChange = (e) => {
        let { name, value } = e.target;

        if (name === 'cpf_cnpj') {
            value = formatarCpfCnpj(value.substring(0, 18));
            const numeros = value.replace(/\D/g, '');
            if (numeros.length === 11) {
                setCpfCnpjValido(validarCPF(numeros));
            } else if (numeros.length === 14) {
                setCpfCnpjValido(validarCNPJ(numeros));
            } else {
                setCpfCnpjValido(true);
            }
        } else if (name === 'telefone') {
            value = formatarTelefone(value.substring(0, 15));
        } else if (name === 'cep') {
            value = formatarCep(value.substring(0, 9));
            const cepLimpo = value.replace(/\D/g, '');
            if (cepLimpo.length < 8) {
                setCliente(prev => ({
                    ...prev,
                    cep: value,
                    endereco: '',
                    bairro: '',
                    cidade: ''
                }));
                return;
            }
            if (cepLimpo.length === 8) {
                buscarCep(value);
            }
        }

        setCliente({ ...cliente, [name]: value });
    };

    const handleOrcamentoChange = (e) => {
        setOrcamento({ ...orcamento, [e.target.name]: e.target.value });
    };

    const handleItemChange = (index, field, value) => {
        const newItens = [...itens];
        newItens[index][field] = value;
        if (field === 'quantidade' || field === 'valor_unitario') {
            const qty = parseFloat(newItens[index].quantidade) || 0;
            const unit = parseFloat(newItens[index].valor_unitario) || 0;
            newItens[index].valor_total = qty * unit;
        }
        setItens(newItens);
    };

    const addItem = () => {
        setItens([...itens, { id: uuidv4(), quantidade: 1, descricao: '', valor_unitario: 0, valor_total: 0, categoria: '' }]);
    };

    const removeItem = (index) => {
        if (itens.length > 1) {
            setItens(itens.filter((_, i) => i !== index));
        }
    };

    const getTotal = () => {
        return itens.reduce((sum, item) => sum + (parseFloat(item.valor_total) || 0), 0);
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    const handleCheckAndSave = async () => {
        if (!cliente.nome) {
            alert('Por favor, informe o nome do cliente');
            return;
        }

        // Validação de CPF/CNPJ (Apenas se preenchido)
        const cpfCnpjLimpo = cliente.cpf_cnpj.replace(/\D/g, '');

        if (cliente.cpf_cnpj && cpfCnpjLimpo.length > 0) {
            if (cpfCnpjLimpo.length !== 11 && cpfCnpjLimpo.length !== 14) {
                alert('CPF/CNPJ incompleto. Deixe vazio se não quiser informar.');
                return;
            }
            if (!cpfCnpjValido) {
                alert('CPF/CNPJ inválido.');
                return;
            }
        }

        // Verifica duplicidade apenas se for novo cadastro (sem ID) ou se mudou o CPF e ELE EXISTIR
        if (window.electronAPI && cpfCnpjLimpo.length > 0) {
            try {
                const existing = await window.electronAPI.getClienteByCpfCnpj(cliente.cpf_cnpj);
                // Se existe cliente com este CPF e não é o cliente que estamos editando (id diferente)
                if (existing && existing.id !== cliente.id) {
                    setExistingCliente(existing);
                    setShowConflictModal(true);
                    return;
                }
            } catch (err) {
                console.error("Erro ao verificar CPF:", err);
            }
        }

        // Se não houver conflito, salva direto
        saveFinal(cliente.id);
    };

    const resolveConflict = async (action) => {
        setShowConflictModal(false);
        if (action === 'add') {
            // Vincular ao cliente existente, mas atualizando dados
            // O ID será o do cliente existente
            await saveFinal(existingCliente.id);
        } else if (action === 'replace') {
            // "Substituir" -> Deletar orçamentos anteriores (opcional, mas solicitado pelo user) 
            // ou apenas sobrescrever dados.
            // Para segurança, vamos atualizar os dados do cliente e criar o novo orçamento.
            // A parte "deletar o antigo" é delicada. Vamos assumir que o usuário
            // quer atualizar o cadastro do cliente e adicionar este orçamento como o ATUAL.
            // Se o usuário quiser deletar os antigos, ele pode fazer na lista.
            // Mas seguindo o pedido estrito: "deletar o antigo e salvar o novo".
            // Implementação: Busca último orçamento desse cliente e deleta?
            // Vamos apenas atualizar o cliente e criar o novo. Se houver colisão de orçamento pendente,
            // o sistema já cria um novo ID de orçamento, então não sobrescreve.
            await saveFinal(existingCliente.id);
        }
    };

    const saveFinal = async (targetClienteId) => {
        setSaving(true);
        try {
            if (window.electronAPI) {
                let clienteId = targetClienteId || cliente.id;

                if (!clienteId) {
                    const novoCliente = await window.electronAPI.createCliente(cliente);
                    clienteId = novoCliente.id;
                } else {
                    // Garante que o ID do objeto cliente seja o target
                    const clienteToUpdate = { ...cliente, id: clienteId };
                    await window.electronAPI.updateCliente(clienteId, clienteToUpdate);
                }

                const orcamentoData = {
                    ...orcamento,
                    numero: numero,
                    cliente_id: clienteId,
                    valor_total: getTotal()
                };

                let orcamentoId = id;
                if (isEditing) {
                    await window.electronAPI.updateOrcamento(id, orcamentoData);
                } else {
                    const novoOrc = await window.electronAPI.createOrcamento(orcamentoData);
                    orcamentoId = novoOrc.id;
                }

                await window.electronAPI.saveItensOrcamento(orcamentoId, itens);

                alert('Orçamento salvo com sucesso!');
                navigate('/orcamentos');
            }
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar orçamento: ' + error.message);
        } finally {
            setSaving(false);
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
            {/* Modal de Conflito */}
            {showConflictModal && existingCliente && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{ maxWidth: '500px', margin: '20px' }}>
                        <div className="card-header">
                            <h2 className="card-title">Cliente Já Cadastrado</h2>
                        </div>
                        <div style={{ padding: '20px' }}>
                            <p>O CPF/CNPJ <strong>{cliente.cpf_cnpj}</strong> já pertence ao cliente:</p>
                            <p style={{ fontSize: '1.2em', fontWeight: 'bold', margin: '10px 0', color: 'var(--primary)' }}>
                                {existingCliente.nome}
                            </p>
                            <p>O que deseja fazer?</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                                <button className="btn btn-primary" onClick={() => resolveConflict('add')}>
                                    <i className="fas fa-plus-circle"></i> Adicionar Orçamento (Atualizar Cliente)
                                </button>
                                <button className="btn btn-secondary" onClick={() => setShowConflictModal(false)}>
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="page-header">
                <div>
                    <h1 className="page-title">{isEditing ? 'Editar Orçamento' : 'Novo Orçamento'}</h1>
                    <p className="page-subtitle">
                        {numero && <span style={{ color: 'var(--primary-light)', fontWeight: '600' }}>{numero}</span>}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={() => navigate(-1)}>
                        <i className="fas fa-arrow-left"></i>
                        Voltar
                    </button>
                    <button className="btn btn-primary" onClick={handleCheckAndSave} disabled={saving}>
                        <i className="fas fa-save"></i>
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>

            {/* Dados do Cliente */}
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">
                        <i className="fas fa-user" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>
                        Dados do Cliente
                    </h2>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Nome *</label>
                        <input
                            type="text"
                            name="nome"
                            value={cliente.nome}
                            onChange={handleClienteChange}
                            className="form-input"
                            placeholder="Nome completo do cliente"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">
                            CPF/CNPJ
                            {!cpfCnpjValido && <span style={{ marginLeft: '8px', color: '#ff4444' }}><i className="fas fa-exclamation-circle"></i> Inválido</span>}
                        </label>
                        <input
                            type="text"
                            name="cpf_cnpj"
                            value={cliente.cpf_cnpj}
                            onChange={handleClienteChange}
                            onBlur={handleCpfBlur}
                            className="form-input"
                            placeholder="000.000.000-00 ou 00.000.000/0000-00 (Opcional)"
                            maxLength="18"
                            style={!cpfCnpjValido || (cliente.cpf_cnpj && cliente.cpf_cnpj.replace(/\D/g, '').length < 11 && cliente.cpf_cnpj.length > 0) ? { borderColor: '#ff4444' } : {}}
                        />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            name="email"
                            value={cliente.email}
                            onChange={handleClienteChange}
                            className="form-input"
                            placeholder="email@exemplo.com"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Telefone</label>
                        <input
                            type="text"
                            name="telefone"
                            value={cliente.telefone}
                            onChange={handleClienteChange}
                            className="form-input"
                            placeholder="(00) 00000-0000"
                        />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group" style={{ flex: '0 0 150px' }}>
                        <label className="form-label">
                            CEP
                            {buscandoCep && <span style={{ marginLeft: '8px', color: 'var(--primary)' }}><i className="fas fa-spinner fa-spin"></i></span>}
                        </label>
                        <input
                            type="text"
                            name="cep"
                            value={cliente.cep}
                            onChange={handleClienteChange}
                            className="form-input"
                            placeholder="00000-000"
                            maxLength="9"
                        />
                    </div>
                    <div className="form-group" style={{ flex: 2 }}>
                        <label className="form-label">Endereço</label>
                        <input
                            type="text"
                            name="endereco"
                            value={cliente.endereco}
                            onChange={handleClienteChange}
                            className="form-input"
                            placeholder="Rua/Avenida"
                            readOnly={buscandoCep}
                        />
                    </div>
                    <div className="form-group" style={{ flex: '0 0 100px' }}>
                        <label className="form-label">Número</label>
                        <input
                            type="text"
                            name="numero"
                            value={cliente.numero}
                            onChange={handleClienteChange}
                            className="form-input"
                            placeholder="Nº"
                        />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Complemento</label>
                        <input
                            type="text"
                            name="complemento"
                            value={cliente.complemento}
                            onChange={handleClienteChange}
                            className="form-input"
                            placeholder="Apto, Bloco, etc."
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Bairro</label>
                        <input
                            type="text"
                            name="bairro"
                            value={cliente.bairro}
                            onChange={handleClienteChange}
                            className="form-input"
                            placeholder="Bairro"
                            readOnly={buscandoCep}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Cidade/UF</label>
                        <input
                            type="text"
                            name="cidade"
                            value={cliente.cidade}
                            onChange={handleClienteChange}
                            className="form-input"
                            placeholder="Cidade/UF"
                            readOnly={buscandoCep}
                        />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Condomínio</label>
                        <input
                            type="text"
                            name="condominio"
                            value={cliente.condominio}
                            onChange={handleClienteChange}
                            className="form-input"
                            placeholder="Nome do condomínio"
                        />
                    </div>
                </div>
            </div>

            {/* Itens do Orçamento */}
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">
                        <i className="fas fa-list" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>
                        Itens do Orçamento
                    </h2>
                    <button className="btn btn-secondary btn-sm" onClick={addItem}>
                        <i className="fas fa-plus"></i>
                        Adicionar Item
                    </button>
                </div>

                <div style={{ marginBottom: '12px', padding: '12px', background: 'var(--bg-card-hover)', borderRadius: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 150px 120px 120px 50px', gap: '12px', fontWeight: '600', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        <span>QTDE</span>
                        <span>DESCRIÇÃO</span>
                        <span>CATEGORIA</span>
                        <span>VL. UNITÁRIO</span>
                        <span>VL. TOTAL</span>
                        <span></span>
                    </div>
                </div>

                {itens.map((item, index) => (
                    <div key={item.id} className="item-row" style={{ display: 'grid', gridTemplateColumns: '80px 1fr 150px 120px 120px 50px', gap: '12px', alignItems: 'center', marginBottom: '10px' }}>
                        <input
                            type="number" min="0"
                            value={item.quantidade}
                            onChange={(e) => handleItemChange(index, 'quantidade', e.target.value)}
                            className="form-input"
                            min="1"
                        />
                        <input
                            type="text"
                            value={item.descricao}
                            onChange={(e) => handleItemChange(index, 'descricao', e.target.value)}
                            className="form-input"
                            placeholder="Descrição do produto/serviço"
                        />
                        <select
                            value={item.categoria || ''}
                            onChange={(e) => handleItemChange(index, 'categoria', e.target.value)}
                            className="form-input"
                            style={{ padding: '8px' }}
                        >
                            <option value="">Selecione...</option>
                            <option value="Persianas">Persianas</option>
                            <option value="Cortinas">Cortinas</option>
                            <option value="Papel de Parede">Papel de Parede</option>
                            <option value="Tapetes">Tapetes</option>
                            <option value="Outros">Outros</option>
                        </select>
                        <input
                            type="number" min="0"
                            value={item.valor_unitario}
                            onChange={(e) => handleItemChange(index, 'valor_unitario', e.target.value)}
                            className="form-input"
                            step="0.01"
                            placeholder="0,00"
                        />
                        <div className="item-total">
                            {formatCurrency(item.valor_total)}
                        </div>
                        <button className="remove-item" onClick={() => removeItem(index)}>
                            <i className="fas fa-trash"></i>
                        </button>
                    </div>
                ))}

                <div className="total-box">
                    <span className="total-label">VALOR TOTAL:</span>
                    <span className="total-value">{formatCurrency(getTotal())}</span>
                </div>
            </div>

            {/* Observações */}
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">
                        <i className="fas fa-info-circle" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>
                        Informações Adicionais
                    </h2>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Vendedor</label>
                        <select
                            name="vendedor"
                            value={orcamento.vendedor}
                            onChange={handleOrcamentoChange}
                            className="form-input form-select"
                        >
                            <option value="">Selecione...</option>
                            <option value="Felipe Ribeiro">Felipe Ribeiro</option>
                            <option value="Ana Paschoal">Ana Paschoal</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Status</label>
                        <select
                            name="status"
                            value={orcamento.status}
                            onChange={handleOrcamentoChange}
                            className="form-input form-select"
                        >
                            <option value="Pendente">Pendente</option>
                            <option value="Aprovado">Aprovado</option>
                            <option value="Reprovado">Reprovado</option>
                        </select>
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Prazo de Pagamento</label>
                        <select
                            name="prazo_pagamento"
                            value={orcamento.prazo_pagamento}
                            onChange={handleOrcamentoChange}
                            className="form-input form-select"
                        >
                            <option value="">Selecione...</option>
                            <option value="PIX">PIX</option>
                            <option value="Cartão de Crédito 1x sem juros">Cartão de Crédito 1x sem juros</option>
                            <option value="Cartão de Crédito 2x sem juros">Cartão de Crédito 2x sem juros</option>
                            <option value="Cartão de Crédito 3x sem juros">Cartão de Crédito 3x sem juros</option>
                            <option value="Cartão de Crédito 4x sem juros">Cartão de Crédito 4x sem juros</option>
                            <option value="Cartão de Crédito 5x sem juros">Cartão de Crédito 5x sem juros</option>
                            <option value="Cartão de Crédito 6x sem juros">Cartão de Crédito 6x sem juros</option>
                            <option value="Cartão de Crédito 7x sem juros">Cartão de Crédito 7x sem juros</option>
                            <option value="Cartão de Crédito 8x sem juros">Cartão de Crédito 8x sem juros</option>
                            <option value="Cartão de Crédito 9x sem juros">Cartão de Crédito 9x sem juros</option>
                            <option value="Cartão de Crédito 10x sem juros">Cartão de Crédito 10x sem juros</option>
                            <option value="Cartão de Crédito 11x sem juros">Cartão de Crédito 11x sem juros</option>
                            <option value="Cartão de Crédito 12x sem juros">Cartão de Crédito 12x sem juros</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Prazo de Entrega</label>
                        <input
                            type="text"
                            name="prazo_entrega"
                            value={orcamento.prazo_entrega}
                            onChange={handleOrcamentoChange}
                            className="form-input"
                            placeholder="Ex: 20 dias"
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Garantia</label>
                    <input
                        type="text"
                        name="garantia"
                        value={orcamento.garantia}
                        onChange={handleOrcamentoChange}
                        className="form-input"
                        placeholder="Informações sobre garantia"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Observações</label>
                    <textarea
                        name="observacoes"
                        value={orcamento.observacoes}
                        onChange={handleOrcamentoChange}
                        className="form-input form-textarea"
                        placeholder="Observações adicionais..."
                    />
                </div>
            </div>
        </div>
    );
}

export default NovoOrcamento;

