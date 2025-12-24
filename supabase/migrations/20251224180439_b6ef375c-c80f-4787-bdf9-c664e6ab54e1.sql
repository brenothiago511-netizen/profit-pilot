-- Create table for store ROI alert thresholds
CREATE TABLE public.store_roi_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  roi_threshold NUMERIC NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(store_id)
);

-- Enable RLS
ALTER TABLE public.store_roi_alerts ENABLE ROW LEVEL SECURITY;

-- Admins can manage all alerts
CREATE POLICY "Admins can manage store ROI alerts"
ON public.store_roi_alerts
FOR ALL
USING (is_admin(auth.uid()));

-- Partners can view alerts for their stores
CREATE POLICY "Partners can view alerts for their stores"
ON public.store_roi_alerts
FOR SELECT
USING (store_id IN (
  SELECT store_id FROM partners WHERE user_id = auth.uid() AND status = 'active'
));

-- Create trigger for updated_at
CREATE TRIGGER update_store_roi_alerts_updated_at
BEFORE UPDATE ON public.store_roi_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();