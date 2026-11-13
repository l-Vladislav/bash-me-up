import { describe, expect, it } from 'vitest';
import { contact, experience, profile, projects } from '../../content/resume';
import { toPlainText } from '../line';
import { DEFAULT_SETTINGS } from '../settings';
import { commands, execute, tokenize } from './index';
import type { CommandContext } from './index';

const context: CommandContext = {
  settings: DEFAULT_SETTINGS,
  history: [],
  random: () => 0,
  now: new Date(2026, 10, 12, 19, 44, 47).getTime(),
  bootedAt: new Date(2026, 10, 12, 18, 30, 0).getTime(),
};

const output = (input: string, overrides: Partial<CommandContext> = {}): string =>
  execute(input, { ...context, ...overrides })
    .lines.map(toPlainText)
    .join('\n');

describe('tokenize', () => {
  it('splits on any whitespace and ignores padding', () => {
    expect(tokenize('  theme   green ')).toEqual(['theme', 'green']);
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('execute', () => {
  it('prints nothing for empty input', () => {
    expect(execute('', context)).toEqual({ lines: [] });
  });

  it('reports unknown commands', () => {
    expect(output('make coffee')).toContain('make: command not found');
  });

  it('is case-insensitive and resolves aliases', () => {
    expect(output('ABOUT')).toBe(output('about'));
    expect(output('?')).toBe(output('help'));
  });

  it('gives every command a unique name', () => {
    const names = commands.map((command) => command.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('help', () => {
  const sections = ['portfolio', 'games', 'tools', 'terminal'];

  it('fits on one screen: sections only, each a clickable row', () => {
    const lines = execute('help', context).lines;
    expect(lines.length).toBeLessThan(12);
    expect(lines.flatMap((line) => line.command ?? [])).toEqual(
      sections.map((section) => `help ${section}`),
    );
  });

  it('lists every public command in exactly one section, and no hidden ones', () => {
    const pages = sections.map((section) => output(`help ${section}`));
    for (const command of commands) {
      const listedIn = pages.filter((page) => page.includes(`  ${command.name} `)).length;
      expect(listedIn, command.name).toBe(command.hidden ? 0 : 1);
    }
  });

  it('opens a section by its own name too', () => {
    expect(output('games')).toBe(output('help games'));
    expect(output('TOOLS')).toBe(output('help tools'));
  });

  it('explains a command, or points at the sections', () => {
    expect(output('help calc')).toBe(output('man calc'));
    expect(output('help nope')).toContain('no section "nope"');
  });
});

describe('content commands', () => {
  it('about introduces the owner', () => {
    expect(output('about')).toContain(profile.name);
    expect(output('about')).toContain('BSE in Software Engineering');
    expect(output('about')).toContain(
      'Saint Petersburg State University of Aerospace Instrumentation',
    );
  });

  it('experience lists every role as a clickable row and opens one by number', () => {
    const table = execute('experience', context).lines;
    const rowCommands = table.flatMap((line) => line.command ?? []);
    expect(rowCommands).toEqual(experience.map((_, index) => `experience ${index + 1}`));

    const list = table.map(toPlainText).join('\n');
    for (const role of experience) expect(list).toContain(role.company);

    const first = experience[0];
    expect(output('experience 1')).toContain(first?.highlights[0]);
  });

  it('experience rejects an out-of-range entry', () => {
    expect(output('experience 99')).toContain('no entry "99"');
  });

  it('projects lists every project as a clickable row and opens one by number', () => {
    const table = execute('projects', context).lines;
    const rowCommands = table.flatMap((line) => line.command ?? []);
    expect(rowCommands).toEqual(projects.map((_, index) => `projects ${index + 1}`));

    const text = table.map(toPlainText).join('\n');
    for (const project of projects) expect(text).toContain(project.name);

    const first = projects[0];
    expect(output('projects 1')).toContain(first?.description);
    expect(output('projects 0')).toContain('no entry "0"');
  });

  it('the last project links back to the first', () => {
    const commands = execute(`projects ${projects.length}`, context).lines.flatMap((line) =>
      line.spans.flatMap((span) => span.command ?? []),
    );
    expect(commands).toEqual(['projects', 'projects 1']);
  });

  it('contact exposes every link as a real href', () => {
    const hrefs = execute('contact', context).lines.flatMap((line) =>
      line.spans.flatMap((span) => span.href ?? []),
    );
    expect(hrefs).toEqual(contact.links.map((link) => link.href));
  });

  it('cat reads content as files, with or without the extension', () => {
    expect(output('cat about.txt')).toBe(output('about'));
    expect(output('cat skills')).toBe(output('skills'));
    expect(output('cat nope.txt')).toContain('No such file');
  });
});

describe('system commands', () => {
  it('theme cycles to the next phosphor without an argument', () => {
    expect(execute('theme', context).effects).toEqual([
      { type: 'set-phosphor', phosphor: 'green' },
    ]);
  });

  it('theme sets a named phosphor and rejects unknown ones', () => {
    expect(execute('theme amber', context).effects).toEqual([
      { type: 'set-phosphor', phosphor: 'amber' },
    ]);
    expect(execute('theme purple', context).effects).toBeUndefined();
  });

  it('crt toggles or sets the simulation', () => {
    expect(execute('crt', context).effects).toEqual([{ type: 'set-crt', enabled: false }]);
    expect(execute('crt on', context).effects).toEqual([{ type: 'set-crt', enabled: true }]);
    expect(execute('crt maybe', context).effects).toBeUndefined();
  });

  it('clear and reboot are pure effects', () => {
    expect(execute('clear', context)).toEqual({ lines: [], effects: [{ type: 'clear' }] });
    expect(execute('reboot', context)).toEqual({ lines: [], effects: [{ type: 'reboot' }] });
  });

  it('history numbers previous commands', () => {
    expect(output('history', { history: ['about', 'skills'] })).toBe('   1  about\n   2  skills');
  });
});
