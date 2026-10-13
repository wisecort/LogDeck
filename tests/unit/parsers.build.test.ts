import { describe, expect, it } from 'vitest'
import { parseLine } from '../../src/logs/parsers'
import { buildParser } from '../../src/logs/parsers/build'
import { fixtureLines } from '../helpers/entries'

describe('OKD/buildah build parser', () => {
  it.each([
    ['STEP 3/6: COPY app/ /opt/app-root/src/', 'INFO'],
    ['--> 1e50b24c0680', 'DEBUG'],
    ['--> Using cache 32c8c1458339', 'DEBUG'],
    ['COMMIT temp.builder.example.internal/portal-hml/portal-web-12:d8bb38cd', 'INFO'],
    ['Successfully tagged temp.builder.example.internal/x:1', 'INFO'],
    ['Pushing image image-registry.example.internal:5000/x:latest ...', 'INFO'],
    ['Push successful', 'INFO'],
    ['Getting image source signatures', 'DEBUG'],
    ['Copying blob sha256:49b6c85f038020e39d79b81506f773f7effe740ff948ed3b336192cd21c06aba', 'DEBUG'],
    ['Writing manifest to image destination', 'DEBUG'],
    ['Cloning "https://git.example.internal/team/portal-web.git" ...', 'INFO'],
    ['ERRO: extensao PHP redis ausente na imagem base', 'ERROR'],
    ['error: build error: building at STEP "RUN php -m": exit status 1', 'ERROR'],
    ['warning: the image registry is using an insecure connection', 'WARN'],
  ])('%s → %s', (line, level) => {
    const parsed = parseLine(line)
    expect(parsed.parser).toBe('build')
    expect(parsed.level).toBe(level)
  })

  it('splits STEP into step and instruction fields', () => {
    expect(buildParser.parse('STEP 5/6: RUN php -m')).toEqual({ level: 'INFO', message: 'RUN php -m', fields: { step: '5/6', instruction: 'RUN' } })
  })

  it('does not steal other formats', () => {
    expect(parseLine('[09-Oct-2026 03:26:40] WARNING: [pool www] server reached pm.max_children').parser).toBe('php-fpm')
    expect(parseLine('{"level":"error","msg":"x"}').parser).toBe('json')
  })

  it('recognizes every structural line of a build log fixture (RUN output aside)', () => {
    const lines = fixtureLines('okd-build.log')
    const unknown = lines.filter((l) => parseLine(l.trim()).level === undefined)
    expect(unknown).toEqual(['Installing dependencies from lock file', 'Generating optimized autoload files'])
  })
})
