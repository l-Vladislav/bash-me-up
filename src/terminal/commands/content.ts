import { contact, education, experience, profile, projects, skills } from '../../content/resume';
import type { Role } from '../../content/resume';
import { action, blank, bright, bullet, dim, heading, line, link } from '../line';
import type { Line } from '../line';
import type { Command } from './types';

const pad = (text: string, width: number): string => text.padEnd(width);

const roleDetails = (role: Role): Line[] => [
  line(bright(role.title), dim(`  ${role.period}`)),
  line(`${role.company}, ${role.location}`),
  blank(),
  ...role.highlights.map((highlight) => bullet(highlight)),
  blank(),
  { spans: [dim(`  stack: ${role.stack.join(', ')}`)], hang: 9 },
];

const about: Command = {
  name: 'about',
  summary: 'Who I am and what I do',
  run: () => ({
    lines: [
      heading('about'),
      blank(),
      line(bright(profile.name), dim(`  ${profile.location}`)),
      line(`${profile.title} - ${profile.focus}`),
      blank(),
      ...profile.summary.map((paragraph) => line(paragraph)),
      blank(),
      ...profile.stats.map((stat) => line('  ', bright(pad(stat.value, 6)), stat.label)),
      blank(),
      line(dim(`Speaks: ${profile.languages.join(', ')}`)),
      blank(),
      line('Next: ', action('experience'), ', ', action('projects'), ' or ', action('contact')),
    ],
  }),
};

const experienceCommand: Command = {
  name: 'experience',
  summary: 'Work history; pass a number for details',
  usage: `[1-${experience.length}]`,
  options: experience.map((_, index) => String(index + 1)),
  run: ([selector]) => {
    if (selector === undefined) {
      return {
        lines: [
          heading('experience'),
          ...experience.flatMap((role, index) => [
            blank(),
            line(
              action(`experience ${index + 1}`, `[${index + 1}]`),
              ' ',
              bright(role.title),
              dim(`  ${role.period}`),
            ),
            line(`    ${role.company}, ${role.location}`),
          ]),
          blank(),
          line(dim('Select an entry or type `experience <n>`, e.g. '), action('experience 1')),
        ],
      };
    }

    const role = experience[Number(selector) - 1];
    if (!role) {
      return {
        lines: [line(`experience: no entry "${selector}" (expected 1-${experience.length})`)],
      };
    }
    return {
      lines: [
        heading(`experience ${selector}/${experience.length}`),
        blank(),
        ...roleDetails(role),
      ],
    };
  },
};

const skillsCommand: Command = {
  name: 'skills',
  summary: 'Technologies I work with',
  run: () => {
    const width = Math.max(...skills.map((group) => group.name.length)) + 2;
    return {
      lines: [
        heading('skills'),
        blank(),
        ...skills.map((group): Line => ({
          spans: [bright(pad(group.name, width)), { text: group.items.join(', ') }],
          hang: width,
        })),
      ],
    };
  },
};

const projectsCommand: Command = {
  name: 'projects',
  summary: 'Things I have built',
  run: () => ({
    lines: [
      heading('projects'),
      ...projects.flatMap((project) => [
        blank(),
        line(bright(project.name), dim(`  ${project.tagline}`)),
        { spans: [{ text: `  ${project.description}` }], hang: 2 },
        { spans: [dim(`  ${project.stack.join(', ')}`)], hang: 2 },
        ...(project.href
          ? [line('  ', link(project.href.replace('https://', ''), project.href))]
          : []),
      ]),
    ],
  }),
};

const educationCommand: Command = {
  name: 'education',
  summary: 'Degree',
  run: () => ({
    lines: [
      heading('education'),
      ...education.flatMap((entry) => [blank(), line(bright(entry.degree)), line(entry.school)]),
    ],
  }),
};

const contactCommand: Command = {
  name: 'contact',
  summary: 'How to reach me',
  run: () => {
    const width = Math.max(...contact.links.map((entry) => entry.label.length)) + 2;
    return {
      lines: [
        heading('contact'),
        blank(),
        ...contact.links.map((entry) =>
          line(dim(pad(entry.label, width)), link(entry.text, entry.href)),
        ),
        blank(),
        line(contact.note),
      ],
    };
  },
};

export const contentCommands: readonly Command[] = [
  about,
  experienceCommand,
  skillsCommand,
  projectsCommand,
  educationCommand,
  contactCommand,
];
