import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

interface User {
    id?: string;
    email?: string;
    fullname?: string;
    tel?: string;
    [key: string]: any;
}

interface UserContextType {
    user: User | null;
    setUser: React.Dispatch<React.SetStateAction<User | null>>;
    DataUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {

    const [user, setUser] = useState<User | null>(null);
    //   console.log("UserContext: ", user);

    const DataUser = useCallback(async () => {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            try {
                const userId = JSON.parse(storedUser);
                const { data } = await supabase
                    .from("users")
                    .select("*")
                    .eq("id", userId)
                    .single();

                setUser(data || null);
                // Navigat
            } catch (error) {
                console.error("Failed to fetch user data:", error);
            }
        }
    }, [setUser]);

    useEffect(() => {
        DataUser()
    }, [!user]);

    // restore from localStorage on mount and sync changes
    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch { }
        }
    }, []);

    return (
        <UserContext.Provider value={{ user, setUser, DataUser }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const ctx = useContext(UserContext);
    if (!ctx) {
        throw new Error("useUser must be used within a UserProvider");
    }
    return ctx;
};
