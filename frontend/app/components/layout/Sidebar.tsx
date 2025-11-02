"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { LayoutDashboard, FileText, PlusCircle, Bot, Settings, User, LogOut } from 'lucide-react';


const navigation = [
    {
        name: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        name: "Create Chatbot",
        href: "/create",
        icon: PlusCircle,
    },
    {
        name: "Documents",
        href: "/documents",
        icon: FileText,
    },
    {
        name: "My Chatbots",
        href: "/chatbots",
        icon: Bot,
    },
    {
        name: "Settings",
        href: "/settings",
        icon: Settings,
    },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside
            className="w-64 min-h-screen flex flex-col"
            style={{ backgroundColor: '#37353E' }}
        >

            <div className="p-3 border-b" style={{ borderColor: '#715A5A40' }}>
                <Link href="/dashboard" className="flex items-center gap-3">
                    <Image
                        src="/Bouldy.webp"
                        alt="Bouldy Logo"
                        width={50}
                        height={50}
                    />
                    <h1 className="text-xl font-bold" style={{ color: '#D3DAD9', fontSize: "1.5rem" }}>
                        Bouldy
                    </h1>
                </Link>
            </div>

            <nav className="flex-1">
                <ul className="space-y-0">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;

                        return (
                            <li key={item.name}>
                                <Link href={item.href}>
                                    <div
                                        className="w-full flex items-center gap-3 px-6 py-4 transition-all cursor-pointer"
                                        style={{
                                            backgroundColor: isActive ? '#715A5A' : 'transparent',
                                            color: '#D3DAD9',
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isActive) {
                                                e.currentTarget.style.backgroundColor = '#715A5A80';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isActive) {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                            }
                                        }}
                                    >
                                        <Icon className="w-5 h-5" />
                                        <span className="font-medium">{item.name}</span>
                                        {item.name === "My Chatbots" && (
                                            <span
                                                className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
                                                style={{
                                                    backgroundColor: '#D3DAD9',
                                                    color: '#37353E' ,
                                                }}
                                            >
                                                0
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>


            <div className="p-4 border-t" style={{ borderColor: '#715A5A40' }}>

                <div className="flex items-center gap-3 px-2 py-3">
                    <User className="w-5 h-5" style={{ color: '#D3DAD9' }} />
                    <div className="flex-1">
                        <p className="text-sm font-medium" style={{ color: '#D3DAD9' }}>
                            User Name
                        </p>
                        <p className="text-xs" style={{ color: '#D3DAD9', opacity: 0.6 }}>
                            user@email.com
                        </p>
                    </div>
                </div>

                <button
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 mt-2 rounded-lg transition-all cursor-pointer"
                    style={{
                        backgroundColor: 'transparent',
                        color: '#D3DAD9',
                        border: 'none'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#715A5A40';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm font-medium">Logout</span>
                </button>
            </div>
        </aside>
    );
}