import { routePartykitRequest } from "partyserver";

import { nanoid } from "nanoid";
import { scrypt } from "@noble/hashes/scrypt";
import { randomBytes } from "@noble/hashes/utils";
export { MyAgent } from "./agent";
export { Chat } from "./chat";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_MIN_LEN = 5;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, dkLen: 32 };

function toBase64(bytes: Uint8Array) {
	let binary = "";
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary);
}

function fromBase64(value: string) {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

function hashPassword(password: string) {
	const salt = randomBytes(16);
	const hash = scrypt(password, salt, SCRYPT_PARAMS);
	return [
		"scrypt",
		String(SCRYPT_PARAMS.N),
		String(SCRYPT_PARAMS.r),
		String(SCRYPT_PARAMS.p),
		String(SCRYPT_PARAMS.dkLen),
		toBase64(salt),
		toBase64(hash),
	].join(":");
}

function verifyPassword(password: string, stored: string) {
	const [tag, n, r, p, dkLen, saltB64, hashB64] = stored.split(":");
	if (tag !== "scrypt") return false;
	const params = {
		N: Number(n),
		r: Number(r),
		p: Number(p),
		dkLen: Number(dkLen),
	};
	if (!Number.isFinite(params.N)) return false;
	const salt = fromBase64(saltB64);
	const expected = fromBase64(hashB64);
	const actual = scrypt(password, salt, params);
	if (actual.length !== expected.length) return false;
	let diff = 0;
	for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
	return diff === 0;
}

function parseCookies(request: Request) {
	const header = request.headers.get("Cookie");
	if (!header) return {};
	const out: Record<string, string> = {};
	for (const part of header.split(";")) {
		const [rawKey, ...rest] = part.trim().split("=");
		if (!rawKey) continue;
		out[rawKey] = decodeURIComponent(rest.join("="));
	}
	return out;
}

function setSessionCookie(sessionId: string, request: Request) {
	const isSecure = new URL(request.url).protocol === "https:";
	const maxAge = Math.floor(SESSION_TTL_MS / 1000);
	return [
		`session=${encodeURIComponent(sessionId)}`,
		"HttpOnly",
		"Path=/",
		"SameSite=Lax",
		`Max-Age=${maxAge}`,
		isSecure ? "Secure" : "",
	]
		.filter(Boolean)
		.join("; ");
}

function clearSessionCookie(request: Request) {
	const isSecure = new URL(request.url).protocol === "https:";
	return [
		"session=",
		"HttpOnly",
		"Path=/",
		"SameSite=Lax",
		"Max-Age=0",
		isSecure ? "Secure" : "",
	]
		.filter(Boolean)
		.join("; ");
}

function json(data: unknown, init?: ResponseInit) {
	return Response.json(data, init);
}

type SessionCheck =
	| { ok: true; session: { id: string; user_id: string; expires_at: number } }
	| { ok: false; response: Response };

async function checkSession(request: Request, cookies: Record<string, string>, env: Env): Promise<SessionCheck> {
    const sessionId = cookies.session;
    if (!sessionId) {
        return { ok: false, response: json({ error: "Unauthorized" }, { status: 401 }) };
    }

    const session = await env.DB.prepare(
        "SELECT id, user_id, expires_at FROM Sessions WHERE id = ?",
    )
        .bind(sessionId)
        .first();
    const expiresAt = session ? Number(session.expires_at) : NaN;
    if (!session || !Number.isFinite(expiresAt)) {
        return { ok: false, response: json({ error: "Unauthorized" }, { status: 401 }) };
    }

    if (expiresAt < Date.now()) {
        await env.DB.prepare("DELETE FROM Sessions WHERE id = ?")
            .bind(sessionId)
            .run();
        return {
			ok: false,
			response: json(
				{ error: "Session expired" },
				{
					status: 401,
					headers: { "Set-Cookie": clearSessionCookie(request) },
				},
			),
		};
    }

    return {
		ok: true,
		session: {
			id: String(session.id),
			user_id: String(session.user_id),
			expires_at: Number(session.expires_at),
		},
	};
}

export default {
	async fetch(request, env: Env) {
        const url = new URL(request.url)
        const path = url.pathname
        const cloned = request.clone()

		if (request.method === "POST" && path === "/api/signup") {
			const body = await request.json().catch(() => null);
			const username = body?.username?.trim?.();
			const password = body?.password;
			if (
				typeof username !== "string" ||
				typeof password !== "string" ||
				!USERNAME_RE.test(username) ||
				password.length < PASSWORD_MIN_LEN
			) {
				return json({ error: "Invalid username or password" }, { status: 400 });
			}

			const existing = await env.DB.prepare(
				"SELECT id FROM Users WHERE username = ?",
			)
				.bind(username)
				.first();
			if (existing) {
				return json({ error: "Username already exists" }, { status: 409 });
			}

			const userId = nanoid(12);
			const passwordHash = hashPassword(password);
			const now = Date.now();

			const insert = await env.DB.prepare(
				"INSERT INTO Users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
			)
				.bind(userId, username, passwordHash, now)
				.run();
			if (!insert.success) {
				return json({ error: "Failed to create user" }, { status: 500 });
			}

			const sessionId = nanoid(24);
			const expiresAt = now + SESSION_TTL_MS;
			await env.DB.prepare(
				"INSERT INTO Sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
			)
				.bind(sessionId, userId, now, expiresAt)
				.run();

			return json(
				{ user: { id: userId, username } },
				{ status: 200, headers: { "Set-Cookie": setSessionCookie(sessionId, request) } },
			);
		}

		if (request.method === "POST" && path === "/api/login") {
			const body = await request.json().catch(() => null);
			const username = body?.username?.trim?.();
			const password = body?.password;
			if (typeof username !== "string" || typeof password !== "string") {
				return json({ error: "Invalid credentials" }, { status: 400 });
			}

			const user = await env.DB.prepare(
				"SELECT id, username, password_hash FROM Users WHERE username = ?",
			)
				.bind(username)
				.first();
			if (!user || typeof user.password_hash !== "string") {
				return json({ error: "Invalid credentials" }, { status: 401 });
			}

			if (!verifyPassword(password, user.password_hash)) {
				return json({ error: "Invalid credentials" }, { status: 401 });
			}

			const sessionId = nanoid(24);
			const now = Date.now();
			const expiresAt = now + SESSION_TTL_MS;
			await env.DB.prepare(
				"INSERT INTO Sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
			)
				.bind(sessionId, user.id, now, expiresAt)
				.run();

			return json(
				{ user: { id: user.id, username: user.username } },
				{ status: 200, headers: { "Set-Cookie": setSessionCookie(sessionId, request) } },
			);
		}

		if (request.method === "GET" && path === "/api/me") {
			const cookies = parseCookies(request);
            const sessionValid = await checkSession(request, cookies, env)
            
            if (!sessionValid.ok){
                return sessionValid.response
            }
            
            const session = sessionValid.session
			const user = await env.DB.prepare(
				"SELECT id, username FROM Users WHERE id = ?",
			)
				.bind(session.user_id)
				.first();
			if (!user) {
				return json({ error: "Unauthorized" }, { status: 401 });
			}

			const refreshedExpiresAt = Date.now() + SESSION_TTL_MS;
			await env.DB.prepare(
				"UPDATE Sessions SET expires_at = ? WHERE id = ?",
			)
				.bind(refreshedExpiresAt, session.id)
				.run();

			return json({ user: { id: user.id, username: user.username } }, { status: 200 });
		}

		if (request.method === "PATCH" && path === "/api/me") {
			const cookies = parseCookies(request);
			const sessionValid = await checkSession(request, cookies, env)
            
            if (!sessionValid.ok){
                return sessionValid.response
            }
			const session = sessionValid.session

			const body = await request.json().catch(() => null);
			const username = body?.username?.trim?.();
			const password = body?.password;
			if (
				typeof username !== "string" ||
				typeof password !== "string" ||
				!USERNAME_RE.test(username) ||
				password.length < PASSWORD_MIN_LEN
			) {
				return json({ error: "Invalid username or password" }, { status: 400 });
			}

			const user = await env.DB.prepare(
				"SELECT id, username, password_hash FROM Users WHERE id = ?",
			)
				.bind(session.user_id)
				.first();
			if (!user || typeof user.password_hash !== "string") {
				return json({ error: "Unauthorized" }, { status: 401 });
			}

			if (!verifyPassword(password, user.password_hash)) {
				return json({ error: "Invalid password" }, { status: 403 });
			}

			if (user.username === username) {
				return json({ user: { id: user.id, username: user.username } }, { status: 200 });
			}

			const existing = await env.DB.prepare(
				"SELECT id FROM Users WHERE username = ?",
			)
				.bind(username)
				.first();
			if (existing) {
				return json({ error: "Username already exists" }, { status: 409 });
			}

			const now = Date.now();
			await env.DB.prepare(
				"UPDATE Users SET username = ? WHERE id = ?",
			)
				.bind(username, user.id)
				.run();

			const renameId = nanoid(12);
			await env.DB.prepare(
				"INSERT INTO UsernameChanges (id, user_id, old_username, new_username, created_at) VALUES (?, ?, ?, ?, ?)",
			)
				.bind(renameId, user.id, user.username, username, now)
				.run();

			return json(
				{
					user: { id: user.id, username },
					rename: { id: renameId, old: user.username, new: username, created_at: now },
				},
				{ status: 200 },
			);
		}

		if (request.method === "GET" && path === "/api/me/renames") {
			const cookies = parseCookies(request);
			const sessionValid = await checkSession(request, cookies, env)
            
            if (!sessionValid.ok){
                return sessionValid.response
            }
			const session = sessionValid.session

			const rows = await env.DB.prepare(
				"SELECT id, old_username, new_username, created_at FROM UsernameChanges WHERE user_id = ? ORDER BY created_at ASC",
			)
				.bind(session.user_id)
				.all();
			const renames = rows.results.map((row) => ({
				id: row.id,
				old: row.old_username,
				new: row.new_username,
				created_at: Number(row.created_at),
			}));

			return json({ renames }, { status: 200 });
		}

		if (request.method === "POST" && path === "/api/logout") {
			const cookies = parseCookies(request);
			if (cookies.session) {
				await env.DB.prepare("DELETE FROM Sessions WHERE id = ?")
					.bind(cookies.session)
					.run();
			}
			return json(
				{ ok: true },
				{ status: 200, headers: { "Set-Cookie": clearSessionCookie(request) } },
			);
		}

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
