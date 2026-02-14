import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { checkChatroom, createChatroom } from ".";
import { nanoid } from "nanoid";
import { IoMdArrowRoundBack } from "react-icons/io";
import { cn } from "@/lib/utils";
import { MdError } from "react-icons/md";

const Home = () => {
    const [roomId, setRoomId] = useState("");
    const [roomName, setRoomName] = useState("");
    const [page, setPage] = useState<"join" | "create">("join");
    const [error, setError] = useState<string>("");
    const navigate = useNavigate();
    const isJoin = page === "join";

    function slugify(text: string) {
        text += " " + nanoid(4);
        return text
            .toString()
            .normalize("NFD") // split accented characters
            .replace(/[\u0300-\u036f]/g, "") // remove accents
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, "") // remove invalid chars
            .replace(/\s+/g, "") // replace spaces with -
            .replace(/-+/g, ""); // remove duplicate -
    }

    async function onSubmitCreate() {
        if (roomName.trim()){
            const slug = slugify(roomName);
            if (!await createChatroom(slug, roomName)){
                setError("Error creating room. Please try again")
                return
            }
            setError("")
            navigate("/" + slug);
        } else {
            setError("Please enter a valid name")
        }
    }

    async function onSubmitJoin() {
        if (roomId.trim()){
            if(!await checkChatroom(roomId.trim())){
                setError("Room does not exist")
                return
            }
            setError("")
            navigate(`/${roomId.trim()}`);
        } else {
            setError("Please enter a valid room code")
        }
    }

    useEffect(() => {
        setError("")
    }, [page])

    return (
        <div className="relative w-screen h-screen overflow-hidden text-slate-900 bg-[url('/images/bg2.png')] flex justify-center items-center font-[Lexend]">
            <main className="md:rounded-3xl border-2 border-stone-400/50 bg-stone-300/20 shadow-2xl shadow-slate-300/70 backdrop-blur-lg lg:h-[50%] 2xl:w-[50%] 2xl:px-24 2xl:py-14 lg:w-[60%] h-full w-full px-4 py-4">
                {
                    page === "create" && (
                        <div
                            className="rounded-full p-2 absolute top-6 left-6 cursor-pointer bg-stone-400/30 hover:bg-stone-400/50 transition z-99"
                            onClick={() => setPage("join")}
                        >
                            <IoMdArrowRoundBack size={25} />
                        </div>
                    )
                }
                <div className="relative h-full w-full overflow-hidden">
                    <div
                        className={cn(
                            "flex h-full w-[calc(200%+30px)] transition-transform duration-250 gap-[30px]",
                            page === "join" ? "translate-x-0" : "-translate-x-[calc(50%+15px)]"
                        )}
                    >
                        <section className={`w-1/2 h-full flex justify-center items-center flex-col`}>
                            <h1 className="text-center text-5xl font-semibold text-slate-800">
                                Enter a chatroom
                            </h1>

                            <div className="mt-10 space-y-4 w-full">
                                <label className="text-md font-semibold uppercase tracking-widest text-slate-700">
                                    Room code
                                </label>
                                <div>
                                    <div className="flex gap-3 mt-2 flex-col md:flex-row">
                                        <input
                                            className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                                            placeholder="e.g. huddle-42"
                                            onChange={(e) => setRoomId(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    onSubmitJoin()
                                                }
                                            }}
                                        />
                                        <Button variant="outline" className="h-full text-lg px-4" onClick={onSubmitJoin}>
                                            Join room
                                        </Button>
                                    </div>
                                    {
                                        error &&
                                            <div className="mt-2 text-sm text-red-500 flex items-center gap-1">
                                                <MdError size={18}/>
                                                <p>{error}</p>
                                            </div>
                                    }
                                </div>

                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <Button className="w-full text-lg py-6" onClick={() => setPage("create")}>
                                        Create room
                                    </Button>
                                </div>
                            </div>
                        </section>

                        <section className={`w-1/2 h-full flex justify-center items-center flex-col`}>
                            <h1 className="text-center text-5xl font-semibold text-slate-800">
                                Create a chatroom
                            </h1>

                            <div className="mt-10 space-y-4 w-full">
                                <div>
                                    <div className="flex flex-col gap-3 w-full">
                                        <label className="text-md font-semibold uppercase tracking-widest text-slate-700">
                                            Room name
                                        </label>

                                        <input
                                            className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                                            placeholder="e.g. Edward's Room"
                                            onChange={(e) => setRoomName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    onSubmitCreate();
                                                }
                                            }}
                                        />
                                    </div>
                                    {
                                    error &&
                                        <div className="mt-2 text-sm text-red-500 flex items-center gap-1">
                                            <MdError size={18}/>
                                            <p>{error}</p>
                                        </div>
                                    }
                                </div>

                                <Button className="w-full text-lg py-6" onClick={onSubmitCreate}>
                                    Start Room
                                </Button>
                            </div>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Home;
