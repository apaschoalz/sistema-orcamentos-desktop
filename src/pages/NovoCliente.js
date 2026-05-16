import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

function NovoCliente() {
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);

    const [cliente, setCliente] = useState({
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

    const [cpfCnpjValido, setCpfCnpjValido] = useState(true);
    const [buscandoCep, setBuscandoCep] = useState(false);

    // Validações (Reaproveitadas de NovoOrcamento.js - Ideal seria extrair para utils)
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
            valor = valor.replace(/(\d{3})(\d)/, '$1.$2');
            valor = valor.replace(/(\d{3})(\d)/, '$1.$2');
            valor = valor.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        } else {
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

    const handleChange = (e) => {
        let { name, value } = e.target;

        if (name === 'cpf_cnpj') {
            value = formatarCpfCnpj(value.substring(0, 18));
            const numeros = value.replace(/\D/g, '');
            if (numeros.length === 11) {
                setCpfCnpjValido(validarCPF(numeros));
            } else if (numeros.length === 14) {
                setCpfCnpjValido(validarCNPJ(numeros));
            } else {
                setCpfCnpjValido(true); // Vazio ou incompleto não é inválido enquanto digita, validamos no save se preenchido
            }
        } else if (name === 'telefone') {
            value = formatarTelefone(value.substring(0, 15));
        } else if (name === 'cep') {
            value = formatarCep(value.substring(0, 9));
            const cepLimpo = value.replace(/\D/g, '');
            if (cepLimpo.length === 8) {
                buscarCep(value);
            }
        }

        setCliente({ ...cliente, [name]: value });
    };

    const handleSave = async () => {
        if (!cliente.nome) {
            alert('Por favor, informe o nome do cliente');
            return;
        }

        // Validação CPF/CNPJ (Opcional, mas se preenchido deve ser válido)
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

        setSaving(true);
        try {
            if (window.electronAPI) {
                // Verificar duplicidade
                if (cpfCnpjLimpo.length > 0) {
                    const existing = await window.electronAPI.getClienteByCpfCnpj(cliente.cpf_cnpj);
                    if (existing) {
                        alert(`Já existe um cliente cadastrado com este CPF/CNPJ: ${existing.nome}`);
                        setSaving(false);
                        return;
                    }
                }

                await window.electronAPI.createCliente(cliente);
                alert('Cliente cadastrado com sucesso!');
                navigate('/clientes');
            }
        } catch (error) {
            console.error('Erro ao salvar cliente:', error);
            alert('Erro ao salvar cliente: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Novo Cliente</h1>
                    <p className="page-subtitle">Cadastro de cliente avulso</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-secondary" onClick={() => navigate('/clientes')}>
                        <i className="fas fa-arrow-left"></i>
                        Voltar
                    </button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        <i className="fas fa-save"></i>
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Dados Pessoais</h2>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="form-group">
                        <label className="form-label">Nome *</label>
                        <input className="form-input" name="nome" value={cliente.nome} onChange={handleChange} placeholder="Nome completo" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">
                            CPF/CNPJ
                            {!cpfCnpjValido && cliente.cpf_cnpj && <span style={{ marginLeft: '8px', color: '#ff4444' }}><i className="fas fa-exclamation-circle"></i> Inválido</span>}
                        </label>
                        <input
                            className="form-input"
                            name="cpf_cnpj"
                            value={cliente.cpf_cnpj}
                            onChange={handleChange}
                            placeholder="Opcional"
                            style={!cpfCnpjValido && cliente.cpf_cnpj ? { borderColor: '#ff4444' } : {}}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input className="form-input" name="email" value={cliente.email} onChange={handleChange} placeholder="email@exemplo.com" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Telefone</label>
                        <input className="form-input" name="telefone" value={cliente.telefone} onChange={handleChange} placeholder="(00) 00000-0000" />
                    </div>
                </div>

                <h3 style={{ marginTop: '20px', marginBottom: '15px', fontSize: '1.2rem', color: 'var(--text-color)' }}>Endereço</h3>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="form-group">
                        <label className="form-label">
                            CEP
                            {buscandoCep && <span style={{ marginLeft: '8px', color: 'var(--primary)' }}><i className="fas fa-spinner fa-spin"></i></span>}
                        </label>
                        <input className="form-input" name="cep" value={cliente.cep} onChange={handleChange} placeholder="00000-000" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Endereço</label>
                        <input className="form-input" name="endereco" value={cliente.endereco} onChange={handleChange} placeholder="Rua, Av..." readOnly={buscandoCep} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Número</label>
                        <input className="form-input" name="numero" value={cliente.numero} onChange={handleChange} placeholder="Nº" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Complemento</label>
                        <input className="form-input" name="complemento" value={cliente.complemento} onChange={handleChange} placeholder="Apto, Bloco..." />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Bairro</label>
                        <input className="form-input" name="bairro" value={cliente.bairro} onChange={handleChange} placeholder="Bairro" readOnly={buscandoCep} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Cidade/UF</label>
                        <input className="form-input" name="cidade" value={cliente.cidade} onChange={handleChange} placeholder="Cidade/UF" readOnly={buscandoCep} />
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Condomínio</label>
                        <input className="form-input" name="condominio" value={cliente.condominio} onChange={handleChange} placeholder="Nome do condomínio" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default NovoCliente;
