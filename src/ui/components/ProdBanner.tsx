export function ProdBanner({ context }: { context: string }) {
  return (
    <div className="prod-banner" role="alert" data-testid="prod-banner">
      Contexto de PRODUÇÃO: <strong>{context}</strong> — somente leitura, atenção redobrada
    </div>
  )
}
