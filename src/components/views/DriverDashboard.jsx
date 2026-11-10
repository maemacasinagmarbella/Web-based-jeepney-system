import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../supabaseClient";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Center map view around the Legazpi / Buenavista corridor [latitude, longitude]
const MAP_CENTER = [13.1000, 123.7500];
const MapRecenter = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
};

const DriverDashboard = ({ session, profile, roleData, activeDrivers: initialActiveDrivers, jeepneyIcon, onSignOut }) => {
  const [activeDrivers, setActiveDrivers] = useState(initialActiveDrivers || []);
  const [driverLocation, setDriverLocation] = useState(MAP_CENTER);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const watchIdRef = useRef(null);

  // Profile Dropdown State
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Rental Settings State
  const [isRentalAvailable, setIsRentalAvailable] = useState(roleData?.isavailableforrental || false);
  const [rentalRate, setRentalRate] = useState(roleData?.rentalrate || "");

  // Rental Requests State
  const [rentalRequests, setRentalRequests] = useState([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [requestActionId, setRequestActionId] = useState(null);

  // Driver Feedback / Reviews State
  const [reviews, setReviews] = useState([]);
  const [averageRating, setAverageRating] = useState(0);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (initialActiveDrivers) {
      setActiveDrivers(initialActiveDrivers);
    }
  }, [initialActiveDrivers]);

  useEffect(() => {
    if (roleData) {
      setIsRentalAvailable(roleData.isavailableforrental || false);
      setRentalRate(roleData.rentalrate || "");
      if (roleData.latitude && roleData.longitude) {
        setDriverLocation([roleData.latitude, roleData.longitude]);
        setIsBroadcasting(true);
      }
    }
  }, [roleData]);

  // Fetch Driver Feedback & Ratings
  const fetchDriverReviews = async () => {
    if (!roleData?.id) return;
    try {
      const { data, error } = await supabase
        .from("rental_reviews")
        .select("*, passengers(users(email))")
        .eq("driver_id", roleData.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setReviews(data);
        if (data.length > 0) {
          const total = data.reduce((sum, r) => sum + r.rating, 0);
          setAverageRating((total / data.length).toFixed(1));
        } else {
          setAverageRating(0);
        }
      }
    } catch (err) {
      console.error("Error fetching driver reviews:", err);
    }
  };

  useEffect(() => {
    fetchDriverReviews();

    const reviewChannel = supabase
      .channel("driver-rental-reviews")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rental_reviews" },
        () => {
          fetchDriverReviews();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reviewChannel);
    };
  }, [roleData?.id]);

  // Delete Driver Review / Rating
  const handleDeleteReview = async (reviewId) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this rating feedback?");
    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from("rental_reviews")
        .delete()
        .eq("id", reviewId);

      if (error) throw error;

      const updatedReviews = reviews.filter((r) => r.id !== reviewId);
      setReviews(updatedReviews);
      if (updatedReviews.length > 0) {
        const total = updatedReviews.reduce((sum, r) => sum + r.rating, 0);
        setAverageRating((total / updatedReviews.length).toFixed(1));
      } else {
        setAverageRating(0);
      }
    } catch (err) {
      alert("Failed to delete review: " + err.message);
    }
  };

  // Fetch & Subscribe to Rental Requests
  useEffect(() => {
    if (!roleData?.id) return;

    const fetchRentalRequests = async () => {
      setIsLoadingRequests(true);
      try {
        const { data, error } = await supabase
          .from("rental_requests")
          .select("*, passengers(id, phonenumber, address, users(email))")
          .or(`driver_id.eq.${roleData.id},driver_id.is.null`)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setRentalRequests(data || []);
      } catch (err) {
        console.error("Error fetching rental requests:", err.message);
      } finally {
        setIsLoadingRequests(false);
      }
    };

    fetchRentalRequests();

    const channel = supabase
      .channel("driver-rental-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rental_requests" },
        () => {
          fetchRentalRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roleData?.id]);

  const toggleBroadcastLocation = async () => {
    if (isBroadcasting) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      await supabase
        .from("drivers")
        .update({ latitude: null, longitude: null })
        .eq("userid", session.user.id);

      setIsBroadcasting(false);
    } else {
      if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser");
        return;
      }

      setIsBroadcasting(true);

      watchIdRef.current = navigator.geolocation.watchPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          const { error } = await supabase
            .from("drivers")
            .update({ latitude: lat, longitude: lng })
            .eq("userid", session.user.id);

          if (!error) {
            setDriverLocation([lat, lng]);
          }
        },
        (error) => console.error("Geolocation error:", error),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    }
  };

  const handleDriverSignOut = async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    try {
      await supabase
        .from("drivers")
        .update({ latitude: null, longitude: null, rentalstatus: "offline" })
        .eq("userid", session.user.id);
    } catch (err) {
      console.error("Error clearing driver location on signout:", err);
    }
    if (onSignOut) onSignOut();
  };

  const handleUpdateRequestStatus = async (requestId, newStatus) => {
    setRequestActionId(requestId);
    try {
      const updatePayload = {
        status: newStatus,
        driver_id: roleData.id,
      };

      const { error } = await supabase
        .from("rental_requests")
        .update(updatePayload)
        .eq("id", requestId);

      if (error) throw error;

      setRentalRequests((prev) =>
        prev.map((req) => (req.id === requestId ? { ...req, ...updatePayload } : req))
      );
    } catch (err) {
      alert("Failed to update status: " + err.message);
    } finally {
      setRequestActionId(null);
    }
  };

  // Delete Rental Request Function for Driver
  const handleDeleteRequest = async (requestId) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this rental request record?");
    if (!confirmDelete) return;

    setRequestActionId(requestId);
    try {
      const { error } = await supabase
        .from("rental_requests")
        .delete()
        .eq("id", requestId);

      if (error) throw error;

      setRentalRequests((prev) => prev.filter((req) => req.id !== requestId));
    } catch (err) {
      alert("Failed to delete request: " + err.message);
    } finally {
      setRequestActionId(null);
    }
  };

  return (
    <div className="w-full flex flex-col min-h-screen bg-[#f8fafc]">
      {/* TOP HEADER NAVIGATION BAR */}
      <header className="bg-[#0f172a] border-b border-slate-800 shadow-md px-6 py-4 flex items-center justify-between w-full relative z-50 text-white">
        {/* LEFT: PROFILE ICON & EMAIL */}
        <div className="flex items-center gap-3">
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="bg-slate-800 p-2.5 rounded-full text-slate-200 hover:bg-slate-700 border border-slate-700 flex items-center justify-center transition-colors shadow-sm focus:outline-none"
              title="Driver Profile"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#2563eb]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>

            {isProfileOpen && (
              <div className="absolute top-14 left-0 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl py-5 px-6 flex flex-col gap-4 z-50 text-sm text-slate-800">
                <div className="border-b border-slate-200 pb-3">
                  <p className="font-extrabold text-slate-900 text-lg">{profile?.email || session?.user?.email || "Driver"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="bg-teal-100 text-[#0d9488] text-xs font-bold px-2.5 py-0.5 rounded-full">Driver Account</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-xs text-slate-600">
                  <p><strong>License:</strong> {roleData?.licensenumber || "N/A"}</p>
                </div>

                {onSignOut && (
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      handleDriverSignOut();
                    }}
                    className="w-full bg-red-50 hover:bg-red-100 text-red-600 py-2.5 px-4 rounded-xl font-bold transition-colors border border-red-200 text-sm flex items-center justify-center gap-2 mt-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-teal-500 animate-pulse"></span>
            <h1 className="text-lg font-bold tracking-tight text-white hidden sm:block">
              {profile?.email || session?.user?.email || "Driver Account"}
            </h1>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT CONTAINER */}
      <div className="flex flex-col lg:flex-row flex-grow w-full p-4 lg:p-6 gap-6">
        {/* LEFT SIDEBAR CONTROLS */}
        <div className="w-full lg:w-96 flex flex-col gap-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
            <div>
              <h3 className="text-base font-bold text-[#0f172a]">Dispatch & Status</h3>
              <p className="text-xs text-slate-500 mt-0.5">Toggle live GPS broadcasting for passenger maps.</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-2.5 text-xs font-medium">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Active Units Online:</span>
                <span className="font-bold text-[#0d9488] bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#0d9488]"></span> {activeDrivers.length} Live
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Broadcast Status:</span>
                <span
                  className={`font-bold px-2.5 py-1 rounded-full text-xs ${
                    isBroadcasting
                      ? "bg-red-50 text-red-600 border border-red-200 animate-pulse"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {isBroadcasting ? "● Broadcasting Live" : "○ Offline"}
                </span>
              </div>
              <p className="text-slate-400 text-[11px] mt-1 pt-2 border-t border-slate-200 font-mono">
                Lat: {driverLocation[0]?.toFixed(5)} | Lng: {driverLocation[1]?.toFixed(5)}
              </p>
            </div>

            <button
              onClick={toggleBroadcastLocation}
              className={`w-full py-3 rounded-xl text-white font-bold transition-colors text-sm shadow-sm flex items-center justify-center gap-2 ${
                isBroadcasting
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-[#0d9488] hover:bg-teal-700"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {isBroadcasting ? "Stop Broadcasting Location" : "Start Broadcasting Location"}
            </button>
          </div>

          {/* Rental Requests */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3.5">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wide flex items-center gap-2">
                <svg className="w-4 h-4 text-[#2563eb]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Rental Requests
              </h3>
              <span className="bg-blue-100 text-[#2563eb] text-xs font-bold px-2.5 py-0.5 rounded-full">
                {rentalRequests.length} Total
              </span>
            </div>

            {isLoadingRequests ? (
              <p className="text-xs text-slate-400 italic py-2">Loading requests...</p>
            ) : rentalRequests.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-3 text-center">No active rental requests at the moment.</p>
            ) : (
              <div className="flex flex-col gap-3.5 max-h-80 overflow-y-auto pr-1">
                {rentalRequests.map((req) => (
                  <div
                    key={req.id}
                    className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 flex flex-col gap-2.5 text-xs shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-slate-900 text-sm">
                          {req.passengers?.users?.email || "Passenger Request"}
                        </p>
                        {req.passengers?.phonenumber && (
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            {req.passengers.phonenumber}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full tracking-wide ${
                          req.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : req.status === "accepted"
                            ? "bg-emerald-100 text-emerald-800"
                            : req.status === "completed"
                            ? "bg-blue-100 text-[#2563eb]"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>

                    {/* From, To, and Offered Rate Display Block */}
                    <div className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200 space-y-2 font-medium">
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-blue-600 min-w-[45px]">From:</span>
                        <span className="text-slate-800 font-semibold">{req.pickup_location || "Legazpi Grand Central Terminal"}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-emerald-600 min-w-[45px]">To:</span>
                        <span className="text-slate-800 font-semibold">{req.destination || "Buenavista"}</span>
                      </div>
                      {req.agreed_rate && (
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <span className="font-bold text-slate-600">Offered Rate:</span>
                          <span className="text-[#0d9488] font-black text-sm">₱{parseFloat(req.agreed_rate).toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2.5 mt-1">
                      {req.status === "pending" && (
                        <>
                          <button
                            disabled={requestActionId === req.id}
                            onClick={() => handleUpdateRequestStatus(req.id, "accepted")}
                            className="flex-1 bg-[#0d9488] hover:bg-teal-700 text-white font-bold py-2 rounded-xl transition-colors text-xs shadow-sm"
                          >
                            Accept
                          </button>
                          <button
                            disabled={requestActionId === req.id}
                            onClick={() => handleUpdateRequestStatus(req.id, "cancelled")}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-xl transition-colors text-xs shadow-sm"
                          >
                            Decline
                          </button>
                        </>
                      )}

                      {req.status === "accepted" && (
                        <>
                          <button
                            disabled={requestActionId === req.id}
                            onClick={() => handleUpdateRequestStatus(req.id, "completed")}
                            className="flex-1 bg-[#2563eb] hover:bg-blue-700 text-white font-bold py-2 rounded-xl transition-colors text-xs shadow-sm"
                          >
                            Mark Completed
                          </button>
                          <button
                            disabled={requestActionId === req.id}
                            onClick={() => handleUpdateRequestStatus(req.id, "cancelled")}
                            className="flex-1 bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold py-2 rounded-xl transition-colors text-xs"
                          >
                            Cancel
                          </button>
                        </>
                      )}

                      {/* Delete Request Button */}
                      <button
                        disabled={requestActionId === req.id}
                        onClick={() => handleDeleteRequest(req.id)}
                        className="bg-red-50 hover:bg-red-100 text-red-600 font-semibold px-3 py-2 rounded-xl text-xs transition-colors border border-red-200"
                        title="Delete request record"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ratings & Feedback */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3.5 text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wide flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-500 fill-amber-500" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                Ratings & Feedback
              </h3>
              <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-full text-xs flex items-center gap-1">
                ⭐ {averageRating} / 5 ({reviews.length})
              </span>
            </div>

            {reviews.length === 0 ? (
              <p className="text-slate-400 italic py-3 text-center">No reviews received yet.</p>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-56 overflow-y-auto pr-1">
                {reviews.map((rev) => (
                  <div key={rev.id} className="border border-slate-200 rounded-xl p-3 bg-slate-50/70 flex flex-col gap-1.5 shadow-sm">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-800">
                        {rev.passengers?.users?.email?.split('@')[0] || "Passenger"}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-amber-500 font-bold text-sm tracking-wide flex items-center gap-0.5">
                          {Array.from({ length: rev.rating }).map((_, i) => (
                            <svg key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" viewBox="0 0 24 24">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          ))}
                        </span>

                        {/* Delete Review Button */}
                        <button
                          onClick={() => handleDeleteReview(rev.id)}
                          className="bg-red-50 hover:bg-red-100 text-red-600 font-semibold px-2 py-0.5 rounded-lg text-[10px] transition-colors border border-red-200 ml-1"
                          title="Delete rating feedback"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {rev.comment && <p className="text-slate-600 italic font-medium">"{rev.comment}"</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* MAP CONTAINER */}
        <div className="flex-grow bg-white shadow-sm rounded-2xl border border-slate-200 overflow-hidden min-h-[500px] relative">
          <style>{`
            .leaflet-popup-content-wrapper {
              background: #0f172a !important;
              color: #ffffff !important;
              border-radius: 1rem !important;
              padding: 0.25rem !important;
              box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.3) !important;
              border: 1px solid #334155 !important;
            }
            .leaflet-popup-tip {
              background: #0f172a !important;
              border: 1px solid #334155 !important;
            }
            .leaflet-popup-content {
              margin: 14px 18px !important;
              line-height: 1.5 !important;
            }
            .leaflet-container a.leaflet-popup-close-button {
              color: #94a3b8 !important;
              padding: 8px !important;
            }
            .leaflet-container a.leaflet-popup-close-button:hover {
              color: #ffffff !important;
            }
          `}</style>

          <MapContainer
            center={driverLocation}
            zoom={12}
            scrollWheelZoom={true}
            className="w-full h-full absolute inset-0 z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {driverLocation && <MapRecenter center={driverLocation} />}

            {activeDrivers
              .filter((driver) => driver.latitude && driver.longitude)
              .map((driver) => (
                <Marker
                  key={driver.id}
                  position={[parseFloat(driver.latitude), parseFloat(driver.longitude)]}
                  icon={jeepneyIcon}
                >
                  <Popup>
                    <div className="text-sm flex flex-col gap-1.5">
                      <p className="font-bold text-white text-base tracking-tight flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#0d9488] animate-pulse"></span>
                        {driver.users?.email || "Jeepney Unit"}
                      </p>
                      <div className="border-t border-slate-700/80 pt-1.5 mt-0.5 flex flex-col gap-1">
                        <p className="text-slate-300 text-xs">License: <strong className="text-white">{driver.licensenumber || "N/A"}</strong></p>
                        <p className="text-[#b87a63] text-xs font-semibold">Active Transit Unit</p>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default DriverDashboard;