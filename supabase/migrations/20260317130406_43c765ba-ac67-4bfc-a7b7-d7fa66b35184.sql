
-- Create task status enum
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled', 'overdue', 'missed');

-- Create CRM tasks table (universal - supports leads, bookings, quotations, customers)
CREATE TABLE public.crm_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Related entity (polymorphic)
  related_type TEXT NOT NULL DEFAULT 'lead', -- lead, booking, quotation, customer
  related_id UUID NOT NULL,
  
  -- Task details
  title TEXT NOT NULL,
  description TEXT,
  expected_outcome TEXT,
  task_type TEXT NOT NULL DEFAULT 'task', -- call, whatsapp, email, meeting, task, reminder, quotation_followup, payment_followup, document_request, confirmation_call
  
  -- Scheduling
  due_date DATE NOT NULL,
  due_time TIME,
  priority TEXT NOT NULL DEFAULT 'normal', -- low, normal, high, urgent
  
  -- Assignment
  assigned_to UUID,
  created_by UUID,
  
  -- Status workflow
  status public.task_status NOT NULL DEFAULT 'pending',
  
  -- Reminder & Recurrence
  reminder_before INTEGER, -- minutes before due
  repeat_rule TEXT, -- none, daily, weekly, biweekly, monthly
  
  -- Completion
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  completion_notes TEXT,
  
  -- Chaining
  next_task_id UUID REFERENCES public.crm_tasks(id),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_crm_tasks_company ON public.crm_tasks(company_id);
CREATE INDEX idx_crm_tasks_related ON public.crm_tasks(related_type, related_id);
CREATE INDEX idx_crm_tasks_assigned ON public.crm_tasks(assigned_to);
CREATE INDEX idx_crm_tasks_status ON public.crm_tasks(status);
CREATE INDEX idx_crm_tasks_due ON public.crm_tasks(due_date, due_time);

-- Updated_at trigger
CREATE TRIGGER update_crm_tasks_updated_at
  BEFORE UPDATE ON public.crm_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;

-- Company members can view tasks
CREATE POLICY "Company members can view tasks"
  ON public.crm_tasks FOR SELECT
  TO authenticated
  USING (is_company_member(auth.uid(), company_id));

-- Admins and agents can insert tasks
CREATE POLICY "Admins and agents can insert tasks"
  ON public.crm_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    is_company_member(auth.uid(), company_id) 
    AND get_company_role(auth.uid(), company_id) IN ('company_admin', 'agent')
  );

-- Admins and agents can update tasks
CREATE POLICY "Admins and agents can update tasks"
  ON public.crm_tasks FOR UPDATE
  TO authenticated
  USING (
    is_company_member(auth.uid(), company_id) 
    AND get_company_role(auth.uid(), company_id) IN ('company_admin', 'agent')
  );

-- Admins can delete tasks
CREATE POLICY "Admins can delete tasks"
  ON public.crm_tasks FOR DELETE
  TO authenticated
  USING (
    get_company_role(auth.uid(), company_id) = 'company_admin'
  );

-- Super admins can manage all tasks
CREATE POLICY "Super admins can manage all tasks"
  ON public.crm_tasks FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_tasks;
