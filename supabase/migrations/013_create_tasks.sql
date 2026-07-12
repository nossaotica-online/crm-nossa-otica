-- ============================================================
-- CRM Vittus - Migration 013: Create Tasks Table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  responsavel_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  data DATE NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluida')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Criar políticas de RLS para usuários autenticados
CREATE POLICY "tasks_select_authenticated" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "tasks_insert_authenticated" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tasks_update_authenticated" ON public.tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tasks_delete_authenticated" ON public.tasks FOR DELETE TO authenticated USING (true);

-- Criar trigger para atualizar updated_at automaticamente
CREATE OR REPLACE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_tasks_data ON public.tasks(data);
CREATE INDEX IF NOT EXISTS idx_tasks_responsavel_id ON public.tasks(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_tasks_lead_id ON public.tasks(lead_id);
