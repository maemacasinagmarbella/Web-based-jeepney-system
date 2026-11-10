import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { UserAuth } from "../context/AuthContext";
import { supabase } from "../supabaseClient";
import L from "leaflet";

import PassengerDashboard from "./views/PassengerDashboard";
import DriverDashboard from "./views/DriverDashboard";
import AdminDashboard from "./views/AdminDashboard";

const BUENAVISTALEGAZPI = [13.1392, 123.7438];

// Bulletproof inline SVG Jeepney Icon
const jeepneySvg = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="38" height="38" fill="#2563eb">
    <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
  </svg>
`)}`;

const jeepneyIcon = L.icon({
  iconUrl: jeepneySvg,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  popupAnchor: [0, -15],
});

const Dashboard = () => {
  const { session, signOut } = UserAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [roleData, setRoleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeDrivers, setActiveDrivers] = useState([]);

  // Fetch user profile and role data
  useEffect(() => {
    const fetchUserData = async () => {
      if (!session?.user) return;
      try {
        setLoading(true);
        const { data: userData, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", session.user.id)
          .single();
        if (error) throw error;
        setProfile(userData);

        if (userData.role === "passenger") {
          const { data } = await supabase.from("passengers").select("*").eq("userid", session.user.id).maybeSingle();
          setRoleData(data);
        } else if (userData.role === "driver") {
          const { data } = await supabase.from("drivers").select("*").eq("userid", session.user.id).maybeSingle();
          setRoleData(data);
        } else if (userData.role === "admin") {
          const { data } = await supabase.from("admins").select("*").eq("userid", session.user.id).maybeSingle();
          setRoleData(data);
        }
      } catch (err) {
        console.error("Error fetching user:", err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [session]);

  // Global Realtime Active Drivers Listener
  useEffect(() => {
    if (!session?.user) return;

    const fetchInitialDrivers = async () => {
      const { data } = await supabase
        .from("drivers")
        .select("*, users(email)")
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      if (data) setActiveDrivers(data);
    };

    fetchInitialDrivers();

    const channel = supabase
      .channel("driver-tracking-channel")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "drivers" }, async (payload) => {
        const updated = payload.new;

        // If driver signed out or cleared location, remove them from active list instantly
        if (updated.latitude === null || updated.longitude === null) {
          setActiveDrivers((prev) => prev.filter((d) => d.id !== updated.id));
          return;
        }

        if (updated.latitude && updated.longitude) {
          const { data: userData } = await supabase.from("users").select("email").eq("id", updated.userid).single();
          const enriched = { ...updated, users: userData || { email: "Driver" } };

          setActiveDrivers((prev) => {
            const index = prev.findIndex((d) => d.id === enriched.id);
            if (index !== -1) {
              const copy = [...prev];
              copy[index] = enriched;
              return copy;
            }
            return [...prev, enriched];
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session]);

  const handleSignOut = async () => {
    try {
      // If the user is a driver, clear their GPS location and availability before signing out
      if (profile?.role === "driver" && session?.user?.id) {
        await supabase
          .from("drivers")
          .update({ latitude: null, longitude: null, isavailableforrental: false })
          .eq("userid", session.user.id);
      }

      await signOut();
      navigate("/signin");
    } catch (err) {
      console.error("Error during sign out:", err);
      await signOut();
      navigate("/signin");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8fafc] text-slate-700 flex-col gap-3">
        <div className="w-10 h-10 border-4 border-[#2563eb] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-bold tracking-wide">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col w-full">
      <main className="flex-1 w-full flex flex-col">
        {/* Delegate rendering based on role edge-to-edge */}
        {profile?.role === "passenger" && (
          <PassengerDashboard session={session} profile={profile} roleData={roleData} activeDrivers={activeDrivers} jeepneyIcon={jeepneyIcon} onSignOut={handleSignOut} />
        )}
        {profile?.role === "driver" && (
          <DriverDashboard session={session} profile={profile} roleData={roleData} activeDrivers={activeDrivers} jeepneyIcon={jeepneyIcon} onSignOut={handleSignOut} />
        )}
        {profile?.role === "admin" && (
          <AdminDashboard session={session} profile={profile} roleData={roleData} jeepneyIcon={jeepneyIcon} onSignOut={handleSignOut} />
        )}
      </main>
    </div>
  );
};

export default Dashboard;