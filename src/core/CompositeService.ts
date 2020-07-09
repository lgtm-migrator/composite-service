import { Service } from './Service'
import serializeJavascript from 'serialize-javascript'
import {
  NormalizedCompositeServiceConfig,
  validateAndNormalizeConfig,
} from './validateAndNormalizeConfig'
import mergeStream from 'merge-stream'
import { Duplex } from 'stream'
import mapStreamAsync from 'map-stream'
import { CompositeServiceConfig } from './CompositeServiceConfig'
import { Logger } from './Logger'

export class CompositeService {
  private config: NormalizedCompositeServiceConfig
  private services: Service[]
  private serviceMap: Map<string, Service>
  private stopping = false
  private logger: Logger
  constructor(config: CompositeServiceConfig) {
    let configValidationError = ''
    let normalizedConfig: NormalizedCompositeServiceConfig | undefined
    try {
      // TODO: return *array* of errors from validateAndNormalizeConfig
      normalizedConfig = validateAndNormalizeConfig(config)
    } catch (error) {
      configValidationError = error.stack as string
    }

    this.logger = new Logger(
      normalizedConfig ? normalizedConfig.logLevel : 'debug'
    )
    this.logger.output.pipe(process.stdout)

    this.logger.debug(
      `config = ${serializeJavascript(config, { space: 2, unsafe: true })}`
    )
    if (!normalizedConfig) {
      this.logger.error(configValidationError)
      process.exit(1)
    }
    this.config = normalizedConfig

    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.on(signal, () => {
        this.die(`Received shutdown signal '${signal}'`)
      })
    }

    this.services = Object.entries(this.config.services).map(
      ([id, config]) =>
        new Service(id, config, this.logger, this.die.bind(this))
    )
    this.serviceMap = new Map(
      this.services.map(service => [service.id, service])
    )

    const maxLabelLength = Math.max(
      ...Object.keys(this.config.services).map(({ length }) => length)
    )
    mergeStream(
      this.services.map(service =>
        service.output.pipe(
          mapStream(line => `${rightPad(service.id, maxLabelLength)} | ${line}`)
        )
      )
    ).pipe(process.stdout)

    this.logger.info('Starting composite service...')
    Promise.all(
      this.services.map(service => this.startService(service))
    ).then(() => this.logger.info('Started composite service'))
  }

  private async startService(service: Service) {
    const dependencies = service.config.dependencies.map(
      id => this.serviceMap.get(id)!
    )
    await Promise.all(dependencies.map(service => this.startService(service)))
    if (this.stopping) {
      await never()
    }
    await service.start()
  }

  private die(message: string): Promise<never> {
    if (!this.stopping) {
      this.stopping = true
      this.logger.error(message)
      this.logger.info('Stopping composite service...')
      Promise.all(this.services.map(service => this.stopService(service)))
        .then(() => this.logger.info('Stopped composite service'))
        // Wait one micro tick for output to flush
        .then(() => process.exit(1))
    }
    // simply return a promise that never resolves, since we can't do anything after exiting anyways
    return never()
  }

  private async stopService(service: Service) {
    const dependents = this.services.filter(({ config }) =>
      config.dependencies.includes(service.id)
    )
    await Promise.all(dependents.map(service => this.stopService(service)))
    await service.stop()
  }
}

function mapStream(mapper: (arg0: string) => string): Duplex {
  return mapStreamAsync((string: string, cb: Function) =>
    cb(null, mapper(string))
  )
}

function rightPad(string: string, length: number): string {
  // we assume length >= string.length
  return string + ' '.repeat(length - string.length)
}

function never(): Promise<never> {
  return new Promise<never>(() => {})
}
