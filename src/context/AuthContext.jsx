import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../supabaseClient"; 

const AuthContext = createContext();

export const AuthContextProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUpNewUser = async (email, password, role = "passenger", extraData = {}) => {
    try {
      // 1. Sign up user in Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password,
        options: {
          data: { role, ...extraData },
        },
      });

      if (error) return { success: false, error };

      const userId = data.user?.id;
      if (userId) {
        // 2. Upsert into main "users" table using id as the conflict target
        const { error: userError } = await supabase.from("users").upsert(
          {
            id: userId,
            email: email.toLowerCase(),
            role: role,
          },
          { onConflict: "id" }
        );

        if (userError) return { success: false, error: userError };

        // 3. Upsert into role-specific tables using "userid" as the conflict target
        if (role === "passenger") {
          const { error: passengerError } = await supabase.from("passengers").upsert(
            {
              userid: userId,
              phonenumber: extraData.phonenumber || "",
              address: extraData.address || "",
              first_name: extraData.first_name || "",
              middle_name: extraData.middle_name || "",
              last_name: extraData.last_name || "",
              suffix_name: extraData.suffix_name || "",
              age: extraData.age || 0,
            },
            { onConflict: "userid" }
          );

          if (passengerError) return { success: false, error: passengerError };

        } else if (role === "driver") {
          const { error: driverError } = await supabase.from("drivers").upsert(
            {
              userid: userId,
              licensenumber: extraData.licensenumber || "",
              first_name: extraData.first_name || "",
              last_name: extraData.last_name || "",
            },
            { onConflict: "userid" }
          );

          if (driverError) return { success: false, error: driverError };
        }
      }

      return { success: true, data };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  const signInUser = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });
      if (error) return { success: false, error: error.message };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, signUpNewUser, signInUser, signOut, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const UserAuth = () => {
  return useContext(AuthContext);
};