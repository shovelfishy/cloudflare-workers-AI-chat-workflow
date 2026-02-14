import {
	type Connection,
	Server,
	type WSMessage,
	routePartykitRequest,
} from "partyserver";

import type { ChatMessage, Message } from "../shared";
import { nanoid } from "nanoid";
import { getAgentByName } from "agents";
export { MyAgent } from "./agent";

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

        console.log("Room started")

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
		// let's broadcast the raw message to everyone else
		this.broadcast(message);
		// let's update our local messages store
		const parsed = JSON.parse(message as string) as Message;
		if (parsed.type === "add" || parsed.type === "update") {
            this.saveMessage(parsed);
			this.maybeInvokeAgent(parsed).catch((error) => {
				console.error("Agent invoke failed:", error);
			});
		}
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
            .map(e => ({
                role: e.role, content: `${e.user}: ${e.content}` 
            }))
		const agent = await getAgentByName(this.env.MyAgent, this.name);
		const response = (await agent.respond(message.user+": "+prompt, history))
            // .replace(/^Agent:\s*/, "");
        console.log(response)
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

export default {
	async fetch(request, env: Env) {
        const url = new URL(request.url)
        const path = url.pathname
        const cloned = request.clone()

        if (request.method == "GET" && path == "/api/room-exists"){
            const roomId = url.searchParams.get("roomId")
            const res = await env.DB.prepare("SELECT * FROM Chatrooms WHERE RoomId = ?").bind(roomId).run()
            console.log(res.results)

            return Response.json({exist: res.results.length > 0}, {
                status: 200
            })
        }
        if (request.method == "POST" && path == "/api/chatrooms"){
            const body = await request.json()
            const res = await env.DB.prepare("INSERT OR IGNORE INTO Chatrooms (roomid, roomname) VALUES (?, ?)").bind(body.id, body.name).run()

            if (!res.success){
                return Response.json({ error: "Something went wrong" }, { status: 500 })
            }
            
            return Response.json({ ok: true })
        }

        return (
			(await routePartykitRequest(cloned, { ...env })) ||
			env.ASSETS.fetch(cloned)
		);
	},
} satisfies ExportedHandler<Env>;