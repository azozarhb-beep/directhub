-- Always-open channels: a single permanent general logistics thread (no shipment required) per factory.
CREATE UNIQUE INDEX IF NOT EXISTS uq_factory_threads_logistics_general
  ON public.factory_threads(factory_id) WHERE thread_kind = 'logistics' AND shipment_ref IS NULL;
