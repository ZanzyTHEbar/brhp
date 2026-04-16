import type { EnvironmentPort } from '../../application/ports/environment-port.js';

export class ProcessEnvironmentAdapter implements EnvironmentPort {
  get(name: string): string | undefined {
    return process.env[name];
  }

  homeDirectory(): string {
    return process.env.HOME ?? process.env.USERPROFILE ?? process.cwd();
  }
}
