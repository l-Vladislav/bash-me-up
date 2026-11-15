/**
 * The question bank of `millionaire`. To add a question, append it to the
 * subject's file in `topics/`; to add a subject, add a file and a row here.
 */
import { csharp } from './topics/csharp';
import { design } from './topics/design';
import { node } from './topics/node';
import { python } from './topics/python';

/** 1 is asked for the first five sums, 2 for the middle five, 3 for the last five. */
export type Tier = 1 | 2 | 3;

export interface Question {
  tier: Tier;
  ask: string;
  /** The first one is right; the order is shuffled when the question is asked. */
  options: readonly [string, string, string, string];
  /** One sentence on why, shown once the question is answered. */
  why: string;
}

export interface Topic {
  /** What is typed after the command, e.g. `millionaire node`. */
  key: string;
  title: string;
  summary: string;
  questions: readonly Question[];
}

const SUBJECTS: readonly Topic[] = [
  {
    key: 'design',
    title: 'System design',
    summary: 'Caches, queues, replicas, consensus',
    questions: design,
  },
  {
    key: 'node',
    title: 'Node.js',
    summary: 'Event loop, streams, modules',
    questions: node,
  },
  {
    key: 'python',
    title: 'Python',
    summary: 'The language and CPython under it',
    questions: python,
  },
  {
    key: 'csharp',
    title: 'C# and .NET',
    summary: 'Types, LINQ, async, the garbage collector',
    questions: csharp,
  },
];

export const TOPICS: readonly Topic[] = [
  ...SUBJECTS,
  {
    key: 'mix',
    title: 'A bit of everything',
    summary: 'Questions drawn from every subject',
    questions: SUBJECTS.flatMap(({ questions }) => questions),
  },
];
