<div align="center">

```
    __               __
   / /_  ____ ______/ /_        ____ ___  ___        __  ______
  / __ \/ __ `/ ___/ __ \______/ __ `__ \/ _ \______/ / / / __ \
 / /_/ / /_/ (__  ) / / /_____/ / / / / /  __/_____/ /_/ / /_/ /
/_.___/\__,_/____/_/ /_/     /_/ /_/ /_/\___/      \__,_/ .___/
                                                       /_/
```

**A portfolio that boots on a 1984 monochrome video terminal, the VL-42.**

[![Deploy](https://github.com/l-Vladislav/bash-me-up/actions/workflows/deploy.yml/badge.svg)](https://github.com/l-Vladislav/bash-me-up/actions/workflows/deploy.yml)
![React 19](https://img.shields.io/badge/React-19-ffb000?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-ffb000?logo=typescript&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-ffb000?logo=vite&logoColor=black)
[![License: MIT](https://img.shields.io/badge/license-MIT-ffb000)](LICENSE)

### [▶ l-vladislav.github.io/bash-me-up](https://l-vladislav.github.io/bash-me-up/)

</div>

## What it is

The personal site of [Vladislav Larionov](https://www.linkedin.com/in/vladislav-larionov), a senior
full-stack engineer. Instead of a landing page you get a shell: type `help`, or press the keys on
the monitor's front panel if you would rather not type.

```
guest@larionov:~$ help

  help                  Show this list
  about                 Who I am and what I do
  experience [1-3]      Work history; pass a number for details
  skills                Technologies I work with
  projects [1-5]        Things I have built; pass a number for details
  education             Degree
  contact               How to reach me
  theme [amber|green]   Swap the phosphor colour
  crt [on|off]          Toggle the CRT simulation
  history               Commands typed this session
  clear                 Clear the screen (Ctrl+L)
  reboot                Restart the terminal
```

- **Tab** completes commands and arguments, **Up/Down** recall history.
- Every highlighted word on screen is clickable, so the site works without a keyboard.
- `ls` and `cat about.txt` work too, for visitors with shell habits.
- Deep links: [`?run=projects`](https://l-vladislav.github.io/bash-me-up/?run=projects) opens the
  site and types the command for you.

## How the CRT works

No canvas, no WebGL, no images: the screen is ordinary selectable DOM text.

- **Curved glass.** A real barrel distortion: an SVG `feDisplacementMap` shifts every pixel by
  `p * strength * r²`, read from a 96×96 map generated at runtime
  ([`src/crt/barrel.ts`](src/crt/barrel.ts)). The lit raster sits inside the distorted layer, so
  its edges bow inwards and leave dark glass between picture and bezel.
- **Phosphor.** One CSS custom property, `--phosphor`. Dim and bright tones, the glow, the power
  LED and the light the screen throws on the wall all derive from it with
  `color-mix()`, so a theme is a single line.
- **Persistence.** Freshly written rows bloom and settle; a wiped screen lingers as a fading
  afterimage, the way slow phosphor does.
- **Tube artefacts.** Scanlines, a drifting refresh band, a faint flicker and an occasional
  one-pixel slip of the horizontal hold. All CSS.
- **Working controls.** The brightness and contrast knobs turn (drag, mouse wheel, arrow keys,
  double-click to centre), and the power switch collapses the picture into a dot; switching back on is a cold boot.
- **Accessibility.** Animations stop under `prefers-reduced-motion`, output is an ARIA live log,
  the knobs are real sliders, and `crt off` gives a flat, effect-free panel. The distortion is
  skipped on Safari and phones, where it would misbehave.

## Editing the content

All text lives outside the code, in two files:

| File                                               | Contains                                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [`content/portfolio.json`](content/portfolio.json) | Profile, experience, skills, projects, education, contacts, boot messages, front-panel keys |
| [`content/banner.txt`](content/banner.txt)         | The ASCII banner on the welcome screen                                                      |

Adding a project is one more object in the `projects` array; it shows up in the table and gets its
own page (`projects <n>`) automatically:

```jsonc
{
  "name": "Project name", // table row and page title
  "tagline": "Company, 2026", // the WHERE column
  "role": "What I did", // optional
  "description": "One or two sentences.",
  "highlights": ["Result one.", "Result two."], // optional bullet points
  "stack": ["React", "TypeScript"], // first three are previewed in the table
  "href": "https://github.com/...", // optional link
}
```

`experience` works the same way: a new object in the `experience` array becomes a row in the table
and a page of its own (`experience <n>`):

```jsonc
{
  "title": "Senior Full-Stack Engineer", // the ROLE column and page title
  "company": "Company Inc.", // the COMPANY column
  "location": "Israel",
  "period": "01/2025 - present", // the PERIOD column
  "highlights": ["What I did and what came of it."],
  "stack": ["React", "Python"],
}
```

Edit, commit, push: the site redeploys itself. The JSON is checked against the `Portfolio` type in
[`src/content/resume.ts`](src/content/resume.ts), so a missing or misspelled field fails the build
instead of reaching production.

## Architecture

```
content/                 the words (JSON + ASCII banner)
src/
├── content/             typed access to the content, boot sequence
├── terminal/            framework-free core, fully unit-tested
│   ├── line.ts          output model: commands return data, never markup
│   ├── commands/        one pure function per command + registry
│   ├── screen.ts        reducer for the picture and its fading afterimage
│   ├── completion.ts    tab completion
│   └── printer.ts       line-by-line "serial link" output queue
├── crt/                 barrel-distortion maths
├── hooks/               the thin layer binding the core to React
└── components/          Monitor, Terminal, Prompt, Knob, PowerSwitch... (CSS Modules)
```

Commands are pure: they take arguments and return lines plus optional _effects_ (`clear`,
`set-phosphor`, ...) for the shell to apply. That keeps the whole command layer testable without a
DOM and makes adding a command a one-file change.

## Development

Requires Node 22+.

```bash
npm install
npm run dev        # http://localhost:5173/bash-me-up/
```

| Script              | Does                              |
| ------------------- | --------------------------------- |
| `npm run dev`       | Dev server with hot reload        |
| `npm run build`     | Type-check and build to `dist/`   |
| `npm test`          | Unit tests (Vitest)               |
| `npm run lint`      | ESLint (typescript-eslint strict) |
| `npm run typecheck` | `tsc --noEmit`                    |
| `npm run format`    | Prettier                          |

Every push to `main` is linted, tested, built and published to GitHub Pages by
[`deploy.yml`](.github/workflows/deploy.yml).

## Credits

- Inspired by [wallenart.dev](https://wallenart.dev/).
- Typeface: [VT323](https://fonts.google.com/specimen/VT323) by Peter Hull (SIL Open Font License).

## License

[MIT](LICENSE)
