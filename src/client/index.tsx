import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import React, { useEffect, useRef, useState } from "react";
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
    Link,
    useParams,
    redirect,
    useNavigate,
} from "react-router";
import { nanoid } from "nanoid";
import { names, type ChatMessage, type Message } from "../shared";
import Home from "./home";
import "./index.css";
import { Button } from "@/components/ui/button";
import { Ring } from 'ldrs/react'
import 'ldrs/react/Ring.css'

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

function App() {
    // const [name] = useState(names[Math.floor(Math.random() * names.length)]);
    const [name] = useState(names[0]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [content, setContent] = useState("")
    const { room } = useParams();
    const chatBoxRef = useRef<HTMLDivElement | null>(null)
    const navigate = useNavigate();


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

    return (
        <div className="flex flex-col h-screen w-screen justify-center items-center font-[Lexend]">

            <div className="space-y-3 w-full flex-1 overflow-y-auto px-[30%] py-4" ref={chatBoxRef}>

                {messages.map((message) => {
                    const isMine = message.user === name;
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
                        if (!content.trim()) return

                        const chatMessage: ChatMessage = {
                            id: nanoid(8),
                            content: content,
                            user: name,
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
                        placeholder={`Hello ${name}! Type a message...`}
                        autoComplete="off"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                    />
                    <Button disabled={!content.trim()} className="h-auto">
                        Send
                    </Button>
                </form>
            </div>
        </div>
    );
}

function RoomGuard({ children }: { children: React.ReactNode }) {
    const { room } = useParams();
    const [isChecking, setIsChecking] = useState(true);
    const [exists, setExists] = useState(false);
    console.log(room)
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setIsChecking(true);
            const ok = await checkChatroom(room ?? "");
            if (cancelled) return;
            setExists(ok);
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

    if (!exists) return <Navigate to="/" replace />;
    return <>{children}</>;
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(
    <BrowserRouter>
        <Routes>
            <Route path="/" element={<Home />} />
            <Route
                path="/:room"
                element={
                    <RoomGuard>
                        <App />
                    </RoomGuard>
                }
            />
            <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    </BrowserRouter>,
);
