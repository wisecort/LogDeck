import { useI18n } from '../i18n'
import type { GroupMember } from '../useLogTabs'

interface Props {
  members: GroupMember[]
  hidden: ReadonlySet<string>
  colorOf(pod: string): number | undefined
  /** Click shows/hides the pod; Alt-click shows only it. */
  onToggle(pod: string, solo: boolean): void
  /** Containers every pod has; a select appears when there is more than one. */
  containers: string[]
  container?: string
  onContainer(name: string): void
}

/** One chip per pod of a group tab: color, lines received, stream state; turns the pod's lines on and off. */
export function PodChips(p: Props) {
  const { t, n } = useI18n()
  return (
    <div className="pod-chips" role="group" aria-label={t('group.pods')} data-testid="pod-chips">
      {p.members.map((m) => {
        const state = m.status?.state
        const bad = state === 'reconnecting' || state === 'error'
        const label = state === 'reconnecting' || state === 'error' || state === 'ended' || state === 'connecting' ? t(`group.state.${state}`) : undefined
        const shown = !p.hidden.has(m.pod)
        return (
          <button
            key={m.pod}
            className={`pod-chip pc-${p.colorOf(m.pod) ?? 'none'} ${bad ? 'state-bad' : ''}`}
            aria-pressed={shown}
            title={`${t('group.chipHint', { pod: m.pod, n: n(m.lines) })}${m.status?.message ? `\n${m.status.message}` : ''}`}
            onClick={(e) => p.onToggle(m.pod, e.altKey)}
          >
            <span className="swatch" aria-hidden="true" />
            <span className="chip-name">{m.pod}</span>
            {label ? (
              <span className={bad ? 'chip-state' : 'chip-count'}>{label}</span>
            ) : (
              <span className="chip-count">{n(m.lines)}</span>
            )}
          </button>
        )
      })}
      {p.containers.length > 1 && (
        <select className="chips-container" aria-label={t('sidebar.containers')} value={p.container} onChange={(e) => p.onContainer(e.target.value)}>
          {p.containers.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
