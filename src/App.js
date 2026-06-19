import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import BoletoAlertModal from './components/BoletoAlertModal';
import Dashboard from './pages/Dashboard';
import NovoOrcamento from './pages/NovoOrcamento';
import Buscar from './pages/Buscar';
import Orcamentos from './pages/Orcamentos';
import Clientes from './pages/Clientes';
import ClienteDetalhes from './pages/ClienteDetalhes';
import VendaDetalhes from './pages/VendaDetalhes';
import Vendas from './pages/Vendas';
import NovaVenda from './pages/NovaVenda';
import Configuracoes from './pages/Configuracoes';
import Backup from './pages/Backup';
import ProtectedRoute from './components/ProtectedRoute';
import NovoCliente from './pages/NovoCliente';
import StatusPedido from './pages/StatusPedido';
import Fornecedores from './pages/Fornecedores';
import Custos from './pages/Custos';
import PagamentosReceber from './pages/PagamentosReceber';
import Balanco from './pages/Balanco';

const getLocalDateStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function App() {
    const location = useLocation();
    const [appVersion, setAppVersion] = useState('');
    const [boletosHoje, setBoletosHoje] = useState([]);
    const [showBoletoModal, setShowBoletoModal] = useState(false);
    const boletoChecked = useRef(false);

    useEffect(() => {
        if (window.electronAPI?.getAppVersion) {
            window.electronAPI.getAppVersion().then(v => setAppVersion(v));
        }
    }, []);

    // Verificar boletos vencendo hoje ao abrir o app (uma vez por sessão)
    useEffect(() => {
        if (boletoChecked.current) return;
        boletoChecked.current = true;
        const timer = setTimeout(checkBoletosHoje, 3000); // aguardar init Electron
        return () => clearTimeout(timer);
    }, []);

    const checkBoletosHoje = async () => {
        if (!window.electronAPI?.getCustos) return;
        try {
            const today = getLocalDateStr();
            const custos = await window.electronAPI.getCustos();
            const pendentes = (custos || []).filter(c =>
                c.categoria === 'Boleto Bancário' &&
                c.data_vencimento === today &&
                c.status === 'Pendente'
            );
            if (pendentes.length > 0) {
                setBoletosHoje(pendentes);
                setShowBoletoModal(true);
            }
        } catch (e) {
            console.error('[App] Erro ao verificar boletos:', e);
        }
    };

    const handleMarcarBoleto = async (id) => {
        const boleto = boletosHoje.find(b => b.id === id);
        if (!boleto || !window.electronAPI?.updateCusto) return;
        try {
            const today = getLocalDateStr();
            await window.electronAPI.updateCusto(id, {
                ...boleto,
                status: 'Pago',
                data_pagamento: boleto.data_pagamento || today
            });
            const novos = boletosHoje.filter(b => b.id !== id);
            setBoletosHoje(novos);
            if (novos.length === 0) setShowBoletoModal(false);
        } catch (e) {
            console.error('[App] Erro ao marcar boleto:', e);
        }
    };

    return (
        <div className="app-container">
            {showBoletoModal && (
                <BoletoAlertModal
                    boletos={boletosHoje}
                    onClose={() => setShowBoletoModal(false)}
                    onMarcarPago={handleMarcarBoleto}
                />
            )}
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <img src={process.env.PUBLIC_URL + '/logo.jpg'} alt="Entre Tramas" className="sidebar-logo-img" />
                </div>

                <nav className="sidebar-nav">
                    <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-home"></i>
                        <span>Dashboard</span>
                    </NavLink>

                    <NavLink to="/novo" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-plus-circle"></i>
                        <span>Novo Orçamento</span>
                    </NavLink>

                    <NavLink to="/buscar" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-search"></i>
                        <span>Buscar</span>
                    </NavLink>

                    <NavLink to="/orcamentos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-file-invoice-dollar"></i>
                        <span>Orçamentos</span>
                    </NavLink>

                    <NavLink to="/vendas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-chart-line"></i>
                        <span>Vendas</span>
                    </NavLink>

                    <NavLink to="/status-pedido" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-tasks"></i>
                        <span>Status do Pedido</span>
                    </NavLink>

                    <NavLink to="/clientes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-users"></i>
                        <span>Clientes</span>
                    </NavLink>

                    <NavLink to="/fornecedores" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-truck"></i>
                        <span>Fornecedores</span>
                    </NavLink>

                    <NavLink to="/custos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-money-bill-wave"></i>
                        <span>Custos</span>
                    </NavLink>

                    <NavLink to="/pagamentos-receber" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-hand-holding-usd"></i>
                        <span>Pgtos. a Receber</span>
                    </NavLink>

                    <NavLink to="/balanco" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-chart-pie"></i>
                        <span>Balanço</span>
                    </NavLink>

                    <div style={{ height: '20px' }}></div>

                    <NavLink to="/backup" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-database"></i>
                        <span>Backup</span>
                    </NavLink>

                    <NavLink to="/config" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-cog"></i>
                        <span>Configurações</span>
                    </NavLink>
                </nav>

                <div className="sidebar-footer">
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                        {appVersion ? `v${appVersion}` : 'v1.4.12'} | © 2025 Entre Tramas
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/novo" element={<NovoOrcamento />} />
                    <Route path="/editar/:id" element={<NovoOrcamento />} />
                    <Route path="/buscar" element={<Buscar />} />
                    <Route path="/orcamentos" element={<Orcamentos />} />
                    <Route path="/orcamentos/editar/:id" element={<NovoOrcamento />} />
                    <Route path="/status-pedido" element={<StatusPedido />} />
                    <Route path="/clientes" element={<Clientes />} />
                    <Route path="/clientes/novo" element={<NovoCliente />} />
                    <Route path="/clientes/:id" element={<ClienteDetalhes />} />
                    <Route path="/fornecedores" element={<Fornecedores />} />
                    <Route path="/custos" element={<Custos />} />
                    <Route path="/pagamentos-receber" element={<PagamentosReceber />} />
                    <Route path="/balanco" element={<Balanco />} />
<Route path="/vendas" element={<Vendas />} />
                    <Route path="/vendas/:id" element={<VendaDetalhes />} />
                    <Route path="/vendas/editar/:id" element={<NovaVenda />} />
                    <Route path="/vendas/nova" element={<NovaVenda />} />
                    <Route path="/vendas/nova/:orcamentoId" element={<NovaVenda />} />
                    <Route path="/backup" element={
                        <ProtectedRoute>
                            <Backup />
                        </ProtectedRoute>
                    } />
                    <Route path="/config" element={
                        <ProtectedRoute>
                            <Configuracoes />
                        </ProtectedRoute>
                    } />
                </Routes>
            </main>
        </div>
    );
}

export default App;
