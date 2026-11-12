/**
 * Typed access to the editable content in `/content`.
 *
 * Everything a visitor reads lives in `content/portfolio.json` and
 * `content/banner.txt`. Assigning the JSON to `Portfolio` makes the build fail
 * if an edit breaks the expected shape.
 */
import banner from '../../content/banner.txt?raw';
import data from '../../content/portfolio.json';

export interface Stat {
  value: string;
  label: string;
}

export interface Profile {
  name: string;
  title: string;
  focus: string;
  location: string;
  summary: readonly string[];
  stats: readonly Stat[];
  languages: readonly string[];
}

export interface Link {
  label: string;
  text: string;
  href: string;
}

export interface Contact {
  note: string;
  links: readonly Link[];
}

export interface Role {
  title: string;
  company: string;
  location: string;
  period: string;
  highlights: readonly string[];
  stack: readonly string[];
}

export interface SkillGroup {
  name: string;
  items: readonly string[];
}

export interface Project {
  name: string;
  tagline: string;
  description: string;
  stack: readonly string[];
  href?: string;
}

export interface Degree {
  degree: string;
  school: string;
}

export interface BootCheck {
  label: string;
  result: string;
}

export interface TerminalInfo {
  /** Model name on the monitor's badge. */
  model: string;
  /** First line of the boot screen. */
  title: string;
  rom: string;
  /** `user@host` shown in the prompt. */
  user: string;
  host: string;
  bootChecks: readonly BootCheck[];
  /** Commands exposed as buttons on the monitor's front panel. */
  quickKeys: readonly string[];
}

export interface Portfolio {
  profile: Profile;
  contact: Contact;
  experience: readonly Role[];
  skills: readonly SkillGroup[];
  projects: readonly Project[];
  education: readonly Degree[];
  terminal: TerminalInfo;
}

const portfolio: Portfolio = data;

export const { profile, contact, experience, skills, projects, education, terminal } = portfolio;

export { banner };
