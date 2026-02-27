import {
    type Connection,
    Server,
    type WSMessage,
} from "partyserver";
import type { ChatMessage, Message } from "../shared";
import { nanoid } from "nanoid";
import { getAgentByName } from "agents";

export class Chat extends Server<Env> {
    static options = { hibernate: true };

    messages = [] as ChatMessage[];
    env: Env;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.env = env;
    }

    broadcastMessage(message: Message, exclude?: string[]) {
        this.broadcast(JSON.stringify(message), exclude);
    }

    onStart() {
        // this is where you can initialize things that need to be done before the server starts
        // for example, load previous messages from a database or a service

        // create the messages table if it doesn't exist
        this.ctx.storage.sql.exec(
            `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, user TEXT, role TEXT, content TEXT, created_at INTEGER)`,
        );
        this.ctx.storage.sql.exec(
            `CREATE TABLE IF NOT EXISTS renames_applied (id TEXT PRIMARY KEY)`,
        );
        this.ctx.storage.sql.exec(
            `CREATE TABLE IF NOT EXISTS rename_state (user_id TEXT PRIMARY KEY, last_username TEXT NOT NULL)`,
        );

        console.log("Room started");

        // load the messages from the database
        this.messages = this.ctx.storage.sql
            .exec(`SELECT * FROM messages`)
            .toArray() as ChatMessage[];
    }

    onConnect(connection: Connection) {
        connection.send(
            JSON.stringify({
                type: "all",
                messages: this.messages,
            } satisfies Message),
        );
    }

    saveMessage(message: ChatMessage) {
        // check if the message already exists
        const existingMessage = this.messages.find((m) => m.id === message.id);
        if (existingMessage) {
            this.messages = this.messages.map((m) => {
                if (m.id === message.id) {
                    return message;
                }
                return m;
            });
        } else {
            this.messages.push(message);
        }

        this.ctx.storage.sql.exec(
            `INSERT INTO messages (id, user, role, content, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET content = ?`,
            message.id,
            message.user,
            message.role,
            message.content,
            Date.now(),
            message.content,
        );
    }

    onMessage(connection: Connection, message: WSMessage) {
        // let's update our local messages store
        const parsed = JSON.parse(message as string) as Message;
        if (parsed.type === "rename") {
            this.applyRename(parsed).catch((error) => {
                console.error("Rename apply failed:", error);
            });
            return;
        }
        // let's broadcast the raw message to everyone else
        this.broadcast(message);
        if (parsed.type === "add" || parsed.type === "update") {
            this.saveMessage(parsed);
            this.maybeInvokeAgent(parsed).catch((error) => {
                console.error("Agent invoke failed:", error);
            });
        }
    }

    async applyRename(payload: Extract<Message, { type: "rename" }>) {
        const existing = this.ctx.storage.sql
            .exec(`SELECT id FROM renames_applied WHERE id = ?`, payload.id)
            .toArray();
        if (existing.length > 0) return;

        const row = this.ctx.storage.sql
            .exec(`SELECT last_username FROM rename_state WHERE user_id = ?`, payload.userId)
            .toArray()[0] as { last_username?: string } | undefined;

        const effectiveOld = row?.last_username ?? payload.old;
        if (!effectiveOld || effectiveOld === payload.new) return;
        console.log(effectiveOld)
        this.ctx.storage.sql.exec(
            `UPDATE messages SET user = ? WHERE user = ?`,
            payload.new,
            effectiveOld,
        );

        this.messages = this.messages.map((m) =>
            m.user === effectiveOld ? { ...m, user: payload.new } : m,
        );

        const systemMessage: ChatMessage = {
            id: nanoid(8),
            content: `${effectiveOld} changed their name to ${payload.new}.`,
            user: "System",
            role: "system",
        };
        this.saveMessage(systemMessage);

        this.ctx.storage.sql.exec(
            `INSERT INTO rename_state (user_id, last_username)
             VALUES (?, ?)
             ON CONFLICT(user_id) DO UPDATE SET last_username = ?`, payload.userId, payload.new, payload.new)

        this.ctx.storage.sql.exec(
            `INSERT INTO renames_applied (id) VALUES (?)`,
            payload.id,
        );

        this.broadcastMessage({ type: "all", messages: this.messages });
    }

    async maybeInvokeAgent(message: ChatMessage) {
        const trimmed = message.content.trim();
        if (!trimmed.toLowerCase().startsWith("/ai")) {
            return;
        }

        const prompt = trimmed.replace(/^\/ai\s*/i, "").trim();
        if (!prompt) {
            return;
        }

        const history = this.ctx.storage.sql
            .exec(`SELECT user, role, content FROM messages ORDER BY created_at ASC LIMIT 20`)
            .toArray()
            .slice(1)
            .map((e) => ({
                role: e.role,
                content: `${e.user}: ${e.content}`,
            }));
        const agent = await getAgentByName(this.env.MyAgent, this.name);
        const response = (await agent.respond(message.user + ": " + prompt, history));
        // .replace(/^Agent:\s*/, "");
        console.log(response);
        const agentMessage: ChatMessage = {
            id: nanoid(8),
            content: response,
            user: "Agent",
            role: "assistant",
        };

        this.saveMessage(agentMessage);
        this.broadcastMessage({ type: "add", ...agentMessage });
    }
}
