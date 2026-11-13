import { contact, education, experience, profile, projects, skills } from '../../content/resume';
import type { Project, Role } from '../../content/resume';
import { gallery } from '../../content/gallery';
import type { Album, GalleryPicture } from '../../content/gallery';
import { action, blank, bright, bullet, dim, heading, line, link } from '../line';
import type { Line } from '../line';
import { catalogCommand, openCatalog } from './catalog';
import type { Catalog } from './catalog';
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

/** Width of the `Education:` and `Speaks:` labels on the about page. */
const LABEL = 'Education: '.length;

const about: Command = {
  name: 'about',
  summary: 'Who I am and what I do',
  run: () => ({
    lines: [
      // Where to go next shares the title row, as on the detail pages, so the page fits one screen.
      {
        spans: [
          ...heading('about').spans,
          dim('   next: '),
          action('experience'),
          dim(', '),
          action('projects'),
          dim(', '),
          action('contact'),
        ],
      },
      blank(),
      line(bright(profile.name), dim(`  ${profile.location}`)),
      line(`${profile.title} - ${profile.focus}`),
      blank(),
      ...profile.summary.map((paragraph) => line(paragraph)),
      blank(),
      ...profile.stats.map((stat) => line('  ', bright(pad(stat.value, 6)), stat.label)),
      blank(),
      // One row each on a wide screen; on a phone the text wraps under itself.
      ...education.map(({ degree, school }): Line => ({
        spans: [dim(pad('Education:', LABEL)), { text: degree }, dim(`, ${school}`)],
        hang: LABEL,
      })),
      {
        spans: [dim(pad('Speaks:', LABEL)), { text: profile.languages.join(', ') }],
        hang: LABEL,
      },
    ],
  }),
};

const experienceCommand = catalogCommand<Role>({
  name: 'experience',
  summary: 'Work history; pass a number for details',
  noun: 'role',
  items: experience,
  label: { title: 'ROLE', value: (role) => role.title },
  columns: [
    { title: 'COMPANY', value: (role) => role.company, hideBelow: 'wide' },
    { title: 'PERIOD', value: (role) => role.period, dim: true, hideBelow: 'medium' },
  ],
  details: roleDetails,
});

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

const projectDetails = (project: Project): Line[] => [
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
];

const projectsCommand = catalogCommand<Project>({
  name: 'projects',
  summary: 'Things I have built; pass a number for details',
  noun: 'project',
  items: projects,
  label: { title: 'PROJECT', value: (project) => project.name },
  columns: [
    { title: 'WHERE', value: (project) => project.tagline, hideBelow: 'medium' },
    {
      title: 'STACK',
      value: (project) => project.stack.slice(0, STACK_PREVIEW).join(', '),
      dim: true,
      hideBelow: 'wide',
    },
  ],
  details: projectDetails,
});

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

/** Rows of text a gallery picture is tall, at most; small screens shrink it. */
const PICTURE_ROWS = 14;

/** One album's pictures, as a catalog under `gallery <folder>`. */
const albumCatalog = (album: Album): Catalog<GalleryPicture> => ({
  name: `gallery ${album.folder}`,
  title: album.title,
  parent: 'gallery',
  summary: album.description,
  noun: 'picture',
  items: album.pictures,
  label: { title: 'PICTURE', value: (picture) => picture.title },
  columns: [
    { title: 'CAPTION', value: (picture) => picture.caption, dim: true, hideBelow: 'medium' },
  ],
  details: ({ src, title, caption }) => [
    { spans: [], image: { src, alt: title, rows: PICTURE_ROWS, side: 'block' } },
    line(dim(caption)),
  ],
});

/** The albums themselves; an album's page is its own catalog of pictures. */
const albums: Catalog<Album> = {
  name: 'gallery',
  summary: 'Pictures on the phosphor, in albums',
  noun: 'album',
  items: gallery,
  label: { title: 'ALBUM', value: (album) => album.title },
  columns: [
    { title: 'PICTURES', value: (album) => String(album.pictures.length) },
    { title: 'ABOUT', value: (album) => album.description, dim: true, hideBelow: 'medium' },
  ],
  details: () => [],
};

/** `gallery`, `gallery <album>` and `gallery <album> <n>`; an album by number or folder name. */
const galleryCommand: Command = {
  name: 'gallery',
  summary: albums.summary,
  usage: '[album] [n]',
  options: gallery.map((album) => album.folder),
  run: ([albumArg, picture]) => {
    if (albumArg === undefined) return openCatalog(albums);

    const album =
      gallery.find(({ folder }) => folder === albumArg.toLowerCase()) ??
      gallery[Number(albumArg) - 1];
    if (!album) {
      const names = gallery.map(({ folder }) => folder).join(', ');
      return { lines: [line(`gallery: no album "${albumArg}" (try ${names})`)] };
    }
    return openCatalog(albumCatalog(album), picture);
  },
};

export const contentCommands: readonly Command[] = [
  about,
  experienceCommand,
  skillsCommand,
  projectsCommand,
  contactCommand,
];

/** A section of `help` on its own. */
export const galleryCommands: readonly Command[] = [galleryCommand];
