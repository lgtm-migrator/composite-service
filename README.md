# composite-service

Helps you run multiple services as one

### Basic usage

At the heart of this library is the `startCompositeService` function (TODO)

Suppose, for example, you have an API service and another website service which makes calls to the API.

The script to run them together, as if they were a single program, might look like this:

```js
const { startCompositeService } = require('composite-service')

const apiPort = 8000

startCompositeService({
  services: {
    api: {
      command: 'node api/server.js',
      env: {
        PORT: apiPort,
      },
    },
    web: {
      command: 'node web/server.js',
      env: {
        PORT: process.env.PORT,
        API_ENDPOINT: `http://localhost:${apiPort}`,
      },
    },
  },
})
```

The above script will:
1. Start each composed service by spawning a process with the given `command` and `env` (environment variables)
2. Merge the stdout & stderr of every composed service and pipe it to stdout, each line prepended with the service name
3. Restart composed services when they "crash" (i.e. exit without being told to exit)
4. Shut down each composed service when it is itself told to shut down (with ctrl+c, SIGINT, or SIGTERM)

The example above only demonstrates composing nodejs http servers,
but a composed service can be any program that fits this description:
1. Runs in the terminal (i.e. in the foreground, not daemonized and in the background)
2. Should run until receiving a shutdown (`SIGINT` or `SIGTERM`) signal. Should not exit by itself, as that would be considered a crash.

The composite service shares the above characteristics.
It is a terminal program and shouldn't exit until receiving a shutdown signal.
*However*, if any fatal error occurs, the composite service will shut down any running services and exit with exit code `1`.
TODO: Reference "Fatal errors" section here

Fatal errors:
    - Invalid configuration
    - Error spawning process (e.g. EPERM, etc.)
    - Error in `ready` function
    - Service crashed before ready (Note that "service crashed after ready" is not fatal, and will be handled by restarting the service.)

### Graceful startup (TODO: and shutdown)

Building on the previous example,
suppose we want to start `web` only once `api` has started up and is ready to handle requests.
This way:
1. `web` does not appear to be ready before it's really ready to handle requests (recall that `web` makes calls to `api`)
2. `web` can safely make calls to `api` during startup

You can use the `ready` & `dependencies` service configs to accomplish this.

Each service is started only once all services listed in its `dependencies` are
started and "ready" according to their respective `ready` configs.

The `ready` config is a function that takes a `ReadyConfigContext` object as its argument
and returns a promise that resolves once the service is ready.
Its default is `() => Promise.resolve()`, which means the service is considered ready as soon as the process is successfully spawned.

The `ReadyConfigContext` object has the following properties:
- `output`: [readable stream](https://nodejs.org/api/stream.html#stream_class_stream_readable) of lines (as strings) from stdout & stderr

This package includes several helper functions for the `ready` config:
- `oncePortUsed(port: number | string, host = 'localhost'): Promise<void>`
- `onceOutputLineIs(output: stream.Readable, value: string): Promise<void>`
- `onceOutputLineIncludes(output: stream.Readable, value: string): Promise<void>`
- `onceOutputLine(output: Readable, test: (line: string) => boolean): Promise<void>`
- `onceTimeout(milliseconds: number): Promise<void>`

**Example:**

The following script will only start `web` once `api` outputs (to stdout or stderr) a line that includes "Listening on port ".

```js
const { startCompositeService, onceOutputLineIncludes } = require('composite-service')

const apiPort = 8000

startCompositeService({
  services: {
    api: {
      command: 'node api/server.js',
      env: {
        PORT: apiPort,
      },
      ready: ctx => onceOutputLineIncludes(ctx.output, 'Listening on port '),
    },
    web: {
      dependencies: ['api'],
      command: 'node web/server.js',
      env: {
        PORT: process.env.PORT,
        API_ENDPOINT: `http://localhost:${apiPort}`,
      },
    },
  },
})
```

### HTTP proxy service

If you want to expose some composed http services through a single http service (on a single port)
which proxies requests to the appropriate composed service depending on the URL,
you can use the included HTTP proxy service instead of writing (and re-writing) your own.

The HTTP proxy service can be configured with the `configureHttpProxyService` function which
takes the following parameters and returns a service configuration object:
TODO
- `dependencies`: Used as `dependencies` in service configuration object (defaults to `[]`)
- `host`: Host to listen on (defaults to `"0.0.0.0"`)
- `port`: Port to listen on
- `proxies`: Array of `HttpProxyConfig` objects,
each of which has a `context` property,
and any number of http-proxy-middleware options

**Example:**

The following composite service includes an HTTP proxy service which proxies
all requests with URL under `/api` to the `api` service
and all other requests to the `web` service:

```js
const {
  startCompositeService,
  oncePortUsed,
  configureHttpProxyService,
} = require('composite-service')

const [apiPort, webPort] = [8000, 8001]

startCompositeService({
  services: {
    api: {
      command: 'node api/server.js',
      env: {
        PORT: apiPort,
      },
      ready: () => oncePortUsed(apiPort),
    },
    web: {
      command: 'node web/server.js',
      env: {
        PORT: webPort,
        API_ENDPOINT: `http://localhost:${apiPort}`,
      },
      ready: () => oncePortUsed(webPort),
    },
    proxy: configureHttpProxyService({
      dependencies: ['api', 'web'],
      port: process.env.PORT,
      proxies: [
        { context: '/api', target: `http://localhost:${apiPort}` },
        { context: '/', target: `http://localhost:${webPort}` },
      ],
    }),
  },
})
```

## Motivation

Sometimes we want to use some open-source (or just reusable) service in our app or service.
If, instead of thinking of that reusable service as an external dependency,
we rather think of it as a *component* of our overall service,
then we might want to include it *in* our overall service,
rather than running it separately, and deploying it separately, as its own independent service.

Advantages of running as a single service:

1. simplified deployments & devops; works smoothly with any PaaS provider; never a need to update production services in a certain order
2. allows us to effectively use PaaS features like [Heroku's Review Apps](https://devcenter.heroku.com/articles/github-integration-review-apps)
3. with some PaaS providers (e.g. Heroku, render) saves the cost of hosting additional "apps" or "services"
4. fewer steps (i.e. one step) to start the entire system (locally or in CI) for integration testing (manual or automated), and sometimes even for local development

Another possible use case is grouping a set of microservices into one, to gain the same advantages listed above, as well as most of the advantages of microservices:
- Services can be developed independently, in different repositories, by different teams, in different languages
- One service crashing doesn't interrupt the others, since they still, on a lower level run as independent programs

You are not locked in to this approach.
Your composed services can be easily *de*composed at any time, and deployed separately.

## Related Projects

TODO: quick comparison of this package to each of projects

- https://github.com/Unitech/pm2
- https://github.com/godaddy/node-cluster-service

## Roadmap

- finish up TODO in README
- simplify tests by having only http-service
- default `config.services[].ready` should be `() => Promise.resolve()`
- fix disabled tests

- count restarts
- consider port safety
- proxy needs NODE_ENV=production?
- rename "http proxy service" to "http gateway service"

- inline TODOs
- check for excess config fields
- tests
    - unit tests for validation
    - use ctrl+c to shutdown composite service (for Windows compat)
- Nodejs issue: no ChildProcess 'started' event

- finish documentation /w "Configuration" section, using tsdoc website if necessary
- publish v3

- service config `restartDelay`, default: 1000
- service config `stopWith: 'ctrl+c' | 'SIGINT' | 'SIGTERM' | ...`
- `verbosity` config
- service config `handleCrash: 'restart-if-started' | 'crash' | 'restart'` defaulting to `'restart-if-started'` which is the current behavior
- service config `cwd: string`
- use `npm-run-path` package
- `assertPortFree` & `const [apiPort, webPort] = findPorts(2, { exclude: PORT })`
- PR to add composite-service example to https://docs.docker.com/config/containers/multi-service_container/

## Feature ideas

- service configs `beforeStarting`, `afterStarted`, `beforeStopping`, `afterStopped`: event handler or "hook" functions
- service config `readyTimeout`: milliseconds to wait for service to be "ready" before giving up and erroring
- service config `forceKillTimeout`: milliseconds to wait before sending SIGKILL
- http proxy service: stop accepting new requests, but finish pending requests, when SIGTERM received
- http proxy service: support making calls over a Unix domain socket instead of a port
- service configurator `configureNodeClusterService({script: 'path/to/script.js', scale: 4})` which uses same node binary that main process was started with

## Changelog

- `v3.0.0`
    - Support composing non-http services (i.e. no http proxy)
    - `dependencies`, `ready`, `restartDelay`, & `stopWith` service configs
    - `verbosity` config
    - Require explicit propagation of environment variables to composed services
    - Revised names & interfaces
- `v2.0.0`
    - Run server procs w/o shell & kill server procs normally (w/o tree-kill) (32723c73467522551bc57da8575f57f59d04d11d)
    - Ensure importing module is free of side-effects (efeab195b234cac153b601dd1e0835cbd53bcf2d)
- `v1.1.0`
    - Shutdown gracefully in non-windows environments (bce5500c99c6eec2acd7262ae70a4e6cb52b9d1c)
- `v1.0.0`
    - Initial commit
