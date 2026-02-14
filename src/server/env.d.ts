import type { MyAgent } from "./agent";

interface Env {
	MyAgent: DurableObjectNamespace<MyAgent>;
	AI: Ai;
}
