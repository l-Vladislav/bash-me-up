import { contact, education, experience, profile, projects, skills } from '../../content/resume';
import type { Project, Role } from '../../content/resume';
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

/** How many technologies the project table previews per row. */
const STACK_PREVIEW = 3;

const projectTable = (): Line[] => {
  const nameWidth = Math.max(...projects.map((project) => project.name.length)) + 3;
  const whereWidth = Math.max(...projects.map((project) => project.tagline.length)) + 3;
  const indexWidth = `[${projects.length}] `.length;

  const header: Line = {
    spans: [
      dim(pad(' #', indexWidth)),
      dim(pad('PROJECT', nameWidth)),
      { ...dim(pad('WHERE', whereWidth)), hideBelow: 'medium' },
      { ...dim('STACK'), hideBelow: 'wide' },
    ],
    nowrap: true,
  };

  const rows = projects.map((project, index): Line => {
    const command = `projects ${index + 1}`;
    return {
      spans: [
        dim(pad(`[${index + 1}]`, indexWidth)),
        action(command, project.name),
        { text: ' '.repeat(nameWidth - project.name.length) },
        { text: pad(project.tagline, whereWidth), hideBelow: 'medium' },
        { ...dim(project.stack.slice(0, STACK_PREVIEW).join(', ')), hideBelow: 'wide' },
      ],
      nowrap: true,
      command,
    };
  });

  return [header, ...rows];
};

const projectDetails = (project: Project, index: number): Line[] => {
  const next = ((index + 1) % projects.length) + 1;

  return [
    line(bright(project.name), dim(`  ${project.tagline}`)),
    ...(project.role ? [line(project.role)] : []),
    blank(),
    line(project.description),
    ...(project.highlights?.length
      ? [blank(), ...project.highlights.map((highlight) => bullet(highlight))]
      : []),
    blank(),
    { spans: [dim(`  stack: ${project.stack.join(', ')}`)], hang: 9 },
    ...(project.href
      ? [line(dim('  link:  '), link(project.href.replace('https://', ''), project.href))]
      : []),
    blank(),
    line(
      action('projects', '< all projects'),
      '    ',
      action(`projects ${next}`, 'next project >'),
    ),
  ];
};

const projectsCommand: Command = {
  name: 'projects',
  summary: 'Things I have built; pass a number for details',
  usage: `[1-${projects.length}]`,
  options: projects.map((_, index) => String(index + 1)),
  run: ([selector]) => {
    if (selector === undefined) {
      return {
        lines: [
          heading('projects'),
          blank(),
          ...projectTable(),
          blank(),
          line(dim('Select a project or type `projects <n>`, e.g. '), action('projects 1')),
        ],
      };
    }

    const index = Number(selector) - 1;
    const project = projects[index];
    if (!project) {
      return {
        lines: [line(`projects: no entry "${selector}" (expected 1-${projects.length})`)],
      };
    }
    return {
      lines: [
        heading(`project ${selector}/${projects.length}`),
        blank(),
        ...projectDetails(project, index),
      ],
    };
  },
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
