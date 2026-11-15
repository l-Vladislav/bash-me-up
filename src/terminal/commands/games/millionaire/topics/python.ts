import type { Question } from '../questions';

export const python: readonly Question[] = [
  {
    tier: 1,
    ask: 'Which keyword defines a function in Python?',
    options: ['def', 'func', 'function', 'fn'],
    why: '`def name(args):` and an indented body.',
  },
  {
    tier: 1,
    ask: 'Which of these types is immutable?',
    options: ['tuple', 'list', 'dict', 'set'],
    why: 'A tuple cannot be changed after it is created, which is also why it can be a dict key.',
  },
  {
    tier: 1,
    ask: 'What does `[1, 2, 3][-1]` evaluate to?',
    options: ['3', '1', 'IndexError', '[3, 2, 1]'],
    why: 'Negative indexes count from the end.',
  },
  {
    tier: 1,
    ask: 'Which tool installs packages from PyPI?',
    options: ['pip', 'npm', 'gem', 'cargo'],
    why: 'pip, the package installer for Python.',
  },
  {
    tier: 1,
    ask: 'What is PEP 8?',
    options: [
      'The style guide for Python code',
      'The format of Python packages',
      'The specification of the interpreter lock',
      'The proposal that added async and await',
    ],
    why: 'Four spaces, snake_case and lines of 79 characters all come from PEP 8.',
  },
  {
    tier: 1,
    ask: 'What is `None`?',
    options: [
      'A single object that stands for "no value"',
      'The number zero',
      'An empty string',
      'An exception',
    ],
    why: 'It is the one instance of NoneType, and what a function returns when it returns nothing.',
  },
  {
    tier: 1,
    ask: 'Which statement handles exceptions?',
    options: ['try / except', 'try / catch', 'begin / rescue', 'do / recover'],
    why: 'Python says `except` where most languages say `catch`.',
  },

  {
    tier: 2,
    ask: 'What does the GIL do in standard CPython?',
    options: [
      'Lets only one thread run Python bytecode at a time',
      'Stops two modules from being imported at once',
      'Collects garbage on a background thread',
      'Caps the memory of the process',
    ],
    why: 'The global interpreter lock is why threads do not speed up CPU-bound Python code.',
  },
  {
    tier: 2,
    ask: 'What is the trap in `def add(item, items=[])`?',
    options: [
      'The same list is shared by every call',
      'The list is copied on every call, which is slow',
      'It is a syntax error',
      'The default silently becomes a tuple',
    ],
    why: 'Defaults are evaluated once, when the function is defined; use `None` and create the list inside.',
  },
  {
    tier: 2,
    ask: 'What does calling a function that contains `yield` return?',
    options: [
      'A generator object',
      'A list of everything it yields',
      'The first yielded value',
      'None',
    ],
    why: 'Nothing in the body runs until the generator is iterated.',
  },
  {
    tier: 2,
    ask: 'How do `is` and `==` differ?',
    options: [
      '`is` compares identity, `==` compares values',
      '`==` compares identity, `is` compares values',
      'They are interchangeable',
      '`is` works only on numbers',
    ],
    why: 'Two equal lists are `==` but not `is`: they are different objects.',
  },
  {
    tier: 2,
    ask: 'What does a `with` statement guarantee?',
    options: [
      'Cleanup runs even if the block raises an exception',
      'The block runs on a separate thread',
      'Variables inside the block are private',
      'Exceptions inside the block are ignored',
    ],
    why: 'The `__exit__` of the context manager is always called, which is how files get closed.',
  },
  {
    tier: 2,
    ask: 'What does `@functools.lru_cache` do?',
    options: [
      'Caches the results of a function by its arguments',
      'Limits how often a function may be called',
      'Logs every call of a function',
      'Runs a function on a background thread',
    ],
    why: 'It memoises, dropping the least recently used entries once the cache is full.',
  },
  {
    tier: 2,
    ask: 'Which of these is a valid dict comprehension?',
    options: [
      '{k: v for k, v in pairs}',
      '[k: v for k, v in pairs]',
      '{k, v for k, v in pairs}',
      'dict(k: v in pairs)',
    ],
    why: 'Braces, and `key: value` before the `for`.',
  },

  {
    tier: 3,
    ask: 'What is the MRO of a class?',
    options: [
      'The order in which base classes are searched for an attribute',
      'The order in which memory is returned to the system',
      'The order in which modules are imported',
      'The order in which decorators are applied',
    ],
    why: 'The method resolution order, computed by C3 linearisation; see `Class.__mro__`.',
  },
  {
    tier: 3,
    ask: 'What does defining `__slots__` on a class do?',
    options: [
      'Replaces the per-instance dict with a fixed set of attributes, saving memory',
      'Makes instances immutable',
      'Makes the attributes private',
      'Allows multiple inheritance',
    ],
    why: 'Without a `__dict__` each instance is smaller, and new attributes cannot be added.',
  },
  {
    tier: 3,
    ask: 'How does CPython mainly reclaim memory?',
    options: [
      'Reference counting, plus a collector for reference cycles',
      'A tracing mark-and-sweep collector only',
      'Only when `del` is called',
      'By compacting the heap on a timer',
    ],
    why: 'An object is freed the moment its count drops to zero; the `gc` module finds the cycles.',
  },
  {
    tier: 3,
    ask: 'In standard CPython, which fits a CPU-bound job that should use several cores?',
    options: ['multiprocessing', 'threading', 'asyncio', 'generators'],
    why: 'Separate processes each have their own interpreter and their own GIL.',
  },
  {
    tier: 3,
    ask: 'What is a descriptor?',
    options: [
      'An object with `__get__`, `__set__` or `__delete__` that customises attribute access',
      'A docstring attached to a class',
      'A type hint evaluated at run time',
      'A function that builds classes',
    ],
    why: 'Properties, methods and `classmethod` are all built on descriptors.',
  },
  {
    tier: 3,
    ask: 'In asyncio, what does `await` do when the result is not ready yet?',
    options: [
      'Suspends the coroutine and hands control back to the event loop',
      'Blocks the thread until it is ready',
      'Starts a new thread to wait',
      'Polls in a busy loop',
    ],
    why: 'The loop runs other tasks and resumes this one when the awaited thing completes.',
  },
  {
    tier: 3,
    ask: 'What is a metaclass?',
    options: [
      'A class whose instances are classes',
      'A class with static methods only',
      'An abstract base class',
      'A class defined inside a function',
    ],
    why: '`type` is the default one: classes are objects, and something has to create them.',
  },
];
