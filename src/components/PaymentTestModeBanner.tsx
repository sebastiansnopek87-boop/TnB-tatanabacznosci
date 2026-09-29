const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return <div className="w-full border-b border-destructive/50 bg-destructive/15 px-4 py-2 text-center text-sm text-foreground">Płatności na żywo nie są jeszcze uruchomione.</div>;
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full border-b border-gold/40 bg-gold/10 px-4 py-2 text-center text-sm text-foreground">
        Tryb testowy — płatności w podglądzie nie pobierają prawdziwych pieniędzy.{" "}
        <a href="https://docs.lovable.dev/features/payments#test-and-live-environments" target="_blank" rel="noopener noreferrer" className="underline">Więcej</a>
      </div>
    );
  }
  return null;
}
