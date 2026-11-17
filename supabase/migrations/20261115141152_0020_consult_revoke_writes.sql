REVOKE INSERT, UPDATE, DELETE ON public.consult_bookings FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.consult_booking_events FROM authenticated, anon;
REVOKE ALL ON public.consult_bookings FROM anon;
REVOKE ALL ON public.consult_booking_events FROM anon;