export interface EnvironmentPort {
  get(name: string): string | undefined;
  homeDirectory(): string;
}
