export function ProdBanner({ context }: { context: string }) {
  return (
    <div className="prod-banner" role="alert" data-testid="prod-banner" title={context}>
      PRODUÇÃO
    </div>
  )
}
