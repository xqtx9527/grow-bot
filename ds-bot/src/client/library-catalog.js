// What Discover offers. All of it is plain instructions, saved like a skill the user wrote.
const LANGUAGE = 'Answer in the language the user writes in.'

export const BUILT_IN_SKILLS = [
  {
    name: 'weekly-report', title: 'Weekly report', description: 'Write a weekly report from notes, tasks or recent work.',
    content: `Turn what the user gives you into a weekly report.\n\n1. Group the work by outcome, not by day.\n2. Write three sections: done, in progress, and next week.\n3. Under each item, say what changed and why it matters. Cut activity that had no result.\n4. List risks and anything you need from others.\n5. Keep it under one page. Never invent numbers; ask for what is missing.\n\n${LANGUAGE}`,
  },
  {
    name: 'meeting-minutes', title: 'Meeting minutes', description: 'Turn a transcript or rough notes into clear minutes with decisions and actions.',
    content: `Turn the transcript or notes into minutes.\n\n1. Open with one line on the purpose of the meeting.\n2. List the decisions made, each in one sentence.\n3. List actions as a table: what, who, and by when. Mark a missing owner or date as unknown.\n4. List open questions.\n5. Leave out small talk, and do not attribute opinions unless they matter to a decision.\n\n${LANGUAGE}`,
  },
  {
    name: 'research-brief', title: 'Research brief', description: 'Research a question and report findings with sources.',
    content: `Research the question and write a brief.\n\n1. Restate the question, and what a useful answer would let the user decide.\n2. Prefer primary sources. Check a claim that matters against a second source.\n3. Open with the conclusion, then the evidence for it.\n4. Say plainly what you could not confirm, and where sources disagree.\n5. Link every source you relied on.\n\n${LANGUAGE}`,
  },
  {
    name: 'code-review', title: 'Code review', description: 'Review a change for bugs, security problems and missing tests.',
    content: `Review the change.\n\n1. Read the change and the code around it before judging.\n2. Look first for bugs that would hurt users: wrong behavior, data loss, security problems and race conditions.\n3. Then look for missing tests of behavior that changed.\n4. For each finding, give the file and line, what goes wrong, and a fix. Order them by severity.\n5. Leave out matters of taste. If the change is fine, say so.\n\n${LANGUAGE}`,
  },
  {
    name: 'polish-writing', title: 'Polish writing', description: 'Make a draft clear and natural while keeping its meaning.',
    content: `Polish the draft.\n\n1. Keep the meaning, the facts and the author's voice.\n2. Cut filler, split long sentences, and put the point first.\n3. Fix errors of grammar and word choice.\n4. Give the polished text, then a short list of any changes to meaning you had to make.\n\n${LANGUAGE}`,
  },
  {
    name: 'daily-plan', title: 'Daily plan', description: 'Turn a pile of tasks into a realistic plan for the day.',
    content: `Plan the day from the user's tasks.\n\n1. Ask for available hours and fixed appointments if you do not have them.\n2. Pick the three tasks that matter most, and say why.\n3. Put them in time blocks, the hardest first, with a buffer between blocks.\n4. List what will not fit today, so that it is a choice.\n\n${LANGUAGE}`,
  },
]

export const REVIEWED_PLUGINS = [
  { name: 'dsh-image-gen', spec: 'dsh-image-gen@0.10.2', title: 'Image generation', description: 'Lets Bots create and edit images with your own API key. Community plugin, reviewed at version 0.10.2.', warning: 'Use API keys only. Its subscription sign-ins go through private endpoints and can put those accounts at risk.' },
]

const OWN = new Set(['ds-bot'])

/** The plugins the user added: what DSH ships and Grow Bot itself stay out of the list. */
export const addedPlugins = bundles => bundles.filter(bundle => bundle.installed && !bundle.official && !OWN.has(bundle.name))
