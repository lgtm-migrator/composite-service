const genericMessage =
  'This is a bug in composite-service. Please file an issue in https://github.com/zenflow/composite-service/issues'

export class InternalError extends Error {
  constructor(message: string) {
    super(`${message}. ${genericMessage}`)
  }
}
