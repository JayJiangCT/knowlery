import { ANSWER_SKILL } from './answer';
import { COMPILE_SKILL } from './compile';
import { MAINTAIN_SKILL } from './maintain';

export interface SkillDefinition {
  name: string;
  text: string;
}

export const SKILLS: readonly SkillDefinition[] = [
  { name: 'knowlery-compile', text: COMPILE_SKILL },
  { name: 'knowlery-maintain', text: MAINTAIN_SKILL },
  { name: 'knowlery-answer', text: ANSWER_SKILL },
];
