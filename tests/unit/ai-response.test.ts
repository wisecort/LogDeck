import { describe, expect, it } from 'vitest'
import { parseResponse, writeCommands } from '../../src/ai/response'

const ANSWER = [
  '## Causa provável',
  'O Apache esgota o tempo esperando o PHP-FPM.',
  '',
  '## Próximos passos',
  '```bash',
  'kubectl get pods -n portal-hml',
  'kubectl delete pod portal-web-x -n portal-hml',
  '```',
  '```diff',
  '- pm.max_children = 5',
  '+ pm.max_children = 20',
  '```',
  'Fim.',
].join('\n')

describe('parseResponse (F7.5, F7.6)', () => {
  it('splits text, code and diff blocks', () => {
    const blocks = parseResponse(ANSWER)
    expect(blocks.map((b) => b.type)).toEqual(['text', 'code', 'diff', 'text'])
    expect(blocks[1]).toMatchObject({ lang: 'bash', content: 'kubectl get pods -n portal-hml\nkubectl delete pod portal-web-x -n portal-hml' })
    expect(blocks[2]!.content).toContain('+ pm.max_children = 20')
  })

  it('treats yaml blocks as reviewable changes too', () => {
    expect(parseResponse('```yaml\nreplicas: 2\n```')[0]).toMatchObject({ type: 'diff', lang: 'yaml' })
  })

  it('keeps an unterminated block as code', () => {
    expect(parseResponse('```bash\nkubectl get pods')).toEqual([{ type: 'code', lang: 'bash', content: 'kubectl get pods' }])
  })

  it('returns one text block for plain answers', () => {
    expect(parseResponse('só texto')).toEqual([{ type: 'text', content: 'só texto' }])
  })
})

describe('writeCommands (F7.5)', () => {
  it('flags kubectl/oc commands that change the cluster', () => {
    expect(writeCommands(ANSWER)).toEqual(['kubectl delete pod portal-web-x -n portal-hml'])
    expect(writeCommands('oc -n x rollout restart deploy/web\noc scale deploy/web --replicas=0')).toHaveLength(2)
    expect(writeCommands('kubectl --context=a apply -f x.yaml')).toHaveLength(1)
  })

  it('does not flag read-only commands', () => {
    expect(writeCommands('kubectl get pods\nkubectl describe pod x\noc logs x --previous\nkubectl auth can-i list pods')).toEqual([])
  })
})
