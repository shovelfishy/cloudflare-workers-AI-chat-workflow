import { Agent } from "agents";

export class MyAgent extends Agent {
  env: Env;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.env = env;
  }

  async onStart() {
    console.log("Agent started");
  }
  async onConnect() {
    console.log("Agent connect");
  }

  async respond(prompt: string, history: string[]) {
    console.log(history)
    const response = (await this.env.AI.run(
      "@cf/meta/llama-3.1-8b-instruct",
      {
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant in a chatroom with multiple users, which are identified by their names. Do not start your response with 'Username: '.",
          },
          ...history,
          { role: "user", content: prompt },
        ],
      },
    )) as { response?: string };

    return response?.response ?? "I couldn't generate a response.";
  }
}
