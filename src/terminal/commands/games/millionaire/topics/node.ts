import type { Question } from '../questions';

export const node: readonly Question[] = [
  {
    tier: 1,
    ask: 'Which JavaScript engine does Node.js run on?',
    options: ['V8', 'SpiderMonkey', 'JavaScriptCore', 'Chakra'],
    why: 'V8 is the engine from Chrome.',
  },
  {
    tier: 1,
    ask: 'Which file lists the dependencies of a Node.js project?',
    options: ['package.json', 'node.config.js', 'requirements.txt', 'modules.xml'],
    why: 'package.json holds the dependencies, the scripts and the metadata of the package.',
  },
  {
    tier: 1,
    ask: 'Which folder does `npm install` put the packages into?',
    options: ['node_modules', 'vendor', 'packages', 'lib'],
    why: 'node_modules, the heaviest object in the known universe.',
  },
  {
    tier: 1,
    ask: 'By default, how many threads run your JavaScript in a Node.js process?',
    options: ['One', 'One per CPU core', 'One per request', 'Four'],
    why: 'Your code runs on a single thread; the four threads people remember belong to the libuv pool.',
  },
  {
    tier: 1,
    ask: 'Which built-in module creates an HTTP server?',
    options: ['http', 'server', 'express', 'fetch'],
    why: '`http.createServer()`; Express is a package built on top of it.',
  },
  {
    tier: 1,
    ask: 'What does `require("fs")` give you?',
    options: [
      'The file system API',
      'A string formatting module',
      'The fast sockets module',
      'A function scheduler',
    ],
    why: '`fs` reads and writes files.',
  },
  {
    tier: 1,
    ask: 'Which keyword pauses an async function until a promise settles?',
    options: ['await', 'yield', 'defer', 'then'],
    why: '`await` suspends the function and resumes it with the result of the promise.',
  },

  {
    tier: 2,
    ask: 'What does this print? setTimeout(() => console.log("A"), 0); Promise.resolve().then(() => console.log("B")); console.log("C");',
    options: ['C B A', 'A B C', 'C A B', 'B C A'],
    why: 'Synchronous code first, then microtasks (promises), then timers.',
  },
  {
    tier: 2,
    ask: 'Which library gives Node.js its event loop and thread pool?',
    options: ['libuv', 'libevent', 'V8', 'OpenSSL'],
    why: 'libuv does the asynchronous I/O; V8 only runs the JavaScript.',
  },
  {
    tier: 2,
    ask: 'What is backpressure in streams?',
    options: [
      'A signal that the writer should pause because the consumer is slower',
      'An error raised when a stream is closed twice',
      'Compression of chunks in transit',
      'Automatic retry of failed chunks',
    ],
    why: '`write()` returns false when the buffer is full, and "drain" says when to go on.',
  },
  {
    tier: 2,
    ask: 'Which module runs JavaScript on parallel threads inside one process?',
    options: ['worker_threads', 'cluster', 'child_process', 'async_hooks'],
    why: '`cluster` and `child_process` start separate processes; workers are threads.',
  },
  {
    tier: 2,
    ask: 'What does the `cluster` module do?',
    options: [
      'Forks several processes that share one server port',
      'Starts threads that share memory',
      'Groups npm packages into a workspace',
      'Connects to a database cluster',
    ],
    why: 'One worker process per core, all accepting connections on the same port.',
  },
  {
    tier: 2,
    ask: 'When does a `process.nextTick` callback run?',
    options: [
      'Right after the current operation, before the event loop moves on',
      'On the next timer tick, at least 1 ms later',
      'When the next request arrives',
      'On a separate thread',
    ],
    why: 'The nextTick queue is emptied as soon as the current JavaScript finishes, ahead of any I/O.',
  },
  {
    tier: 2,
    ask: 'In CommonJS, what happens when the same module is required twice?',
    options: [
      'It runs once and the cached exports are returned',
      'It runs again every time',
      'The second call throws',
      'The second caller gets a deep copy',
    ],
    why: 'Modules are cached in `require.cache` after the first load.',
  },

  {
    tier: 3,
    ask: 'Inside an I/O callback, which runs first: `setImmediate` or `setTimeout(fn, 0)`?',
    options: [
      'setImmediate, always',
      'setTimeout, always',
      'It varies from run to run',
      'Whichever was scheduled first',
    ],
    why: 'After the poll phase comes the check phase, where immediates run; timers wait for the next lap.',
  },
  {
    tier: 3,
    ask: 'What is the default size of the libuv thread pool?',
    options: ['4', '1', '8', 'The number of CPU cores'],
    why: 'Four threads, changed with UV_THREADPOOL_SIZE.',
  },
  {
    tier: 3,
    ask: 'Which of these does its work on the libuv thread pool?',
    options: ['fs.readFile', 'http.get', 'net.connect', 'setTimeout'],
    why: 'File I/O has no portable non-blocking API, so it goes to the pool; sockets use the OS event queue.',
  },
  {
    tier: 3,
    ask: 'In CommonJS, how are `process.nextTick` callbacks ordered against promise callbacks?',
    options: [
      'nextTick callbacks run first',
      'Promise callbacks run first',
      'Strictly in the order they were scheduled',
      'nextTick callbacks wait for the timers phase',
    ],
    why: 'The nextTick queue is drained before the promise microtask queue.',
  },
  {
    tier: 3,
    ask: 'What does `highWaterMark` control in a stream?',
    options: [
      'How much is buffered before backpressure kicks in',
      'The largest file the stream may read',
      'How many streams may be open at once',
      'The idle timeout of the stream',
    ],
    why: 'It is the buffer threshold: past it `write()` returns false and reading pauses.',
  },
  {
    tier: 3,
    ask: 'Why can one `JSON.parse` of a huge payload hurt a whole Node.js server?',
    options: [
      'It blocks the event loop, so no other request is served meanwhile',
      'It leaks memory inside V8',
      'It uses up the libuv thread pool',
      'It switches off keep-alive',
    ],
    why: 'Parsing is synchronous CPU work on the only thread that runs JavaScript.',
  },
  {
    tier: 3,
    ask: 'What does `AsyncLocalStorage` give you?',
    options: [
      'Context that follows a request across asynchronous calls',
      'A key-value store persisted on disk',
      'A polyfill for the localStorage of browsers',
      'Memory shared between worker threads',
    ],
    why: 'A request id, say, stays reachable through every callback and await without being passed around.',
  },
];
