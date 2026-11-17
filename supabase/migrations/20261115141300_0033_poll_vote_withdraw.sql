GRANT DELETE ON public.article_poll_votes TO authenticated;
CREATE POLICY "own vote delete" ON public.article_poll_votes FOR DELETE TO authenticated USING (user_id = auth.uid());