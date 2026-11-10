import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../supabaseClient";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const MAP_CENTER = [13.1000, 123.7500];

const AdminDashboard = ({ session, profile, jeepneyIcon, onSignOut }) => {
  const [passengersList, setPassengersList] = useState([]);
  const [driversList, setDriversList] = useState([]);
  const [rentalRequestsList, setRentalRequestsList] = useState([]);
  const [reviewsList, setReviewsList] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Navigation & Search State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const mobileMenuRef = useRef(null);

  // Edit User State
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    suffix_name: "",
    email: "",
    phonenumber: "",
    address: "",
    licensenumber: "",
    rentalrate: 0,
    isavailableforrental: false
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatFullName = (person, fallbackUser) => {
    const parts = [
      person?.first_name,
      person?.middle_name,
      person?.last_name,
      person?.suffix_name
    ].filter(Boolean);

    if (parts.length > 0) return parts.join(" ");
    if (person?.fullname) return person.fullname;
    if (person?.full_name) return person.full_name;
    if (fallbackUser?.full_name) return fallbackUser.full_name;
    return "N/A";
  };

  const fetchAdminData = async () => {
    setAdminLoading(true);
    try {
      // 1. Fetch Users
      const { data: usersData, error: userErr } = await supabase
        .from("users")
        .select("*");

      if (userErr) console.warn("Could not fetch users directly:", userErr.message);

      const userMap = {};
      usersData?.forEach((u) => {
        userMap[u.id] = u;
      });

      // 2. Fetch Passengers
      const { data: passengersData, error: passError } = await supabase
        .from("passengers")
        .select("*");
      
      if (passError) throw passError;
      
      if (passengersData) {
        const enrichedPassengers = passengersData.map((p) => {
          const matchedUser = userMap[p.userid] || { email: "N/A" };
          return {
            ...p,
            users: matchedUser,
            phonenumber: p.phonenumber || p.phone_number || "Not provided",
            address: p.address || p.home_address || "Not provided",
            fullname: formatFullName(p, matchedUser)
          };
        });
        setPassengersList(enrichedPassengers);
      }

      // 3. Fetch Drivers
      const { data: driversData, error: drvError } = await supabase
        .from("drivers")
        .select("*");
      
      if (drvError) throw drvError;

      if (driversData) {
        const enrichedDrivers = driversData.map((d) => {
          const matchedUser = userMap[d.userid] || { email: "N/A" };
          return {
            ...d,
            users: matchedUser,
            licensenumber: d.licensenumber || d.license_number || "N/A",
            fullname: formatFullName(d, matchedUser)
          };
        });
        setDriversList(enrichedDrivers);
      }

      // 4. Fetch Rental Requests
      const { data: requestsData, error: reqError } = await supabase
        .from("rental_requests")
        .select("*, passengers(userid), drivers(userid, licensenumber)")
        .order("created_at", { ascending: false });
      
      if (!reqError && requestsData) {
        setRentalRequestsList(requestsData);
      }

      // 5. Fetch Reviews
      const { data: revData, error: revError } = await supabase
        .from("rental_reviews")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (!revError && revData) {
        setReviewsList(revData);
      }
    } catch (err) {
      console.error("Error in fetchAdminData:", err.message);
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();

    const channel = supabase
      .channel("admin-realtime-oversight")
      .on("postgres_changes", { event: "*", schema: "public", table: "rental_requests" }, () => fetchAdminData())
      .on("postgres_changes", { event: "*", schema: "public", table: "drivers" }, () => fetchAdminData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDeleteUser = async (userId, userType) => {
    if (!window.confirm(`Are you sure you want to delete this ${userType}?`)) return;

    const { error } = await supabase.from("users").delete().eq("id", userId);
    if (error) {
      alert("Error deleting user: " + error.message);
    } else {
      fetchAdminData();
    }
  };

  const handleOpenEdit = (user, type) => {
    setEditingUser({ ...user, type });
    setEditForm({
      first_name: user.first_name || "",
      middle_name: user.middle_name || "",
      last_name: user.last_name || "",
      suffix_name: user.suffix_name || "",
      email: user.users?.email || "",
      phonenumber: user.phonenumber !== "Not provided" ? user.phonenumber : "",
      address: user.address !== "Not provided" ? user.address : "",
      licensenumber: user.licensenumber !== "N/A" ? user.licensenumber : "",
      rentalrate: user.rentalrate || 0,
      isavailableforrental: user.isavailableforrental || false
    });
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSaving(true);

    try {
      if (editingUser.type === "passenger") {
        const passengerPayload = {
          first_name: editForm.first_name,
          middle_name: editForm.middle_name,
          last_name: editForm.last_name,
          suffix_name: editForm.suffix_name,
          phonenumber: editForm.phonenumber,
          address: editForm.address
        };

        let query = supabase.from("passengers").update(passengerPayload);
        if (editingUser.id) {
          query = query.eq("id", editingUser.id);
        } else if (editingUser.userid) {
          query = query.eq("userid", editingUser.userid);
        }

        const { data, error } = await query.select();
        if (error) throw error;
        console.log("Passenger updated successfully:", data);

      } else if (editingUser.type === "driver") {
        const driverPayload = {
          first_name: editForm.first_name,
          middle_name: editForm.middle_name,
          last_name: editForm.last_name,
          suffix_name: editForm.suffix_name,
          licensenumber: editForm.licensenumber,
          rentalrate: parseFloat(editForm.rentalrate) || 0,
          isavailableforrental: editForm.isavailableforrental
        };

        let query = supabase.from("drivers").update(driverPayload);
        if (editingUser.id) {
          query = query.eq("id", editingUser.id);
        } else if (editingUser.userid) {
          query = query.eq("userid", editingUser.userid);
        }

        const { data, error } = await query.select();
        if (error) throw error;
        console.log("Driver updated successfully:", data);
      }

      if (editingUser.userid && editForm.email) {
        await supabase
          .from("users")
          .update({ email: editForm.email })
          .eq("id", editingUser.userid);
      }

      alert("Profile updated successfully!");
      setEditingUser(null);
      fetchAdminData();
    } catch (err) {
      console.error("Save Profile Error:", err);
      alert("Failed to update profile: " + (err.message || "Bad Request"));
    } finally {
      setIsSaving(false);
    }
  };

  const activeDriversCount = driversList.filter((d) => d.latitude && d.longitude).length;
  const pendingRequestsCount = rentalRequestsList.filter((r) => r.status === "pending").length;

  const query = searchQuery.toLowerCase();
  const filteredPassengers = passengersList.filter(
    (p) => p.fullname?.toLowerCase().includes(query) || p.users?.email?.toLowerCase().includes(query) || p.phonenumber?.toLowerCase().includes(query) || p.address?.toLowerCase().includes(query)
  );
  const filteredDrivers = driversList.filter(
    (d) => d.fullname?.toLowerCase().includes(query) || d.users?.email?.toLowerCase().includes(query) || d.licensenumber?.toLowerCase().includes(query)
  );
  const filteredRequests = rentalRequestsList.filter(
    (r) => r.pickup_location?.toLowerCase().includes(query) || r.destination?.toLowerCase().includes(query) || r.status?.toLowerCase().includes(query)
  );
  const filteredReviews = reviewsList.filter(
    (rev) => rev.comment?.toLowerCase().includes(query)
  );

  return (
    <div className="w-full flex flex-col min-h-screen bg-[#f8fafc] relative">
      <header className="bg-[#0f172a] border-b border-slate-800 px-6 py-4 flex items-center justify-between w-full z-40 text-white gap-4">
        <div className="flex items-center gap-4">
          <div className="relative" ref={mobileMenuRef}>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="bg-slate-800 p-2.5 rounded-xl text-slate-200 hover:bg-slate-700 border border-slate-700 focus:outline-none"
            >
              <svg className="h-6 w-6 text-[#2563eb]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {isMobileMenuOpen && (
              <div className="absolute top-14 left-0 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl py-3 px-2 flex flex-col gap-1 z-50 text-slate-800">
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <p className="font-extrabold text-slate-900 text-sm">Admin Navigation</p>
                  <p className="text-[11px] text-slate-500 truncate">{profile?.email || session?.user?.email || "Administrator"}</p>
                </div>
                <button onClick={() => { setActiveTab("overview"); setIsMobileMenuOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold ${activeTab === "overview" ? "bg-blue-50 text-[#2563eb]" : "hover:bg-slate-50 text-slate-600"}`}>Live Fleet Map & Overview</button>
                <button onClick={() => { setActiveTab("requests"); setIsMobileMenuOpen(false); }} className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold ${activeTab === "requests" ? "bg-blue-50 text-[#2563eb]" : "hover:bg-slate-50 text-slate-600"}`}>
                  <span>Rental Requests</span>
                  {pendingRequestsCount > 0 && <span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full font-extrabold">{pendingRequestsCount}</span>}
                </button>
                <button onClick={() => { setActiveTab("users"); setIsMobileMenuOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold ${activeTab === "users" ? "bg-blue-50 text-[#2563eb]" : "hover:bg-slate-50 text-slate-600"}`}>User Management ({passengersList.length + driversList.length})</button>
                <button onClick={() => { setActiveTab("reviews"); setIsMobileMenuOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold ${activeTab === "reviews" ? "bg-blue-50 text-[#2563eb]" : "hover:bg-slate-50 text-slate-600"}`}>Driver Reviews ({reviewsList.length})</button>
                {onSignOut && (
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <button onClick={() => { setIsMobileMenuOpen(false); onSignOut(); }} className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50">Sign Out</button>
                  </div>
                )}
              </div>
            )}
          </div>
          <h1 className="text-lg font-bold text-white hidden sm:block">{profile?.email || session?.user?.email || "Admin Account"}</h1>
        </div>

        <div className="flex-1 max-w-md mx-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search records, names, emails, locations..."
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#2563eb]"
          />
        </div>
      </header>

      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700 uppercase tracking-wider">
          <span className="text-[#2563eb]">Current View:</span>
          <span className="bg-slate-100 text-slate-900 px-3 py-1 rounded-lg">
            {activeTab === "overview" && "Live Fleet Map & Overview"}
            {activeTab === "requests" && "Rental Requests"}
            {activeTab === "users" && "User Management"}
            {activeTab === "reviews" && "Driver Reviews & Ratings"}
          </span>
        </div>
      </div>

      <div className="flex-grow p-6 flex flex-col gap-6">
        {adminLoading && passengersList.length === 0 ? (
          <p className="text-sm text-slate-400 py-12 text-center italic">Loading admin control panel...</p>
        ) : (
          <>
            {activeTab === "overview" && (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-1">
                    <span className="text-xs font-bold text-slate-400 uppercase">Passengers</span>
                    <span className="text-2xl font-black text-slate-900">{passengersList.length}</span>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-1">
                    <span className="text-xs font-bold text-slate-400 uppercase">Drivers</span>
                    <span className="text-2xl font-black text-slate-900">{driversList.length}</span>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-1">
                    <span className="text-xs font-bold text-slate-400 uppercase">Active Units</span>
                    <span className="text-2xl font-black text-[#0d9488]">{activeDriversCount}</span>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-1">
                    <span className="text-xs font-bold text-slate-400 uppercase">Rental Requests</span>
                    <span className="text-2xl font-black text-[#2563eb]">{rentalRequestsList.length}</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 h-[550px] relative overflow-hidden">
                  <MapContainer key={`map-${driversList.length}-${activeTab}`} center={MAP_CENTER} zoom={12} className="w-full h-full absolute inset-0 z-0">
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {driversList.filter((d) => d.latitude && d.longitude).map((driver) => (
                      <Marker key={driver.id || driver.userid} position={[parseFloat(driver.latitude), parseFloat(driver.longitude)]} icon={jeepneyIcon}>
                        <Popup>
                          <div className="text-sm">
                            <p className="font-bold text-white">{driver.fullname}</p>
                            <p className="text-slate-300 text-xs">License: {driver.licensenumber}</p>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </div>
            )}

            {activeTab === "requests" && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-4">
                <h3 className="text-base font-bold text-[#0f172a]">Rental Requests ({filteredRequests.length})</h3>
                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b text-slate-600 font-bold uppercase">
                      <tr>
                        <th className="p-3">Pickup & Destination</th>
                        <th className="p-3">Rate</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Requested Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium">
                      {filteredRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-50">
                          <td className="p-3 text-slate-600">{req.pickup_location} → <strong>{req.destination}</strong></td>
                          <td className="p-3 text-[#0d9488] font-bold">₱{parseFloat(req.agreed_rate || 0).toFixed(2)}</td>
                          <td className="p-3"><span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800">{req.status}</span></td>
                          <td className="p-3 text-right text-slate-400 font-mono">{new Date(req.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "users" && (
              <div className="flex flex-col gap-8">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-4">
                  <h3 className="text-base font-bold text-[#0f172a]">Registered Passengers ({filteredPassengers.length})</h3>
                  <div className="border border-slate-200 rounded-xl overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b text-slate-600 font-bold uppercase">
                        <tr>
                          <th className="p-3">Full Name</th>
                          <th className="p-3">Email</th>
                          <th className="p-3">Phone</th>
                          <th className="p-3">Address</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-medium">
                        {filteredPassengers.map((p) => (
                          <tr key={p.id || p.userid} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-900">{p.fullname}</td>
                            <td className="p-3 text-slate-700">{p.users?.email || "N/A"}</td>
                            <td className="p-3 text-slate-600">{p.phonenumber}</td>
                            <td className="p-3 text-slate-600">{p.address}</td>
                            <td className="p-3 text-right flex items-center justify-end gap-2">
                              <button onClick={() => handleOpenEdit(p, "passenger")} className="bg-blue-50 hover:bg-blue-100 text-[#2563eb] px-3 py-1.5 rounded-xl text-xs font-bold border border-blue-200">Edit</button>
                              <button onClick={() => handleDeleteUser(p.userid, "passenger")} className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-xl text-xs font-bold border border-red-200">Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-4">
                  <h3 className="text-base font-bold text-[#0f172a]">Registered Drivers ({filteredDrivers.length})</h3>
                  <div className="border border-slate-200 rounded-xl overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b text-slate-600 font-bold uppercase">
                        <tr>
                          <th className="p-3">Full Name</th>
                          <th className="p-3">Email</th>
                          <th className="p-3">License Number</th>
                          <th className="p-3">Rental Availability</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-medium">
                        {filteredDrivers.map((d) => (
                          <tr key={d.id || d.userid} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-900">{d.fullname}</td>
                            <td className="p-3 text-slate-700">{d.users?.email || "N/A"}</td>
                            <td className="p-3 text-slate-600">{d.licensenumber}</td>
                            <td className="p-3">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${d.isavailableforrental ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                                {d.isavailableforrental ? `Yes (₱${d.rentalrate || 0})` : "No"}
                              </span>
                            </td>
                            <td className="p-3 text-right flex items-center justify-end gap-2">
                              <button onClick={() => handleOpenEdit(d, "driver")} className="bg-blue-50 hover:bg-blue-100 text-[#2563eb] px-3 py-1.5 rounded-xl text-xs font-bold border border-blue-200">Edit</button>
                              <button onClick={() => handleDeleteUser(d.userid, "driver")} className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-xl text-xs font-bold border border-red-200">Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "reviews" && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-4">
                <h3 className="text-base font-bold text-[#0f172a]">Passenger Feedback</h3>
                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b text-slate-600 font-bold uppercase">
                      <tr>
                        <th className="p-3">Rating</th>
                        <th className="p-3">Comment</th>
                        <th className="p-3 text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium">
                      {filteredReviews.map((rev) => (
                        <tr key={rev.id} className="hover:bg-slate-50">
                          <td className="p-3 text-amber-500 font-bold">{rev.rating}/5 ⭐</td>
                          <td className="p-3 text-slate-600 italic">"{rev.comment}"</td>
                          <td className="p-3 text-right text-slate-400 font-mono">{new Date(rev.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-base">Edit {editingUser.type === "passenger" ? "Passenger" : "Driver"} Profile</h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">First Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2563eb]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Middle Name</label>
                  <input
                    type="text"
                    value={editForm.middle_name}
                    onChange={(e) => setEditForm({ ...editForm, middle_name: e.target.value })}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2563eb]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Last Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2563eb]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Suffix (e.g. Jr., III)</label>
                  <input
                    type="text"
                    value={editForm.suffix_name}
                    onChange={(e) => setEditForm({ ...editForm, suffix_name: e.target.value })}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2563eb]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Email Address</label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2563eb]"
                />
              </div>

              {editingUser.type === "passenger" ? (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-700">Phone Number</label>
                    <input
                      type="text"
                      value={editForm.phonenumber}
                      onChange={(e) => setEditForm({ ...editForm, phonenumber: e.target.value })}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2563eb]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-700">Home Address</label>
                    <input
                      type="text"
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2563eb]"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-700">License Number</label>
                    <input
                      type="text"
                      value={editForm.licensenumber}
                      onChange={(e) => setEditForm({ ...editForm, licensenumber: e.target.value })}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2563eb]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 items-center">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700">Rental Rate (₱)</label>
                      <input
                        type="number"
                        value={editForm.rentalrate}
                        onChange={(e) => setEditForm({ ...editForm, rentalrate: e.target.value })}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2563eb]"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-4">
                      <input
                        type="checkbox"
                        id="isavailableforrental"
                        checked={editForm.isavailableforrental}
                        onChange={(e) => setEditForm({ ...editForm, isavailableforrental: e.target.checked })}
                        className="w-4 h-4 accent-[#2563eb] rounded cursor-pointer"
                      />
                      <label htmlFor="isavailableforrental" className="text-xs font-bold text-slate-700 cursor-pointer">Available for Rental</label>
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setEditingUser(null)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold">Cancel</button>
                <button type="submit" disabled={isSaving} className="bg-[#2563eb] hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-bold disabled:opacity-50">
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;