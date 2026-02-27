import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { checkChatroom, createChatroom } from ".";
import { nanoid } from "nanoid";
import { IoMdArrowRoundBack } from "react-icons/io";
import { cn } from "@/lib/utils";
import { MdError } from "react-icons/md";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Home = () => {
    const [roomId, setRoomId] = useState("");
    const [roomName, setRoomName] = useState("");
    const [page, setPage] = useState<"join" | "create">("join");
    const [error, setError] = useState<string>("");
    const navigate = useNavigate();
    const [user, setUser] = useState<{ id: string; username: string } | null>(
        null,
    );
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [authError, setAuthError] = useState("");
    const [authMode, setAuthMode] = useState<"login" | "signup">("login");
    const [authUsername, setAuthUsername] = useState("");
    const [authPassword, setAuthPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsUsername, setSettingsUsername] = useState("");
    const [settingsPassword, setSettingsPassword] = useState("");
    const [settingsError, setSettingsError] = useState("");
    const [settingsSaving, setSettingsSaving] = useState(false);

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
        if (roomName.trim()) {
            const slug = slugify(roomName);
            if (!(await createChatroom(slug, roomName))) {
                setError("Error creating room. Please try again");
                return;
            }
            setError("");
            navigate("/" + slug);
        } else {
            setError("Please enter a valid name");
        }
    }

    async function onSubmitJoin() {
        if (roomId.trim()) {
            if (!(await checkChatroom(roomId.trim()))) {
                setError("Room does not exist");
                return;
            }
            setError("");
            navigate(`/${roomId.trim()}`);
        } else {
            setError("Please enter a valid room code");
        }
    }

    useEffect(() => {
        setError("");
    }, [page]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setIsAuthLoading(true);
            try {
                const res = await fetch("/api/me");
                if (!res.ok) {
                    if (!cancelled) setUser(null);
                    return;
                }
                const data = await res.json();
                if (!cancelled) setUser(data.user ?? null);
            } finally {
                if (!cancelled) setIsAuthLoading(false);
            }
        };
        run();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!user) return;
        setSettingsUsername(user.username);
    }, [user]);

    async function submitAuth(e: React.FormEvent) {
        e.preventDefault();
        setAuthError("");
        const endpoint = authMode === "login" ? "/api/login" : "/api/signup";
        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: authUsername.trim(),
                password: authPassword,
            }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setAuthError(data?.error ?? "Login failed");
            return;
        }
        const data = await res.json();
        setUser(data.user ?? null);
        setAuthPassword("");
        setAuthError("");
    }

    async function logout() {
        await fetch("/api/logout", { method: "POST" });
        if (location.pathname === "/") {
            window.location.reload();
        } else {
            navigate("/");
        }
    }

    async function saveSettings(e: React.FormEvent) {
        e.preventDefault();
        if (!user) return;
        setSettingsError("");
        setSettingsSaving(true);
        try {
            const res = await fetch("/api/me", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: settingsUsername.trim(),
                    password: settingsPassword,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setSettingsError(data?.error ?? "Failed to update username");
                return;
            }
            const data = await res.json();
            setUser(data.user ?? user);
            setSettingsPassword("");
        } finally {
            setSettingsSaving(false);
        }
    }

    return (
        <div className="relative w-screen h-screen overflow-hidden text-slate-900 bg-[url('/images/bg2.png')] flex justify-center items-center font-[Lexend]">
            {user && (
                <>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="text-2xl rounded-full h-14 w-14 absolute top-8 right-12">
                                {user.username.substring(0, 1).toUpperCase()}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            className="w-40"
                            align="end"
                            sideOffset={10}
                        >
                            <DropdownMenuGroup>
                                <DropdownMenuLabel className="text-md">
                                    My Account
                                </DropdownMenuLabel>
                                <DropdownMenuItem
                                    className="text-md"
                                    onSelect={(e) => {
                                        e.preventDefault();
                                        setSettingsOpen(true);
                                    }}
                                >
                                    Settings
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                                <DropdownMenuItem
                                    onClick={logout}
                                    className="text-md"
                                >
                                    Log out
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                        <DialogContent className="sm:max-w-sm">
                            <DialogHeader>
                                <DialogTitle>Account Settings</DialogTitle>
                                <DialogDescription>
                                    Hello {user.username}!
                                </DialogDescription>
                            </DialogHeader>
                            <form className="space-y-4" onSubmit={saveSettings}>
                                <div className="space-y-2">
                                    <label
                                        className="text-sm font-semibold uppercase tracking-widest text-slate-600"
                                        htmlFor="settings-username"
                                    >
                                        Username
                                    </label>
                                    <input
                                        id="settings-username"
                                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                                        value={settingsUsername}
                                        onChange={(e) =>
                                            setSettingsUsername(e.target.value)
                                        }
                                        autoComplete="username"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label
                                        className="text-sm font-semibold uppercase tracking-widest text-slate-600"
                                        htmlFor="settings-password"
                                    >
                                        Current password
                                    </label>
                                    <input
                                        id="settings-password"
                                        type="password"
                                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                                        value={settingsPassword}
                                        onChange={(e) =>
                                            setSettingsPassword(e.target.value)
                                        }
                                        autoComplete="current-password"
                                    />
                                </div>
                                {settingsError && (
                                    <div className="text-sm text-red-500 flex items-center gap-1">
                                        <MdError size={16} />
                                        <span>{settingsError}</span>
                                    </div>
                                )}
                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={
                                        settingsSaving ||
                                        !settingsUsername.trim() ||
                                        !settingsPassword.trim()
                                    }
                                >
                                    {settingsSaving
                                        ? "Saving..."
                                        : "Save changes"}
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </>
            )}

            <Dialog open={!user && !isAuthLoading}>
                <DialogContent className="sm:max-w-sm" showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle>
                            {authMode === "login" ? "Login" : "Sign up"}
                        </DialogTitle>
                        <DialogDescription>
                            {authMode === "login"
                                ? "Welcome back. Enter your username and password."
                                : "Create an account to join chatrooms."}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={submitAuth}>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label
                                    className="text-sm font-semibold uppercase tracking-widest text-slate-600"
                                    htmlFor="auth-username"
                                >
                                    Username
                                </label>
                                <input
                                    id="auth-username"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                                    value={authUsername}
                                    onChange={(e) =>
                                        setAuthUsername(e.target.value)
                                    }
                                    autoComplete="username"
                                />
                            </div>
                            <div className="space-y-2">
                                <label
                                    className="text-sm font-semibold uppercase tracking-widest text-slate-600"
                                    htmlFor="auth-password"
                                >
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        id="auth-password"
                                        type={
                                            showPassword ? "text" : "password"
                                        }
                                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-20 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                                        value={authPassword}
                                        onChange={(e) =>
                                            setAuthPassword(e.target.value)
                                        }
                                        autoComplete={
                                            authMode === "login"
                                                ? "current-password"
                                                : "new-password"
                                        }
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800"
                                        onClick={() =>
                                            setShowPassword((v) => !v)
                                        }
                                    >
                                        {showPassword ? "Hide" : "Show"}
                                    </button>
                                </div>
                            </div>
                            {authError && (
                                <div className="text-sm text-red-500 flex items-center gap-1">
                                    <MdError size={16} />
                                    <span>{authError}</span>
                                </div>
                            )}
                            <Button
                                type="submit"
                                className="w-full"
                                disabled={
                                    !authUsername.trim() || !authPassword.trim()
                                }
                            >
                                {authMode === "login"
                                    ? "Login"
                                    : "Create account"}
                            </Button>
                            <button
                                type="button"
                                className="w-full text-sm text-slate-600 hover:text-slate-800"
                                onClick={() =>
                                    setAuthMode((mode) =>
                                        mode === "login" ? "signup" : "login",
                                    )
                                }
                            >
                                {authMode === "login" ? (
                                    <>
                                        Need an account?{" "}
                                        <span className="underline">
                                            Sign up
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        "Already have an account?{" "}
                                        <span className="underline">Login</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <main className="md:rounded-3xl border-2 border-stone-400/50 bg-stone-300/20 shadow-2xl shadow-slate-300/70 backdrop-blur-lg lg:h-[50%] 2xl:w-[50%] 2xl:px-24 2xl:py-14 lg:w-[60%] h-full w-full px-4 py-4">
                {page === "create" && (
                    <div
                        className="rounded-full p-2 absolute top-6 left-6 cursor-pointer bg-stone-400/30 hover:bg-stone-400/50 transition z-99"
                        onClick={() => setPage("join")}
                    >
                        <IoMdArrowRoundBack size={25} />
                    </div>
                )}
                <div className="relative h-full w-full overflow-hidden">
                    <div
                        className={cn(
                            "flex h-full w-[calc(200%+30px)] transition-transform duration-250 gap-[30px]",
                            page === "join"
                                ? "translate-x-0"
                                : "-translate-x-[calc(50%+15px)]",
                        )}
                    >
                        <section
                            className={`w-1/2 h-full flex justify-center items-center flex-col`}
                        >
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
                                            onChange={(e) =>
                                                setRoomId(e.target.value)
                                            }
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    onSubmitJoin();
                                                }
                                            }}
                                        />
                                        <Button
                                            variant="outline"
                                            className="h-full text-lg px-4"
                                            onClick={onSubmitJoin}
                                        >
                                            Join room
                                        </Button>
                                    </div>
                                    {error && (
                                        <div className="mt-2 text-sm text-red-500 flex items-center gap-1">
                                            <MdError size={18} />
                                            <p>{error}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <Button
                                        className="w-full text-lg py-6"
                                        onClick={() => setPage("create")}
                                    >
                                        Create room
                                    </Button>
                                </div>
                            </div>
                        </section>

                        <section
                            className={`w-1/2 h-full flex justify-center items-center flex-col`}
                        >
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
                                            onChange={(e) =>
                                                setRoomName(e.target.value)
                                            }
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    onSubmitCreate();
                                                }
                                            }}
                                        />
                                    </div>
                                    {error && (
                                        <div className="mt-2 text-sm text-red-500 flex items-center gap-1">
                                            <MdError size={18} />
                                            <p>{error}</p>
                                        </div>
                                    )}
                                </div>

                                <Button
                                    className="w-full text-lg py-6"
                                    onClick={onSubmitCreate}
                                >
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
