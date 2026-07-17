-- ============================================================
-- CRM Nossa Ótica - Migration 019: agendamentos/tarefas por CLIENTE
-- ============================================================
-- A agenda passa a marcar horários (exames, entregas, retornos)
-- para os CLIENTES da ótica — não mais para "leads" do funil.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON public.bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON public.tasks(client_id);
