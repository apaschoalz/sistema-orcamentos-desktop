-- ==========================================================
-- SOLUÇÃO DEFINITIVA: Sequência atômica para numeração de orçamentos
-- Execute este script UMA VEZ no SQL Editor do Supabase
-- ==========================================================

-- 1. Criar tabela de sequências (contador central)
CREATE TABLE IF NOT EXISTS sequencias (
    nome TEXT PRIMARY KEY,
    valor INTEGER NOT NULL DEFAULT 0
);

-- 2. Inicializar o contador com o maior número já existente nos orçamentos
INSERT INTO sequencias (nome, valor)
SELECT
    'orcamentos',
    COALESCE(MAX(CAST(SUBSTRING(numero FROM 5) AS INTEGER)), 0)
FROM orcamentos
WHERE numero LIKE 'ORC-%'
ON CONFLICT (nome) DO NOTHING;

-- 3. Função atômica: UPDATE + RETURNING em uma única transação
--    Impossível de executar em paralelo com o mesmo resultado — garante unicidade absoluta
CREATE OR REPLACE FUNCTION next_orcamento_numero()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    next_val INTEGER;
BEGIN
    UPDATE sequencias
    SET valor = valor + 1
    WHERE nome = 'orcamentos'
    RETURNING valor INTO next_val;

    -- Fallback: se a linha não existir ainda, criar e retornar 1
    IF next_val IS NULL THEN
        INSERT INTO sequencias (nome, valor) VALUES ('orcamentos', 1)
        ON CONFLICT (nome) DO UPDATE SET valor = sequencias.valor + 1
        RETURNING valor INTO next_val;
    END IF;

    RETURN 'ORC-' || LPAD(next_val::TEXT, 4, '0');
END;
$$;

-- 4. Permitir que o anon key chame a função (necessário para o app)
GRANT EXECUTE ON FUNCTION next_orcamento_numero() TO anon;
GRANT EXECUTE ON FUNCTION next_orcamento_numero() TO authenticated;
GRANT SELECT, UPDATE ON TABLE sequencias TO anon;
GRANT SELECT, UPDATE ON TABLE sequencias TO authenticated;

-- Verificação: teste a função
-- SELECT next_orcamento_numero();
