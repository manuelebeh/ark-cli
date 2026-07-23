import {
  bootstrapLaravel,
  isLaravelStack,
  LARAVEL_BOOTSTRAP_OPTIONS,
  parseLaravelBootstrap,
  type LaravelBootstrapMethod,
} from "./laravel-bootstrap.js";
import {
  bootstrapPlainPhp,
  bootstrapPlainPython,
  isPlainPhpStack,
  isPlainPythonStack,
  parsePlainPhpBootstrap,
  parsePlainPythonBootstrap,
  PLAIN_PHP_BOOTSTRAP_OPTIONS,
  PLAIN_PYTHON_BOOTSTRAP_OPTIONS,
  type PlainPhpBootstrapMethod,
  type PlainPythonBootstrapMethod,
} from "./plain-bootstrap.js";
import {
  bootstrapDjango,
  bootstrapFastapi,
  DJANGO_BOOTSTRAP_OPTIONS,
  FASTAPI_BOOTSTRAP_OPTIONS,
  isDjangoStack,
  isFastapiStack,
  isPythonFrameworkStack,
  parseDjangoBootstrap,
  parseFastapiBootstrap,
  type DjangoBootstrapMethod,
  type FastapiBootstrapMethod,
} from "./python-bootstrap.js";
import {
  bootstrapNest,
  isNestStack,
  NEST_BOOTSTRAP_OPTIONS,
  parseNestBootstrap,
  type NestBootstrapMethod,
} from "./nest-bootstrap.js";
import {
  bootstrapNuxt,
  isNuxtStack,
  NUXT_BOOTSTRAP_OPTIONS,
  parseNuxtBootstrap,
  type NuxtBootstrapMethod,
} from "./nuxt-bootstrap.js";
import {
  bootstrapExpo,
  isExpoStack,
  EXPO_BOOTSTRAP_OPTIONS,
  parseExpoBootstrap,
  type ExpoBootstrapMethod,
} from "./expo-bootstrap.js";

export type ProjectDepth = "minimal" | "full";

export type FrameworkBootstrapMethod =
  | LaravelBootstrapMethod
  | DjangoBootstrapMethod
  | FastapiBootstrapMethod
  | PlainPhpBootstrapMethod
  | PlainPythonBootstrapMethod
  | NestBootstrapMethod
  | NuxtBootstrapMethod
  | ExpoBootstrapMethod;

export type BootstrapOption = {
  value: string;
  label: string;
  hint: string;
};

export {
  isLaravelStack,
  isDjangoStack,
  isFastapiStack,
  isPythonFrameworkStack,
  isPlainPhpStack,
  isPlainPythonStack,
  isNestStack,
  isNuxtStack,
  isExpoStack,
};

export function parseProjectDepth(value: unknown): ProjectDepth | undefined {
  if (value === "minimal" || value === "full") return value;
  return undefined;
}

export function supportsDepthBootstrap(stacks: string[]): boolean {
  return (
    isLaravelStack(stacks) ||
    isPythonFrameworkStack(stacks) ||
    isPlainPhpStack(stacks) ||
    isPlainPythonStack(stacks) ||
    isNestStack(stacks) ||
    isNuxtStack(stacks) ||
    isExpoStack(stacks)
  );
}

export function frameworkLabel(stacks: string[]): string {
  if (isLaravelStack(stacks)) return "Laravel";
  if (isDjangoStack(stacks)) return "Django";
  if (isFastapiStack(stacks)) return "FastAPI";
  if (isNestStack(stacks)) return "NestJS";
  if (isNuxtStack(stacks)) return "Nuxt";
  if (isExpoStack(stacks)) return "Expo";
  if (isPlainPhpStack(stacks)) return "PHP";
  if (isPlainPythonStack(stacks)) return "Python";
  return "framework";
}

export function bootstrapOptionsForStacks(stacks: string[]): BootstrapOption[] {
  if (isLaravelStack(stacks)) return LARAVEL_BOOTSTRAP_OPTIONS;
  if (isDjangoStack(stacks)) return DJANGO_BOOTSTRAP_OPTIONS;
  if (isFastapiStack(stacks)) return FASTAPI_BOOTSTRAP_OPTIONS;
  if (isNestStack(stacks)) return NEST_BOOTSTRAP_OPTIONS;
  if (isNuxtStack(stacks)) return NUXT_BOOTSTRAP_OPTIONS;
  if (isExpoStack(stacks)) return EXPO_BOOTSTRAP_OPTIONS;
  if (isPlainPhpStack(stacks)) return PLAIN_PHP_BOOTSTRAP_OPTIONS;
  if (isPlainPythonStack(stacks)) return PLAIN_PYTHON_BOOTSTRAP_OPTIONS;
  return [];
}

export function parseBootstrapForStacks(
  stacks: string[],
  value: unknown,
): FrameworkBootstrapMethod | undefined {
  if (isLaravelStack(stacks)) return parseLaravelBootstrap(value);
  if (isDjangoStack(stacks)) return parseDjangoBootstrap(value);
  if (isFastapiStack(stacks)) return parseFastapiBootstrap(value);
  if (isNestStack(stacks)) return parseNestBootstrap(value);
  if (isNuxtStack(stacks)) return parseNuxtBootstrap(value);
  if (isExpoStack(stacks)) return parseExpoBootstrap(value);
  if (isPlainPhpStack(stacks)) return parsePlainPhpBootstrap(value);
  if (isPlainPythonStack(stacks)) return parsePlainPythonBootstrap(value);
  return undefined;
}

export function bootstrapMethodHint(stacks: string[]): string {
  return bootstrapOptionsForStacks(stacks)
    .map((o) => o.value)
    .join("|");
}

export function bootstrapFramework(opts: {
  stacks: string[];
  method: FrameworkBootstrapMethod;
  targetDir: string;
  name: string;
}): void {
  if (isLaravelStack(opts.stacks)) {
    bootstrapLaravel({
      method: opts.method as LaravelBootstrapMethod,
      targetDir: opts.targetDir,
      name: opts.name,
    });
    return;
  }
  if (isDjangoStack(opts.stacks)) {
    bootstrapDjango({
      method: opts.method as DjangoBootstrapMethod,
      targetDir: opts.targetDir,
      name: opts.name,
    });
    return;
  }
  if (isFastapiStack(opts.stacks)) {
    bootstrapFastapi({
      method: opts.method as FastapiBootstrapMethod,
      targetDir: opts.targetDir,
      name: opts.name,
    });
    return;
  }
  if (isNestStack(opts.stacks)) {
    bootstrapNest({
      method: opts.method as NestBootstrapMethod,
      targetDir: opts.targetDir,
      name: opts.name,
    });
    return;
  }
  if (isNuxtStack(opts.stacks)) {
    bootstrapNuxt({
      method: opts.method as NuxtBootstrapMethod,
      targetDir: opts.targetDir,
      name: opts.name,
    });
    return;
  }
  if (isExpoStack(opts.stacks)) {
    bootstrapExpo({
      method: opts.method as ExpoBootstrapMethod,
      targetDir: opts.targetDir,
      name: opts.name,
    });
    return;
  }
  if (isPlainPhpStack(opts.stacks)) {
    bootstrapPlainPhp({
      method: opts.method as PlainPhpBootstrapMethod,
      targetDir: opts.targetDir,
      name: opts.name,
    });
    return;
  }
  if (isPlainPythonStack(opts.stacks)) {
    bootstrapPlainPython({
      method: opts.method as PlainPythonBootstrapMethod,
      targetDir: opts.targetDir,
      name: opts.name,
    });
    return;
  }
  throw new Error(
    `Full depth bootstrap is not supported for stacks: ${opts.stacks.join(",")}`,
  );
}
