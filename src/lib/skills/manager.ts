import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Skill, SkillsConfig } from "./types.js";

export class SkillsManager {
  private configPath: string;
  private skills: Map<string, Skill> = new Map();

  constructor(configDir?: string) {
    const dir = configDir || join(homedir(), ".droid-bot");

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.configPath = join(dir, "skills.json");
    this.load();
  }

  private load(): void {
    if (!existsSync(this.configPath)) {
      this.save(); // Create empty config
      return;
    }

    try {
      const data = readFileSync(this.configPath, "utf-8");
      const config: SkillsConfig = JSON.parse(data);

      for (const skill of config.skills) {
        this.skills.set(skill.name.toLowerCase(), skill);
      }
    } catch (err) {
      console.error("[SkillsManager] Failed to load skills:", err);
    }
  }

  private save(): void {
    const config: SkillsConfig = {
      skills: Array.from(this.skills.values()),
    };

    writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  add(skill: Skill): void {
    this.skills.set(skill.name.toLowerCase(), skill);
    this.save();
  }

  remove(name: string): boolean {
    const deleted = this.skills.delete(name.toLowerCase());
    if (deleted) {
      this.save();
    }
    return deleted;
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name.toLowerCase());
  }

  list(): Skill[] {
    return Array.from(this.skills.values());
  }

  findByTrigger(message: string): Skill | undefined {
    for (const skill of this.skills.values()) {
      if (skill.trigger) {
        try {
          const regex = new RegExp(skill.trigger, "i");
          if (regex.test(message)) {
            return skill;
          }
        } catch {
          // Invalid regex, skip
        }
      }
    }
    return undefined;
  }

  applySkill(skill: Skill, userMessage: string): string {
    return `${skill.prompt}\n\nUser request: ${userMessage}`;
  }
}
