import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import React, { useEffect, useRef, useState } from "react";
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
    useParams,
    useNavigate,
} from "react-router";
import { nanoid } from "nanoid";
import { type ChatMessage, type Message } from "../shared";
import Home from "./home";
import "./index.css";
import { Button } from "@/components/ui/button";
import { Ring } from 'ldrs/react'
import 'ldrs/react/Ring.css'
import { FaArrowLeft } from "react-icons/fa";

export async function checkChatroom(id: string) {
    if (!id) return false;
    const res = await fetch(`/api/room-exists?roomId=${encodeURIComponent(id)}`);
    if (!res.ok) return false;
    return (await res.json()).exist;
}
export async function createChatroom(id: string, name: string) {
    const res = await fetch("/api/chatrooms", {
        method: "POST",
        body: JSON.stringify({
            id,
            name
        })
    })
    if (!res.ok) return false
    return true
}

type CurrentUser = {
    id: string;
    username: string;
};

async function getCurrentUser(): Promise<CurrentUser | null> {
    const res = await fetch("/api/me");
    if (!res.ok) return null;
    const data = await res.json();
    return data.user ?? null;
}

function App({ currentUser }: { currentUser: CurrentUser }) {
    const [user, setUser] = useState<CurrentUser>(currentUser);
    const [isAuthLoading, setIsAuthLoading] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [content, setContent] = useState("")
    const { room } = useParams();
    const chatBoxRef = useRef<HTMLDivElement | null>(null)
    const navigate = useNavigate();

    useEffect(() => {
        setUser(currentUser);
    }, [currentUser]);

    useEffect(() => {
        if (!chatBoxRef.current) return
        chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight
    }, [messages])

    const socket = usePartySocket({
        party: "chat",
        room,
        onMessage: (evt) => {
            console.log("Client", evt.data);
            const message = JSON.parse(evt.data as string) as Message;
            console.log("Client", message);
            if (message.type === "add") {
                const foundIndex = messages.findIndex(
                    (m) => m.id === message.id,
                );
                if (foundIndex === -1) {
                    // probably someone else who added a message
                    setMessages((messages) => [
                        ...messages,
                        {
                            id: message.id,
                            content: message.content,
                            user: message.user,
                            role: message.role,
                        },
                    ]);
                } else {
                    // this usually means we ourselves added a message
                    // and it was broadcasted back
                    // so let's replace the message with the new message
                    setMessages((messages) => {
                        return messages
                            .slice(0, foundIndex)
                            .concat({
                                id: message.id,
                                content: message.content,
                                user: message.user,
                                role: message.role,
                            })
                            .concat(messages.slice(foundIndex + 1));
                    });
                }
            } else if (message.type === "update") {
                setMessages((messages) =>
                    messages.map((m) =>
                        m.id === message.id
                            ? {
                                  id: message.id,
                                  content: message.content,
                                  user: message.user,
                                  role: message.role,
                              }
                            : m,
                    ),
                );
            } else {
                setMessages(message.messages);
            }
        },
    });

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!room) return;
            const res = await fetch("/api/me/renames");
            if (!res.ok) return;
            const data = await res.json();
            if (cancelled) return;
            const renames = Array.isArray(data?.renames) ? data.renames : [];
            if (renames.length === 0) return;
            const oldest = renames[0];
            const newest = renames[renames.length - 1];
            if (!oldest?.old || !newest?.new) return;
            if (oldest.old === newest.new) return;
            socket.send(
                JSON.stringify({
                    type: "rename",
                    userId: user.id,
                    id: newest.id,
                    old: oldest.old,
                    new: newest.new,
                } satisfies Message),
            );
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [room, socket]);

    return (
        <div className="flex flex-col h-screen w-screen justify-center items-center font-[Lexend]">
            <Button variant="ghost" className="absolute top-10 left-10 h-fit aspect-square group" onClick={() => navigate("/")}>
                <FaArrowLeft className="size-8 text-gray-700 group-hover:text-gray-800 transition" />
            </Button>
            <div className="space-y-3 w-full flex-1 overflow-y-auto px-[30%] py-4 mt-6" ref={chatBoxRef}>

                {messages.map((message) => {
                    if (message.role == "system"){
                        return (
                            <div
                                key={message.id}
                                className="flex justify-center my-6"
                            >
                                <div className="max-w-[90%] rounded-full border border-slate-300 bg-slate-100/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-600 shadow-sm backdrop-blur">
                                    {message.content}
                                </div>
                            </div>
                        )
                    }

                    const isMine = message.user === user?.username;
                    return (
                        <div
                            key={message.id}
                            className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className={`max-w-[75%] rounded-2xl px-4 py-3 text-md shadow-sm ${
                                    isMine
                                        ? "bg-green-600/80 text-white"
                                        : "border border-slate-200 bg-white text-slate-800"
                                }`}
                            >
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">
                                    {isMine ? "You" : message.user}
                                </p>
                                <p className="mt-2 whitespace-pre-wrap">{message.content}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="h-[100px] flex justify-center items-center text-md w-full px-[30%]">
                <form
                    className="flex gap-4 w-full justify-center"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!user) {
                            navigate("/");
                            return;
                        }
                        if (!content.trim()) return

                        const chatMessage: ChatMessage = {
                            id: nanoid(8),
                            content: content,
                            user: user.username,
                            role: "user",
                        };
                        setMessages((messages) => [...messages, chatMessage]);
                        
                        // we could broadcast the message here
                        socket.send(
                            JSON.stringify({
                                type: "add",
                                ...chatMessage,
                            } satisfies Message),
                        );
                        
                        setContent("");
                    }}
                >
                    <input
                        type="text"
                        className="border-2 border-stone-500/40 px-4 py-2 rounded-2xl w-[80%] flex-1"
                        placeholder={
                            user
                                ? `Hello ${user.username}! Type a message...`
                                : "Type a message..."
                        }
                        autoComplete="off"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                    />
                    <Button
                        disabled={!content.trim() || !user || isAuthLoading}
                        className="h-auto"
                    >
                        Send
                    </Button>
                </form>
            </div>
        </div>
    );
}

function RoomGuard() {
    const { room } = useParams();
    const [isChecking, setIsChecking] = useState(true);
    const [exists, setExists] = useState(false);
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setIsChecking(true);
            const [ok, currentUser] = await Promise.all([
                checkChatroom(room ?? ""),
                getCurrentUser(),
            ]);
            if (cancelled) return;
            setExists(ok);
            setCurrentUser(currentUser);
            if (!ok){
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
            setIsChecking(false);
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [room]);

    if (isChecking) {
        return (
            <div className="flex h-screen w-screen items-center justify-center font-[Lexend]">
                {/* <div className="text-slate-600">Checking chatroom…</div> */}
                <Ring
                    size="80"
                    stroke="5"
                    bgOpacity="0"
                    speed="2"
                    color="black" 
                />
            </div>
        );
    }

    if (!exists || !currentUser) return <Navigate to="/" replace />;
    return <App currentUser={currentUser} />;
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(
    <BrowserRouter>
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/:room" element={<RoomGuard />} />
            <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    </BrowserRouter>,
);
