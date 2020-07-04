import { Readable } from 'stream'
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { once } from 'events'
import mergeStream from 'merge-stream'
import splitStream from 'split'
import { onceOutputLineIs } from '../../..'

const LOG_OUTPUT_LINES = false

export class CompositeProcess {
  readonly ready: Promise<void>
  readonly ended: Promise<void>
  private script: string
  private proc: ChildProcessWithoutNullStreams
  private output: string[] = []
  constructor(script: string) {
    this.script = script
    this.proc = spawn('node', ['-e', script])
    const outputStream = mergeStream([
      this.proc.stdout.setEncoding('utf8').pipe(splitStream()),
      this.proc.stderr.setEncoding('utf8').pipe(splitStream()),
    ])
    if (LOG_OUTPUT_LINES) {
      outputStream.on('data', line => console.log(line))
    }
    outputStream.on('data', line => this.output.push(line))
    this.ready = onceOutputLineIs(
      (outputStream as unknown) as Readable,
      'Started composite service'
    )
    this.ended = once(outputStream, 'end').then(() => {})
  }
  async start(): Promise<CompositeProcess> {
    await Promise.race([
      this.ready,
      this.ended.then(() =>
        Promise.reject(new CompositeProcessCrashError(this.script, this.output))
      ),
    ])
    return this
  }
  flushOutput(): string[] {
    return this.output.splice(0)
  }
  end(): Promise<void> {
    this.proc.kill('SIGINT')
    return this.ended
  }
}

export class CompositeProcessCrashError extends Error {
  constructor(script: string, output: string[]) {
    const indent = (lines: string[]) => lines.map(line => `  ${line}`)
    super(
      [
        'Composite process crashed:',
        '',
        '--- Script ---',
        ...indent(script.split(/\r?\n/)),
        '--- Output ---',
        ...indent(output),
        '--------------\n',
      ].join('\n')
    )
  }
}
