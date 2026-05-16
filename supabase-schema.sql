-- SQL para criar tabelas no Supabase
-- Execute este script no SQL Editor do Supabase

-- Tabela de clientes
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cpf_cnpj TEXT,
  endereco TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  cep TEXT,
  condominio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_id TEXT
);

-- Tabela de orçamentos
CREATE TABLE IF NOT EXISTS orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  vendedor TEXT,
  status TEXT DEFAULT 'Pendente',
  valor_total DECIMAL DEFAULT 0,
  observacoes TEXT,
  prazo_pagamento TEXT,
  prazo_entrega TEXT,
  garantia TEXT,
  pdf_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_id TEXT
);

-- Tabela de itens do orçamento
CREATE TABLE IF NOT EXISTS itens_orcamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID REFERENCES orcamentos(id) ON DELETE CASCADE,
  quantidade INTEGER DEFAULT 1,
  descricao TEXT NOT NULL,
  valor_unitario DECIMAL DEFAULT 0,
  valor_total DECIMAL DEFAULT 0
);

-- Tabela de vendas
CREATE TABLE IF NOT EXISTS vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  orcamento_id UUID REFERENCES orcamentos(id) ON DELETE CASCADE,
  data_venda DATE,
  valor DECIMAL DEFAULT 0,
  custo DECIMAL DEFAULT 0,
  costureira DECIMAL DEFAULT 0,
  instalacao DECIMAL DEFAULT 0,
  outros_custos DECIMAL DEFAULT 0,
  lucro DECIMAL DEFAULT 0,
  observacoes TEXT,
  tipo_fluxo TEXT,
  etapa_atual TEXT,
  nome_costureira TEXT, 
  data_entrega_prevista DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_id TEXT
);


-- Tabela de fornecedores
CREATE TABLE IF NOT EXISTS fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  contato TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  categoria TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_id TEXT
);

-- Tabela de custos
CREATE TABLE IF NOT EXISTS custos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  categoria TEXT, -- Aluguel, IPTU, Luz, etc.
  valor DECIMAL DEFAULT 0,
  data_vencimento DATE,
  data_pagamento DATE,
  status TEXT DEFAULT 'Pendente', -- Pendente, Pago
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_id TEXT
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_orcamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE custos ENABLE ROW LEVEL SECURITY;

-- Remover policies antigas se existirem
DROP POLICY IF EXISTS "Permitir tudo clientes" ON clientes;
DROP POLICY IF EXISTS "Permitir tudo orcamentos" ON orcamentos;
DROP POLICY IF EXISTS "Permitir tudo itens" ON itens_orcamento;
DROP POLICY IF EXISTS "Permitir tudo vendas" ON vendas;
DROP POLICY IF EXISTS "Permitir tudo fornecedores" ON fornecedores;
DROP POLICY IF EXISTS "Permitir tudo custos" ON custos;

-- Policies para permitir acesso
CREATE POLICY "Permitir tudo clientes" ON clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo orcamentos" ON orcamentos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo itens" ON itens_orcamento FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo vendas" ON vendas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo fornecedores" ON fornecedores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo custos" ON custos FOR ALL USING (true) WITH CHECK (true);

-- Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at (remover se existir e recriar)
DROP TRIGGER IF EXISTS update_clientes_updated_at ON clientes;
CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_orcamentos_updated_at ON orcamentos;
CREATE TRIGGER update_orcamentos_updated_at
  BEFORE UPDATE ON orcamentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_fornecedores_updated_at ON fornecedores;
CREATE TRIGGER update_fornecedores_updated_at
  BEFORE UPDATE ON fornecedores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_custos_updated_at ON custos;
CREATE TRIGGER update_custos_updated_at
  BEFORE UPDATE ON custos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Migração: adicionar colunas novas se não existirem
DO $$ 
BEGIN
  -- Adicionar coluna numero
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'clientes' AND column_name = 'numero') THEN
    ALTER TABLE clientes ADD COLUMN numero TEXT;
  END IF;

  -- Adicionar coluna complemento
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'clientes' AND column_name = 'complemento') THEN
    ALTER TABLE clientes ADD COLUMN complemento TEXT;
  END IF;

  -- Adicionar coluna sync_id em clientes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'clientes' AND column_name = 'sync_id') THEN
    ALTER TABLE clientes ADD COLUMN sync_id TEXT;
  END IF;

  -- Adicionar coluna sync_id em orcamentos
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orcamentos' AND column_name = 'sync_id') THEN
    ALTER TABLE orcamentos ADD COLUMN sync_id TEXT;
  END IF;

  -- Adicionar coluna pdf_path em orcamentos
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orcamentos' AND column_name = 'pdf_path') THEN
    ALTER TABLE orcamentos ADD COLUMN pdf_path TEXT;
  END IF;
  -- Colunas novas em vendas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'vendas' AND column_name = 'nome_instalador') THEN
    ALTER TABLE vendas ADD COLUMN nome_instalador TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'vendas' AND column_name = 'nome_costureira') THEN
    ALTER TABLE vendas ADD COLUMN nome_costureira TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'vendas' AND column_name = 'tipo_fluxo') THEN
    ALTER TABLE vendas ADD COLUMN tipo_fluxo TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'vendas' AND column_name = 'etapa_atual') THEN
    ALTER TABLE vendas ADD COLUMN etapa_atual TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'vendas' AND column_name = 'data_entrega_prevista') THEN
    ALTER TABLE vendas ADD COLUMN data_entrega_prevista DATE;
  END IF;

   -- Novas colunas Vendas (Entrada / Falta Pagar)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'vendas' AND column_name = 'valor_entrada') THEN
    ALTER TABLE vendas ADD COLUMN valor_entrada DECIMAL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'vendas' AND column_name = 'falta_pagar') THEN
    ALTER TABLE vendas ADD COLUMN falta_pagar DECIMAL DEFAULT 0;
  END IF;

END $$;
