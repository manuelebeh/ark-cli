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

export type ProjectDepth = "minimal" | "full";

export type FrameworkBootstrapMethod =
  | LaravelBootstrapMethod
  | DjangoBootstrapMethod
  | FastapiBootstrapMethod
  | PlainPhpBootstrapMethod
  | PlainPythonBootstrapMethod;

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
    isPlainPythonStack(stacks)
  );
}

export function frameworkLabel(stacks: string[]): string {
  if (isLaravelStack(stacks)) return "Laravel";
  if (isDjangoStack(stacks)) return "Django";
  if (isFastapiStack(stacks)) return "FastAPI";
  if (isPlainPhpStack(stacks)) return "PHP";
  if (isPlainPythonStack(stacks)) return "Python";
  return "framework";
}

export function bootstrapOptionsForStacks(stacks: string[]): BootstrapOption[] {
  if (isLaravelStack(stacks)) return LARAVEL_BOOTSTRAP_OPTIONS;
  if (isDjangoStack(stacks)) return DJANGO_BOOTSTRAP_OPTIONS;
  if (isFastapiStack(stacks)) return FASTAPI_BOOTSTRAP_OPTIONS;
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
