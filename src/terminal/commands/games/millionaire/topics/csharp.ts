import type { Question } from '../questions';

export const csharp: readonly Question[] = [
  {
    tier: 1,
    ask: 'Which keyword declares a local variable whose type the compiler infers?',
    options: ['var', 'let', 'auto', 'dynamic'],
    why: '`var` is still statically typed; `dynamic` puts the checks off until run time.',
  },
  {
    tier: 1,
    ask: 'Which of these is a value type?',
    options: ['struct', 'class', 'string', 'array'],
    why: 'Structs are copied on assignment; the other three are reference types.',
  },
  {
    tier: 1,
    ask: 'What does LINQ stand for?',
    options: [
      'Language Integrated Query',
      'Linked Index Query',
      'Lazy Inline Queue',
      'List Iteration Query',
    ],
    why: 'Queries written in the language itself, over collections, XML or a database.',
  },
  {
    tier: 1,
    ask: 'What is NuGet?',
    options: [
      'The package manager for .NET',
      'A unit test framework',
      'The JIT compiler',
      'A code formatter',
    ],
    why: 'It is to .NET what npm is to Node.js.',
  },
  {
    tier: 1,
    ask: 'Which statement makes sure an IDisposable object is disposed?',
    options: ['using', 'with', 'lock', 'fixed'],
    why: '`using` calls `Dispose()` at the end of the scope, even after an exception.',
  },
  {
    tier: 1,
    ask: 'With nullable reference types enabled, what does `string?` say?',
    options: [
      'The value may be null',
      'The parameter is optional',
      'The string is loaded lazily',
      'It is either a char or a string',
    ],
    why: 'The compiler then warns when it is dereferenced without a null check.',
  },
  {
    tier: 1,
    ask: 'Which type sits at the root of the .NET type hierarchy?',
    options: ['System.Object', 'System.Type', 'System.ValueType', 'System.Base'],
    why: 'Everything derives from `object`; value types get there through System.ValueType.',
  },

  {
    tier: 2,
    ask: 'What sets IQueryable<T> apart from IEnumerable<T>?',
    options: [
      'It builds an expression tree that a provider can translate, e.g. to SQL',
      'It always works on data in memory',
      'It is the only one LINQ operators work on',
      'It is thread-safe',
    ],
    why: 'That is how Entity Framework turns `Where(x => ...)` into a WHERE clause instead of filtering in memory.',
  },
  {
    tier: 2,
    ask: 'What happens to the calling thread when `await` meets a task that is not complete?',
    options: [
      'It is released: the method returns and resumes later',
      'It blocks until the task completes',
      'It spins in a loop',
      'It is terminated',
    ],
    why: 'The rest of the method becomes a continuation; the thread is free to do other work.',
  },
  {
    tier: 2,
    ask: 'Where does a boxed int live?',
    options: ['On the managed heap', 'On the stack', 'In a CPU register', 'In the intern pool'],
    why: 'Boxing wraps the value in an object, which is allocated on the heap.',
  },
  {
    tier: 2,
    ask: 'What does `sealed` do to a class?',
    options: [
      'Prevents other classes from inheriting from it',
      'Prevents it from being instantiated',
      'Makes all of its members static',
      'Makes its instances immutable',
    ],
    why: 'A sealed class is the end of its inheritance chain.',
  },
  {
    tier: 2,
    ask: 'What do `record` types give you out of the box?',
    options: [
      'Value-based equality',
      'Thread safety',
      'Lazy loading of properties',
      'Reference counting',
    ],
    why: 'Two records with the same data are equal; they also get `with` expressions and a readable ToString.',
  },
  {
    tier: 2,
    ask: 'What is deferred execution in LINQ?',
    options: [
      'The query runs only when its results are enumerated',
      'The query runs on a background thread',
      'The query is compiled when the application starts',
      'The results are cached after the first run',
    ],
    why: '`Where` and `Select` only describe the work; `foreach` or `ToList()` does it.',
  },
  {
    tier: 2,
    ask: 'How does an `out` parameter differ from `ref`?',
    options: [
      'The caller need not initialise it, but the method must assign it',
      'It is read-only inside the method',
      'It passes a copy of the value',
      'It does not differ: the two are synonyms',
    ],
    why: 'Both pass by reference; `out` moves the duty to assign from the caller to the method.',
  },

  {
    tier: 3,
    ask: 'What is `ConfigureAwait(false)` for?',
    options: [
      'Not resuming on the captured synchronization context',
      'Running the task synchronously',
      'Swallowing the exceptions of the task',
      'Cancelling the task after a timeout',
    ],
    why: 'The continuation may run on any pool thread, which avoids deadlocks and a hop back in library code.',
  },
  {
    tier: 3,
    ask: 'Which objects are allocated on the Large Object Heap?',
    options: [
      'Objects of 85,000 bytes or more',
      'Objects that survive two collections',
      'All arrays',
      'Objects with finalizers',
    ],
    why: 'Past that threshold objects go straight to the LOH, which is collected with generation 2.',
  },
  {
    tier: 3,
    ask: 'What is `Span<T>`?',
    options: [
      'A stack-only view over contiguous memory that allocates nothing',
      'A thread-safe list',
      'A lazily evaluated sequence',
      'The interval between two dates',
    ],
    why: 'It slices arrays, strings or native memory without copying; being a ref struct, it cannot live on the heap.',
  },
  {
    tier: 3,
    ask: 'Why use `ValueTask<T>` instead of `Task<T>` on a hot path?',
    options: [
      'It avoids an allocation when the result is already available',
      'It runs on a faster thread pool',
      'It can be awaited any number of times',
      'It never throws',
    ],
    why: 'It is a struct; and no, it must be awaited only once.',
  },
  {
    tier: 3,
    ask: 'What does `lock (obj) { ... }` on an ordinary object compile to?',
    options: [
      'Monitor.Enter and Monitor.Exit in a try/finally',
      'A Mutex',
      'SemaphoreSlim.Wait and Release',
      'A loop around Interlocked.CompareExchange',
    ],
    why: 'The `finally` guarantees the monitor is released when the block throws.',
  },
  {
    tier: 3,
    ask: 'Why are `async void` methods dangerous?',
    options: [
      'The caller cannot catch their exceptions, which may crash the process',
      'They block the calling thread',
      'They always run synchronously',
      'They leak the thread they started on',
    ],
    why: 'There is no Task to await or observe; keep them for event handlers.',
  },
  {
    tier: 3,
    ask: 'What does covariance (`out T`) on a generic interface allow?',
    options: [
      'Using IEnumerable<string> where IEnumerable<object> is expected',
      'Using IEnumerable<object> where IEnumerable<string> is expected',
      'Passing null for T',
      'Limiting T to value types',
    ],
    why: 'T only comes out of the interface, so a more derived type is always safe.',
  },
];
