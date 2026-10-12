import { describe, expect, it } from 'vitest'
import { redact } from '../../src/ai/redact'

// Secret-looking samples are assembled at runtime so gitleaks does not flag this file.
const JWT = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ', 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'].join('.')
const AWS_KEY = 'AKIA' + 'IOSFODNN7EXAMPLE'
const AWS_SECRET = 'wJalrXUtnFEMI/K7MDENG/' + 'bPxRfiCYEXAMPLEKEY' // gitleaks:allow (AWS docs example)
const GCP_KEY = 'AIza' + 'SyD-1234567890abcdefghijklmnopqrstu'
const PW = 'hun' + 'ter2'

describe('redact (F7.3)', () => {
  it('masks Bearer tokens', () => {
    expect(redact(`Authorization: Bearer abc.def-123_456`).text).toBe('Authorization: Bearer [REDACTED:BEARER]')
  })

  it('masks JWTs anywhere', () => {
    expect(redact(`token in cookie session=${JWT}; path=/`).text).toBe('token in cookie session=[REDACTED:JWT]; path=/')
  })

  it.each([
    [`password=${PW}&user=x`, 'password=[REDACTED:PASSWORD]&user=x'],
    [`PASSWORD: "${PW}"`, 'PASSWORD: "[REDACTED:PASSWORD]"'],
    [`{"password":"${PW}","user":"x"}`, '{"password":"[REDACTED:PASSWORD]","user":"x"}'],
    [`passwd=${PW}`, 'passwd=[REDACTED:PASSWORD]'],
    [`pwd=${PW} next`, 'pwd=[REDACTED:PASSWORD] next'],
    [`DB_PASSWORD=${PW}`, 'DB_PASSWORD=[REDACTED:PASSWORD]'],
  ])('masks password values: %s', (input, expected) => {
    expect(redact(input).text).toBe(expected)
  })

  it.each([
    ['api_key=abcd1234efgh', 'api_key=[REDACTED:SECRET]'], // gitleaks:allow (fake value)
    ['"client_secret": "xyz-123"', '"client_secret": "[REDACTED:SECRET]"'],
    ['access_token=abc123', 'access_token=[REDACTED:SECRET]'],
    ['secret=s3cr3t', 'secret=[REDACTED:SECRET]'],
    ['X-Api-Key: abcdef123456', 'X-Api-Key: [REDACTED:SECRET]'], // gitleaks:allow (fake value)
  ])('masks secret/token/api_key values: %s', (input, expected) => {
    expect(redact(input).text).toBe(expected)
  })

  it('masks AWS access keys and secret keys', () => {
    expect(redact(`key ${AWS_KEY} used`).text).toBe('key [REDACTED:AWS_KEY] used')
    expect(redact(`aws_secret_access_key=${AWS_SECRET}`).text).toBe('aws_secret_access_key=[REDACTED:SECRET]')
  })

  it('masks GCP API keys and private keys', () => {
    expect(redact(`maps key=${GCP_KEY}`).text).not.toContain(GCP_KEY)
    expect(redact(`k ${GCP_KEY}`).text).toBe('k [REDACTED:GCP_KEY]')
    const pem = ['-----', 'BEGIN PRIVATE KEY', '-----\\nMIIEvQIBADANBgkq\\n-----', 'END PRIVATE KEY', '-----'].join('')
    expect(redact(`{"private_key": "${pem}"}`).text).toBe('{"private_key": "[REDACTED:PRIVATE_KEY]"}')
  })

  it.each([
    ['mysql://app:s3cr3t@db.example.internal:3306/portal', 'mysql://[REDACTED:URL_CREDENTIALS]@db.example.internal:3306/portal'],
    ['postgres://u:p@pg.example.internal/db', 'postgres://[REDACTED:URL_CREDENTIALS]@pg.example.internal/db'],
    ['redis://:p4ss@cache.example.internal:6379', 'redis://[REDACTED:URL_CREDENTIALS]@cache.example.internal:6379'],
    ['amqp://guest:guest@mq.example.internal', 'amqp://[REDACTED:URL_CREDENTIALS]@mq.example.internal'],
    ['mongodb+srv://u:p@cluster.example.internal/db', 'mongodb+srv://[REDACTED:URL_CREDENTIALS]@cluster.example.internal/db'],
    ['https://user:pw@git.example.internal/repo.git', 'https://[REDACTED:URL_CREDENTIALS]@git.example.internal/repo.git'],
  ])('masks credentials in URLs: %s', (input, expected) => {
    expect(redact(input).text).toBe(expected)
  })

  it('masks e-mail addresses', () => {
    expect(redact('login failed for maria.silva@example.internal').text).toBe('login failed for [REDACTED:EMAIL]')
  })

  it('masks internal IPs only when the toggle is on', () => {
    const line = '[client 10.0.0.2:48660] AH01075 upstream 192.168.1.10 and 172.16.5.4'
    expect(redact(line).text).toBe(line)
    expect(redact(line, { maskInternalIps: true }).text).toBe('[client [REDACTED:IP]:48660] AH01075 upstream [REDACTED:IP] and [REDACTED:IP]')
  })

  it.each([
    '[proxy_fcgi:error] [pid 12:tid 140213] (70007)The timeout specified has expired: [client 10.0.0.2:48660] AH01075: Error dispatching request to : (polling)',
    "chown: changing ownership of '/var/log/php-fpm/error.log': Operation not permitted",
    'password reset requested for user 42',
    'token count: 5',
    '10.0.0.2 - - [09/Oct/2026:03:26:40 +0000] "GET / HTTP/1.1" 200 19340 "-" "dashboard-okd (checagem de disponibilidade)"',
  ])('leaves a line without secrets unchanged: %s', (line) => {
    expect(redact(line)).toEqual({ text: line, count: 0, kinds: [] })
  })

  it('counts replacements and lists unique kinds', () => {
    const r = redact(`a password=${PW} b password=${PW} c user@example.internal`)
    expect(r.count).toBe(3)
    expect(r.kinds.sort()).toEqual(['EMAIL', 'PASSWORD'])
  })

  it('is idempotent', () => {
    const input = `Bearer ${JWT} password=${PW} mysql://a:b@h.example.internal ${AWS_KEY}`
    const once = redact(input).text
    expect(redact(once).text).toBe(once)
    expect(redact(once).count).toBe(0)
  })

  it('handles multi-line payloads', () => {
    expect(redact(`line1 password=${PW}\nline2 ok`).text).toBe('line1 password=[REDACTED:PASSWORD]\nline2 ok')
  })
})
