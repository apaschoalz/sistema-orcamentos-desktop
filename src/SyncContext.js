import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Contexto global de sincronização
// Qualquer componente pode assinar syncVersion e ser re-renderizado quando dados chegam da nuvem
export const SyncContext = createContext({ syncVersion: 0 });

export function SyncProvider({ children }) {
    const [syncVersion, setSyncVersion] = useState(0);
    const [syncIndicator, setSyncIndicator] = useState(null); // { table, eventType }

    const triggerSync = useCallback((info) => {
        setSyncVersion(v => v + 1);
        if (info) {
            setSyncIndicator(info);
            setTimeout(() => setSyncIndicator(null), 3000);
        }
    }, []);

    useEffect(() => {
        if (!window.electronAPI?.onSyncDataChanged) return;

        const handler = (_event, info) => {
            console.log('[SyncContext] Dado externo recebido, atualizando UI...', info);
            triggerSync(info);
        };

        window.electronAPI.onSyncDataChanged(handler);

        return () => {
            window.electronAPI.removeSyncDataChanged?.(handler);
        };
    }, [triggerSync]);

    return (
        <SyncContext.Provider value={{ syncVersion, syncIndicator }}>
            {syncIndicator && (
                <div style={{
                    position: 'fixed',
                    top: '16px',
                    right: '16px',
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                    border: '1px solid rgba(99,102,241,0.4)',
                    borderRadius: '10px',
                    padding: '10px 16px',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                    animation: 'fadeInDown 0.3s ease',
                    color: '#c7d2fe',
                    fontSize: '13px',
                    fontWeight: 500,
                }}>
                    <span style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: '#6366f1',
                        boxShadow: '0 0 8px #6366f1',
                        display: 'inline-block',
                        animation: 'pulse 1s infinite'
                    }} />
                    🔄 Sincronizado da nuvem
                </div>
            )}
            {children}
        </SyncContext.Provider>
    );
}

export function useSyncVersion() {
    return useContext(SyncContext).syncVersion;
}
