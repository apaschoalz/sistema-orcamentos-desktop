-- Create table for Fornecedores
CREATE TABLE IF NOT EXISTS public.fornecedores (
    id UUID PRIMARY KEY,
    nome TEXT NOT NULL,
    contato TEXT,
    telefone TEXT,
    email TEXT,
    endereco TEXT,
    categoria TEXT,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create table for Custos
CREATE TABLE IF NOT EXISTS public.custos (
    id UUID PRIMARY KEY,
    descricao TEXT NOT NULL,
    categoria TEXT,
    valor REAL DEFAULT 0,
    data_vencimento TEXT,
    data_pagamento TEXT,
    status TEXT,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add new columns to existing tables (Run these if your tables already exist)

-- Add 'categoria' to 'itens_orcamento'
ALTER TABLE public.itens_orcamento ADD COLUMN IF NOT EXISTS categoria TEXT;

-- Add payment fields to 'vendas'
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS valor_entrada REAL DEFAULT 0;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS falta_pagar REAL DEFAULT 0;

-- Enable Row Level Security (RLS) - Optional, but recommended
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custos ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations for authenticated users (Adjust as needed)
CREATE POLICY "Enable all for authenticated users" ON public.fornecedores
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all for authenticated users" ON public.custos
    FOR ALL USING (auth.role() = 'authenticated');
