export interface Skill {
  name: string;
  description?: string;
  trigger?: string; // Optional regex pattern to auto-trigger
  prompt: string; // The prompt to prepend when this skill is used
}

export interface SkillsConfig {
  skills: Skill[];
}
