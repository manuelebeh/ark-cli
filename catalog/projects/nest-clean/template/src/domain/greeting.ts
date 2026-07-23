export type Greeting = {
  message: string;
};

export function formatGreeting(name: string): Greeting {
  return { message: `Hello, ${name}` };
}
