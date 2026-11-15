import type { Question } from '../questions';

export const design: readonly Question[] = [
  {
    tier: 1,
    ask: 'What does a load balancer do?',
    options: [
      'Spreads incoming requests across several servers',
      'Compresses responses before they are sent',
      'Keeps user sessions on disk',
      'Encrypts the database',
    ],
    why: 'It puts a pool of servers behind one address and shares the traffic between them.',
  },
  {
    tier: 1,
    ask: 'What is a CDN mainly used for?',
    options: [
      'Serving static content from locations close to the users',
      'Running database migrations',
      'Queueing background jobs',
      'Balancing writes between replicas',
    ],
    why: 'Edge servers keep copies of images, scripts and video near the people who ask for them.',
  },
  {
    tier: 1,
    ask: 'What does scaling vertically mean?',
    options: [
      'Giving one machine more CPU, memory or disk',
      'Adding more machines',
      'Splitting the database into shards',
      'Moving the service to another region',
    ],
    why: 'Up is a bigger box; out (horizontal) is more boxes.',
  },
  {
    tier: 1,
    ask: 'Which HTTP status code tells a client it is sending too many requests?',
    options: ['429', '404', '502', '301'],
    why: '429 Too Many Requests is what a rate limiter answers with.',
  },
  {
    tier: 1,
    ask: 'What does the C in the CAP theorem stand for?',
    options: ['Consistency', 'Concurrency', 'Caching', 'Capacity'],
    why: 'Consistency, Availability, Partition tolerance.',
  },
  {
    tier: 1,
    ask: 'What is a read replica for?',
    options: [
      'Taking read queries off the primary database',
      'Accepting writes when the primary is busy',
      'Keeping backups offline',
      'Encrypting data at rest',
    ],
    why: 'It is a copy that follows the primary and answers reads; writes still go to the primary.',
  },
  {
    tier: 1,
    ask: 'Which of these is a message broker?',
    options: ['RabbitMQ', 'PostgreSQL', 'Nginx', 'Memcached'],
    why: 'RabbitMQ routes messages between producers and consumers.',
  },

  {
    tier: 2,
    ask: 'During a network partition, what does the CAP theorem make a system choose between?',
    options: [
      'Consistency and availability',
      'Latency and throughput',
      'Caching and durability',
      'Sharding and replication',
    ],
    why: 'Cut off from its peers, a node either refuses to answer or risks answering with stale data.',
  },
  {
    tier: 2,
    ask: 'What problem does consistent hashing solve?',
    options: [
      'Only a small share of keys move when a node joins or leaves',
      'Two keys never get the same hash',
      'Keys stay sorted for range queries',
      'Passwords are stored safely',
    ],
    why: 'With plain `hash % N`, changing N remaps almost every key; on a hash ring only the neighbours move.',
  },
  {
    tier: 2,
    ask: 'When is an operation idempotent?',
    options: [
      'Repeating it has the same effect as doing it once',
      'It never fails',
      'It runs in constant time',
      'It can be undone',
    ],
    why: 'That is what makes retries safe: a second "set balance to 100" changes nothing.',
  },
  {
    tier: 2,
    ask: 'Roughly how much downtime a year does 99.99% availability allow?',
    options: ['About 53 minutes', 'About 9 hours', 'About 5 minutes', 'About 4 days'],
    why: 'A year has about 525,600 minutes; 0.01% of that is 52.6. Try the `nines` command.',
  },
  {
    tier: 2,
    ask: 'In the cache-aside pattern, who puts the data into the cache after a miss?',
    options: [
      'The application',
      'The database, through a trigger',
      'The cache itself',
      'The load balancer',
    ],
    why: 'The application reads the database and fills the cache; a cache that loads by itself is read-through.',
  },
  {
    tier: 2,
    ask: 'What is a dead-letter queue for?',
    options: [
      'Holding messages that could not be processed',
      'Delaying messages until a set time',
      'Keeping a copy of every message for audit',
      'Carrying the messages with the highest priority',
    ],
    why: 'A message that keeps failing is parked there so it stops blocking the rest and can be inspected.',
  },
  {
    tier: 2,
    ask: 'Which index structure do most relational databases use by default?',
    options: ['B-tree', 'Hash table', 'LSM-tree', 'Trie'],
    why: 'A B-tree keeps keys sorted, so it serves both exact lookups and range scans.',
  },

  {
    tier: 3,
    ask: 'With 3 replicas, which quorum guarantees that a read sees the latest acknowledged write?',
    options: ['W=2, R=2', 'W=1, R=1', 'W=1, R=2', 'W=2, R=1'],
    why: 'The read and write sets must overlap: R + W > N, and only 2 + 2 is more than 3.',
  },
  {
    tier: 3,
    ask: 'What does the Raft algorithm provide?',
    options: [
      'Consensus on a replicated log through an elected leader',
      'Conflict-free merging of concurrent edits',
      'An even spread of keys across nodes',
      'Ordering of events without any coordination',
    ],
    why: 'A leader is elected by majority and replicates log entries; an entry is committed once a majority has it.',
  },
  {
    tier: 3,
    ask: 'What kind of mistakes can a Bloom filter make when asked "is this item in the set?"',
    options: [
      'False positives, but never false negatives',
      'False negatives, but never false positives',
      'Both kinds',
      'Neither kind',
    ],
    why: '"No" is always true; "yes" means "probably", because different items can set the same bits.',
  },
  {
    tier: 3,
    ask: 'Which pattern makes "write to the database and publish an event" reliable without a distributed transaction?',
    options: ['Transactional outbox', 'Circuit breaker', 'Sidecar', 'Bulkhead'],
    why: 'The event is saved in the same local transaction as the data, and a relay publishes it afterwards.',
  },
  {
    tier: 3,
    ask: 'What is a cache stampede?',
    options: [
      'A popular entry expires and many requests recompute it at once',
      'The cache fills up and starts evicting entries',
      'Two nodes both believe they are the leader',
      'A slow consumer lets a queue grow without bound',
    ],
    why: 'All the requests miss together and hit the database together; locks or early refresh prevent it.',
  },
  {
    tier: 3,
    ask: 'Why do LSM-tree stores such as Cassandra or RocksDB cope well with heavy writes?',
    options: [
      'Writes are sequential appends, merged in the background',
      'Every write updates a tree page in place',
      'They keep all the data in memory only',
      'They lock the whole table for each write',
    ],
    why: 'A write goes to a log and a memtable; sorted files are flushed and compacted later.',
  },
  {
    tier: 3,
    ask: 'What is the usual way to get effectively exactly-once processing of messages?',
    options: [
      'At-least-once delivery plus idempotent consumers',
      'At-most-once delivery with retries switched off',
      'A larger queue with more partitions',
      'Synchronised clocks on all consumers',
    ],
    why: 'Duplicates will arrive, so the consumer is built to make them harmless.',
  },
];
