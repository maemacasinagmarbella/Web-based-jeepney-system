import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../supabaseClient";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const BUENAVISTALEGAZPI = [13.1392, 123.7438];

const FARE_MATRIX = [
  { destination: "TAYSAN - CENTRO/DELTA", albayReg: "20.00", terminalReg: "30.00" },
  { destination: "HOMAPON/AGNA", albayReg: "30.00", terminalReg: "32.00" },
  { destination: "KAPANTARAN", albayReg: "33.00", terminalReg: "34.00" },
  { destination: "IMALNOD", albayReg: "35.00", terminalReg: "36.00" },
  { destination: "KM.16", albayReg: "37.00", terminalReg: "38.00" },
  { destination: "CENTRO BANQUEROHAN", albayReg: "41.00", terminalReg: "42.00" },
  { destination: "RESETTLEMENT / DON BOSCO / KM.19", albayReg: "43.00", terminalReg: "44.00" },
  { destination: "KM.21", albayReg: "47.00", terminalReg: "48.00" },
  { destination: "SAN FRANCISCO", albayReg: "55.00", terminalReg: "56.00" },
  { destination: "BUENAVISTA", albayReg: "57.00", terminalReg: "58.00" },
];

const MapRecenter = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// --- DRIVER FEEDBACK / RATING MODAL FOR PASSENGERS ---
const RateDriverModal = ({ request, onClose, onReviewSubmitted }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from("rental_reviews").insert([
        {
          request_id: request.id,
          driver_id: request.driver_id,
          passenger_id: request.passenger_id,
          rating: Number(rating),
          comment: comment.trim(),
        },
      ]);

      if (error) throw error;

      alert("Thank you for your feedback!");
      if (onReviewSubmitted) onReviewSubmitted();
      onClose();
    } catch (err) {
      alert("Failed to submit feedback: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-[#f8fafc] rounded-2xl shadow-2xl max-w-md w-full p-6 flex flex-col gap-5 border border-slate-200">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <h3 className="text-lg font-bold text-[#0f172a] flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-500 fill-amber-500" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            Rate Your Rental Experience
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold text-xl p-1">×</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-sm">
          <div>
            <p className="font-semibold text-slate-700">Driver Unit:</p>
            <p className="text-slate-500 font-medium">{request.drivers?.users?.email || "Jeepney Unit"}</p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-2">Star Rating (1 to 5):</label>
            <div className="flex gap-2 text-3xl cursor-pointer">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  onClick={() => setRating(star)}
                  className={star <= rating ? "text-amber-400 drop-shadow-sm" : "text-slate-300"}
                >
                  ★
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-2">Comments / Feedback:</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows="3"
              placeholder="How was your trip? (e.g. Friendly driver, on time, clean jeepney)"
              className="w-full border border-slate-300 bg-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#2563eb] focus:outline-none"
            />
          </div>

          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2.5 rounded-xl font-semibold transition-colors"
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#2563eb] hover:bg-blue-700 text-white py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50 shadow-sm"
            >
              {loading ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- RENT JEEPNEY FORM SUB-COMPONENT ---
const RentJeepneyForm = ({ passengerId, sessionUserId, rentalDriversList }) => {
  const [formData, setFormData] = useState({
    driver_id: '',
    pickup_location: '',
    custom_pickup: '',
    destination: '',
    custom_destination: '',
    passenger_count: 1,
    agreed_rate: '',
    isCustomPickup: false,
    isCustomDestination: false,
  });

  const [perPersonRate, setPerPersonRate] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const maxPassengers = 22;

  const computeRate = (destination, pickup, count) => {
    if (destination === 'CUSTOM' || pickup === 'CUSTOM' || !destination || !pickup) return;

    const matchedRow = FARE_MATRIX.find(
      (item) => item.destination.toLowerCase() === destination.toLowerCase()
    );

    if (matchedRow) {
      const isFromAlbay = pickup.toLowerCase().includes('albay');
      const baseRate = parseFloat(isFromAlbay ? matchedRow.albayReg : matchedRow.terminalReg);
      
      setPerPersonRate(baseRate);
      const totalFare = (baseRate * parseInt(count || 1, 10)).toFixed(2);
      
      setFormData((prev) => ({ ...prev, agreed_rate: totalFare }));
    }
  };

  const handlePickupChange = (e) => {
    const selectedPickup = e.target.value;
    const isCustom = selectedPickup === 'CUSTOM';

    if (!isCustom && selectedPickup === formData.destination) {
      setMessage({ type: 'error', text: 'Pickup origin cannot be the same as the destination.' });
      return;
    }

    setFormData((prev) => ({
      ...prev,
      pickup_location: selectedPickup,
      isCustomPickup: isCustom,
      agreed_rate: isCustom ? '' : prev.agreed_rate,
    }));
    setMessage({ type: '', text: '' });

    if (!isCustom && formData.destination && formData.destination !== 'CUSTOM') {
      computeRate(formData.destination, selectedPickup, formData.passenger_count);
    } else {
      setPerPersonRate(0);
    }
  };

  const handleDestinationChange = (e) => {
    const selectedDest = e.target.value;
    const isCustom = selectedDest === 'CUSTOM';

    if (!isCustom && selectedDest === formData.pickup_location) {
      setMessage({ type: 'error', text: 'Destination cannot be the same as the pickup origin.' });
      return;
    }

    setFormData((prev) => ({
      ...prev,
      destination: selectedDest,
      isCustomDestination: isCustom,
      agreed_rate: isCustom ? '' : prev.agreed_rate,
    }));
    setMessage({ type: '', text: '' });

    if (!isCustom && formData.pickup_location && formData.pickup_location !== 'CUSTOM') {
      computeRate(selectedDest, formData.pickup_location, formData.passenger_count);
    } else {
      setPerPersonRate(0);
    }
  };

  const handlePassengerCountChange = (e) => {
    const value = e.target.value;
    if (value === "") {
      setFormData((prev) => ({ ...prev, passenger_count: "" }));
      return;
    }
    const parsedValue = parseInt(value, 10);
    const clampedValue = Math.min(Math.max(parsedValue, 1), maxPassengers);

    setFormData((prev) => ({ ...prev, passenger_count: clampedValue }));

    if (!formData.isCustomPickup && !formData.isCustomDestination && formData.destination && formData.pickup_location) {
      computeRate(formData.destination, formData.pickup_location, clampedValue);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    const finalPickup = formData.isCustomPickup
      ? formData.custom_pickup.trim()
      : formData.pickup_location.trim();

    const finalDestination = formData.isCustomDestination
      ? formData.custom_destination.trim()
      : formData.destination.trim();

    if (!finalPickup) {
      setMessage({ type: 'error', text: 'Please specify your pickup location.' });
      setLoading(false);
      return;
    }

    if (!finalDestination) {
      setMessage({ type: 'error', text: 'Please specify your destination.' });
      setLoading(false);
      return;
    }

    if (finalPickup.toLowerCase() === finalDestination.toLowerCase()) {
      setMessage({ type: 'error', text: 'Pickup origin and destination cannot be identical.' });
      setLoading(false);
      return;
    }

    let activePassengerId = passengerId;

    if (!activePassengerId && sessionUserId) {
      try {
        const { data: existingPassenger } = await supabase
          .from('passengers')
          .select('id')
          .eq('userid', sessionUserId)
          .maybeSingle();

        if (existingPassenger) {
          activePassengerId = existingPassenger.id;
        } else {
          const { data: newPassenger, error: createErr } = await supabase
            .from('passengers')
            .insert([{ userid: sessionUserId }])
            .select('id')
            .single();

          if (createErr) throw createErr;
          activePassengerId = newPassenger.id;
        }
      } catch (err) {
        setMessage({ type: 'error', text: 'Could not resolve passenger profile: ' + err.message });
        setLoading(false);
        return;
      }
    }

    if (!activePassengerId) {
      setMessage({ type: 'error', text: 'Passenger ID missing. Please re-login.' });
      setLoading(false);
      return;
    }

    const passengerDetails = `${formData.passenger_count} pax (1 Jeepney Unit)`;
    
    const payload = {
      passenger_id: activePassengerId,
      pickup_location: `${finalPickup} (${passengerDetails})`,
      destination: finalDestination,
      agreed_rate: formData.agreed_rate ? parseFloat(formData.agreed_rate) : null,
      driver_id: formData.driver_id || null,
      status: 'pending',
    };

    try {
      const { error } = await supabase
        .from('rental_requests')
        .insert([payload]);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Rental request submitted successfully!' });
      setFormData({
        driver_id: '',
        pickup_location: '',
        custom_pickup: '',
        destination: '',
        custom_destination: '',
        passenger_count: 1,
        agreed_rate: '',
        isCustomPickup: false,
        isCustomDestination: false,
      });
      setPerPersonRate(0);
    } catch (err) {
      console.error('Error submitting rental request:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to submit request.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <p className="text-sm text-slate-500 mb-5 leading-relaxed">
        Select pickup origin, destination, and passenger count to auto-calculate your regular rental fare.
      </p>

      {message.text && (
        <div
          className={`p-3.5 mb-4 rounded-xl text-sm font-medium ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Pickup Origin <span className="text-red-500">*</span>
          </label>
          <select
            name="pickup_location"
            value={formData.pickup_location}
            onChange={handlePickupChange}
            required
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2563eb] focus:outline-none bg-white font-medium"
          >
            <option value="">-- Select Pickup Origin --</option>
            <option value="Albay">Albay</option>
            <option value="Legazpi Terminal">Legazpi Terminal</option>
            {FARE_MATRIX.filter((item) => item.destination !== formData.destination).map((item, idx) => (
              <option key={`orig-${idx}`} value={item.destination}>
                {item.destination}
              </option>
            ))}
            <option value="CUSTOM">Other / Unlisted Location (Custom Route)</option>
          </select>
        </div>

        {formData.isCustomPickup && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Enter Custom Pickup Location <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="custom_pickup"
              value={formData.custom_pickup}
              onChange={handleChange}
              required
              placeholder="e.g., Embarcadero de Legazpi"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2563eb] focus:outline-none bg-white font-medium"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Destination <span className="text-red-500">*</span>
          </label>
          <select
            name="destination"
            value={formData.destination}
            onChange={handleDestinationChange}
            required
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2563eb] focus:outline-none bg-white font-medium"
          >
            <option value="">-- Select Destination Route --</option>
            <option value="Albay">Albay</option>
            <option value="Legazpi Terminal">Legazpi Terminal</option>
            {FARE_MATRIX.filter((item) => item.destination !== formData.pickup_location).map((item, idx) => (
              <option key={`dest-${idx}`} value={item.destination}>
                {item.destination}
              </option>
            ))}
            <option value="CUSTOM">Other / Unlisted Location (Custom Route)</option>
          </select>
        </div>

        {formData.isCustomDestination && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Enter Custom Destination <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="custom_destination"
              value={formData.custom_destination}
              onChange={handleChange}
              required
              placeholder="e.g., Lignon Hill Complex, Daraga"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2563eb] focus:outline-none bg-white font-medium"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Total Passengers (Max: {maxPassengers}) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="passenger_count"
            value={formData.passenger_count}
            onChange={handlePassengerCountChange}
            min="1"
            max={maxPassengers}
            required
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2563eb] focus:outline-none bg-white font-medium"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Select Specific Driver <span className="text-xs text-slate-400 font-normal">(Optional)</span>
          </label>
          <select
            name="driver_id"
            value={formData.driver_id}
            onChange={handleChange}
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2563eb] focus:outline-none bg-white font-medium"
          >
            <option value="">-- Any Available Rental Driver --</option>
            {rentalDriversList.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.users?.email || `Driver ID: ${driver.id.slice(0, 6)}`} {driver.rentalrate ? `(₱${driver.rentalrate})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-sm font-semibold text-slate-700">
              Total Proposed Rate (₱)
            </label>
            {perPersonRate > 0 && !formData.isCustomPickup && !formData.isCustomDestination && (
              <span className="text-xs text-[#2563eb] font-semibold">
                (₱{perPersonRate.toFixed(2)} × {formData.passenger_count} pax)
              </span>
            )}
          </div>
          <input
            type="number"
            name="agreed_rate"
            value={formData.agreed_rate}
            onChange={handleChange}
            min="0"
            step="0.01"
            placeholder={
              formData.isCustomPickup || formData.isCustomDestination
                ? "Enter offered rate for custom route"
                : "Auto-calculated fare"
            }
            className={`w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2563eb] focus:outline-none font-bold ${
              formData.isCustomPickup || formData.isCustomDestination
                ? 'bg-white text-slate-800'
                : 'bg-blue-50/50 text-[#2563eb]'
            }`}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#2563eb] hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition duration-200 text-sm disabled:opacity-50 mt-4 shadow-sm"
        >
          {loading ? 'Submitting Request...' : 'Send Rental Request'}
        </button>
      </form>
    </div>
  );
};


const PassengerDashboard = ({ session, profile, roleData, activeDrivers: initialActiveDrivers, jeepneyIcon, onSignOut }) => {
  const [driversList, setDriversList] = useState(initialActiveDrivers || []);
  const [selectedDriverId, setSelectedDriverId] = useState(() => localStorage.getItem("selectedDriverId") || null);
  const [rentalDriversList, setRentalDriversList] = useState([]);
  const [etaMinutes, setEtaMinutes] = useState(null);
  const [distanceKm, setDistanceKm] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModal, setActiveModal] = useState(null);

  // Review System States
  const [userTripHistory, setUserTripHistory] = useState([]);
  const [selectedRequestToRate, setSelectedRequestToRate] = useState(null);

  const [phoneNumber, setPhoneNumber] = useState(roleData?.phonenumber || "");
  const [address, setAddress] = useState(roleData?.address || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const menuRef = useRef(null);
  const profileRef = useRef(null);

  const DESTINATION = BUENAVISTALEGAZPI;
  const AVERAGEJEEPNEYSPEEDKMH = 25;

  const handleSelectDriver = (driverId) => {
    setSelectedDriverId(driverId);
    if (driverId) localStorage.setItem("selectedDriverId", driverId);
    else localStorage.removeItem("selectedDriverId");
  };

  useEffect(() => {
    const fetchRentalDrivers = async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("*, users(email)")
        .eq("isavailableforrental", true);

      if (!error && data) setRentalDriversList(data);
    };
    fetchRentalDrivers();
  }, []);

  const selectedDriver = driversList.find((d) => d.id === selectedDriverId) || driversList[0];

  useEffect(() => {
    if (selectedDriver && selectedDriver.latitude && selectedDriver.longitude) {
      const dist = calculateDistance(
        Number(selectedDriver.latitude),
        Number(selectedDriver.longitude),
        DESTINATION[0],
        DESTINATION[1]
      );
      const timeInMinutes = Math.round((dist / AVERAGEJEEPNEYSPEEDKMH) * 60);
      setDistanceKm(dist.toFixed(2));
      setEtaMinutes(timeInMinutes);
    } else {
      setDistanceKm(null);
      setEtaMinutes(null);
    }
  }, [selectedDriver]);

  // Fetch Passenger's Rental Request History
  const fetchPassengerTripHistory = async () => {
    if (!roleData?.id) return;
    try {
      const { data, error } = await supabase
        .from("rental_requests")
        .select("*, drivers(id, users(email))")
        .eq("passenger_id", roleData.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setUserTripHistory(data);
      }
    } catch (err) {
      console.error("Error fetching passenger trip history:", err);
    }
  };

  // Delete Passenger Trip History Record
  const handleDeleteHistory = async (requestId) => {
    const confirmDelete = window.confirm("Are you sure you want to remove this trip from your history?");
    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from("rental_requests")
        .delete()
        .eq("id", requestId);

      if (error) throw error;

      setUserTripHistory((prev) => prev.filter((trip) => trip.id !== requestId));
    } catch (err) {
      alert("Failed to delete trip record: " + err.message);
    }
  };

  useEffect(() => {
    if (activeModal === 'history') {
      fetchPassengerTripHistory();
    }
  }, [activeModal, roleData?.id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setIsMenuOpen(false);
      if (profileRef.current && !profileRef.current.contains(event.target)) setIsProfileOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (roleData) {
      if (roleData.phonenumber && !phoneNumber) setPhoneNumber(roleData.phonenumber);
      if (roleData.address && !address) setAddress(roleData.address);
    }
  }, [roleData]);

  useEffect(() => {
    if (initialActiveDrivers) setDriversList(initialActiveDrivers);
  }, [initialActiveDrivers]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!session?.user?.id) return;
    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from("passengers")
        .update({ phonenumber: phoneNumber, address: address })
        .eq("userid", session.user.id);

      if (error) throw error;
      alert("Profile updated successfully!");
    } catch (err) {
      alert("Error updating profile: " + err.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="w-full flex flex-col min-h-screen bg-[#f8fafc]">
      {/* NAVBAR */}
      <header className="bg-[#0f172a] border-b border-slate-800 shadow-md px-6 py-4 flex items-center justify-between w-full relative z-40 text-white">
        <div className="flex items-center gap-5 relative" ref={menuRef}>
          <button 
            onClick={() => { setIsMenuOpen(!isMenuOpen); setIsProfileOpen(false); }}
            className="text-slate-200 hover:text-white focus:outline-none p-2.5 rounded-xl hover:bg-slate-800/80 transition-colors border border-slate-700/60"
            title="Menu & Quick Actions"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[#0d9488] animate-pulse"></div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
              {profile?.email || session?.user?.email || "Passenger Account"}
            </h1>
          </div>

          {/* DROPDOWN MENU */}
          {isMenuOpen && (
            <div className="absolute top-16 left-0 w-64 bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl py-3 flex flex-col z-50 text-white">
              <div className="px-5 py-2 border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-widest">
                Quick Actions
              </div>
              <button
                onClick={() => { setActiveModal('fare'); setIsMenuOpen(false); }}
                className="flex items-center gap-4 px-5 py-3.5 text-base text-slate-200 hover:bg-[#2563eb] hover:text-white transition-colors font-medium text-left"
              >
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
                Fare Guidelines
              </button>
              <button
                onClick={() => { setActiveModal('rent'); setIsMenuOpen(false); }}
                className="flex items-center gap-4 px-5 py-3.5 text-base text-slate-200 hover:bg-[#0d9488] hover:text-white transition-colors font-medium text-left"
              >
                <svg className="w-5 h-5 text-[#0d9488]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                Rent Jeepney
              </button>
              <button
                onClick={() => { setActiveModal('history'); setIsMenuOpen(false); }}
                className="flex items-center gap-4 px-5 py-3.5 text-base text-slate-200 hover:bg-[#2563eb] hover:text-white transition-colors font-medium text-left"
              >
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                Trip History
              </button>
            </div>
          )}
        </div>

        {/* SEARCH BAR */}
        <div className="relative hidden md:flex items-center w-1/3">
          <input
            type="text"
            placeholder="Search Destination..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-full py-2.5 pl-5 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] placeholder-slate-400"
          />
          <svg className="w-5 h-5 text-slate-400 absolute right-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>

        {/* PROFILE SECTION */}
        <div className="flex items-center gap-3 relative" ref={profileRef}>
          <button 
            onClick={() => { setIsProfileOpen(!isProfileOpen); setIsMenuOpen(false); }}
            className="bg-slate-800 p-2.5 rounded-full text-slate-200 hover:bg-slate-700 border border-slate-700 flex items-center justify-center transition-colors shadow-sm"
            title="Passenger Profile Settings"
          >
            <div className="bg-[#2563eb] text-white p-1 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </button>

          {isProfileOpen && (
            <div className="absolute top-16 right-0 w-88 bg-white border border-slate-200 rounded-2xl shadow-2xl py-5 px-6 flex flex-col gap-4 z-50 text-sm text-slate-800">
              <div className="border-b border-slate-200 pb-3">
                <p className="font-extrabold text-slate-900 text-lg">{profile?.email || session?.user?.email || "Passenger"}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="bg-blue-100 text-[#2563eb] text-xs font-bold px-2.5 py-0.5 rounded-full">Passenger Account</span>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700 text-xs uppercase tracking-wider">Verified Phone:</label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. 09123456789"
                    className="border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] bg-slate-50 font-medium"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700 text-xs uppercase tracking-wider">Saved Home Address:</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. P-3, Banquerohan"
                    className="border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] bg-slate-50 font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="bg-[#2563eb] hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition-colors text-center text-sm mt-1 shadow-sm"
                >
                  {isSavingProfile ? "Saving Changes..." : "Update Profile"}
                </button>
              </form>

              {onSignOut && (
                <button
                  onClick={() => { setIsProfileOpen(false); onSignOut(); }}
                  className="w-full bg-red-50 hover:bg-red-100 text-red-600 py-2.5 px-4 rounded-xl font-bold transition-colors border border-red-200 text-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                  Sign Out
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="flex flex-col lg:flex-row flex-grow w-full">
        {/* SIDEBAR PANEL */}
        <div className="w-full lg:w-96 bg-[#f8fafc] border-r border-slate-200 p-6 flex flex-col gap-6 shadow-sm">
          <div>
            <h2 className="text-2xl font-black text-[#0f172a]">Welcome, {profile?.email ? profile.email.split('@')[0] : 'Passenger'}!</h2>
            <p className="text-sm text-slate-500 mt-1">Track your daily transit & live jeepneys around Legazpi City.</p>
          </div>

          <div className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0d9488]"></span>
                Live Jeepney Tracker
              </h3>
            </div>

            {selectedDriver ? (
              <div className="bg-blue-50/70 border border-blue-200/80 p-4 rounded-xl text-sm flex flex-col gap-2">
                <p className="font-bold text-[#0f172a] text-base">Tracking: {selectedDriver.users?.email || "Jeepney Unit"}</p>
                <div className="flex justify-between text-slate-700 font-medium">
                  <span>ETA: <strong className="text-[#2563eb]">{etaMinutes !== null ? `${etaMinutes} mins` : "Calculating..."}</strong></span>
                  <span>Distance: <strong className="text-[#2563eb]">{distanceKm !== null ? `${distanceKm} km` : "--"}</strong></span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No active unit selected.</p>
            )}

            {driversList.length > 0 && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Select Active Unit:</label>
                <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto border border-slate-200 rounded-xl p-1.5 bg-slate-50">
                  {driversList.map((drv) => (
                    <button
                      key={drv.id}
                      onClick={() => handleSelectDriver(drv.id)}
                      className={`text-left text-sm p-2.5 rounded-lg transition-colors font-medium ${
                        selectedDriver?.id === drv.id ? "bg-[#2563eb] text-white font-bold shadow-sm" : "hover:bg-slate-200/70 text-slate-700"
                      }`}
                    >
                      {drv.users?.email || `Driver ID: ${drv.id.slice(0, 6)}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MAP CONTAINER */}
        <div className="flex-grow min-h-[500px] lg:min-h-screen relative">
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
            center={
              selectedDriver && selectedDriver.latitude && selectedDriver.longitude
                ? [Number(selectedDriver.latitude), Number(selectedDriver.longitude)]
                : BUENAVISTALEGAZPI
            }
            zoom={14}
            scrollWheelZoom={true}
            className="w-full h-full absolute inset-0 z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {selectedDriver && selectedDriver.latitude && selectedDriver.longitude && (
              <MapRecenter center={[Number(selectedDriver.latitude), Number(selectedDriver.longitude)]} />
            )}
            {driversList
              .filter((driver) => driver.latitude !== null && driver.longitude !== null)
              .map((driver) => (
                <Marker
                  key={driver.id}
                  position={[Number(driver.latitude), Number(driver.longitude)]}
                  icon={jeepneyIcon}
                  eventHandlers={{ click: () => handleSelectDriver(driver.id) }}
                >
                  <Popup>
                    <div className="text-sm flex flex-col gap-1.5">
                      <p className="font-bold text-white text-base tracking-tight flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#0d9488] animate-pulse"></span>
                        {driver.users?.email || "Jeepney Unit"}
                      </p>
                      <div className="border-t border-slate-700/80 pt-1.5 mt-0.5 flex flex-col gap-1">
                        <p className="text-slate-300 text-xs">License: <strong className="text-white">{driver.licensenumber || "N/A"}</strong></p>
                        <p className="text-[#b87a63] text-xs font-semibold">Legazpi Terminal to Buenavista</p>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        </div>
      </div>

      {/* MODALS */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#f8fafc] rounded-2xl shadow-2xl max-w-2xl w-full p-6 flex flex-col gap-5 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3.5">
              <h3 className="text-lg font-extrabold text-[#0f172a] capitalize flex items-center gap-2">
                {activeModal === 'fare' && "Simplified Fare Matrix Guide"}
                {activeModal === 'rent' && "Rent / Charter a Jeepney"}
                {activeModal === 'history' && "Passenger Trip History"}
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-700 font-bold text-2xl p-1">×</button>
            </div>

            <div className="text-sm text-slate-700 max-h-[70vh] overflow-y-auto pr-1">
              {activeModal === 'fare' && (
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-slate-600">Official PUJ Fare Rates across Albay & Legazpi Terminal Routes:</p>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm bg-white">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#0f172a] text-white">
                          <th className="p-3 border border-slate-800" rowSpan="2">PLACE / DESTINATION</th>
                          <th className="p-3 border border-slate-800 text-center" colSpan="2">FROM ALBAY</th>
                          <th className="p-3 border border-slate-800 text-center" colSpan="2">LEGAZPI TERMINAL</th>
                        </tr>
                        <tr className="bg-slate-800 text-white text-[11px]">
                          <th className="p-2 border border-slate-700 text-center">REGULAR</th>
                          <th className="p-2 border border-slate-700 text-center">STUDENT/ELDERLY/PWD</th>
                          <th className="p-2 border border-slate-700 text-center">REGULAR</th>
                          <th className="p-2 border border-slate-700 text-center">STUDENT/ELDERLY/PWD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {FARE_MATRIX.map((row, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                            <td className="p-3 border border-slate-200 font-bold text-slate-900">{row.destination}</td>
                            <td className="p-3 border border-slate-200 text-center font-semibold text-slate-700">₱{row.albayReg}</td>
                            <td className="p-3 border border-slate-200 text-center font-semibold text-[#2563eb] bg-blue-50/50">₱{row.albayDisc}</td>
                            <td className="p-3 border border-slate-200 text-center font-semibold text-slate-700">₱{row.terminalReg}</td>
                            <td className="p-3 border border-slate-200 text-center font-semibold text-[#2563eb] bg-blue-50/50">₱{row.terminalDisc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeModal === 'rent' && (
                <RentJeepneyForm 
                  passengerId={roleData?.id} 
                  sessionUserId={session?.user?.id}
                  rentalDriversList={rentalDriversList} 
                />
              )}

              {activeModal === 'history' && (
                <div className="flex flex-col gap-4">
                  <p className="font-semibold text-slate-700 text-base">Your Recent Commute & Rental History:</p>
                  
                  {userTripHistory.length === 0 ? (
                    <p className="text-slate-400 italic py-6 text-center">No rental history found.</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {userTripHistory.map((trip) => (
                        <div key={trip.id} className="border border-slate-200 rounded-2xl p-4 bg-white shadow-sm flex flex-col gap-3">
                          <div className="flex justify-between items-start border-b border-slate-100 pb-2.5 text-xs">
                            <div>
                              <p className="font-bold text-slate-900 text-sm">
                                {trip.pickup_location} → {trip.destination}
                              </p>
                              <p className="text-slate-500 mt-0.5">
                                Driver: <strong className="text-slate-700">{trip.drivers?.users?.email || "Any Available Unit"}</strong>
                              </p>
                            </div>
                            <span
                              className={`font-extrabold uppercase px-3 py-1 rounded-full text-xs tracking-wide ${
                                trip.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : trip.status === 'accepted'
                                  ? 'bg-blue-100 text-[#2563eb]'
                                  : trip.status === 'pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {trip.status}
                            </span>
                          </div>

                          <div className="flex justify-between items-center pt-1">
                            {trip.agreed_rate ? (
                              <span className="font-bold text-[#0f172a] text-sm">
                                Rate: ₱{parseFloat(trip.agreed_rate).toFixed(2)}
                              </span>
                            ) : (
                              <span></span>
                            )}

                            <div className="flex items-center gap-2">
                              {trip.status === 'completed' && trip.driver_id && (
                                <button
                                  onClick={() => setSelectedRequestToRate(trip)}
                                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-colors flex items-center gap-1 shadow-sm"
                                >
                                  ⭐ Rate Driver
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteHistory(trip.id)}
                                className="bg-red-50 hover:bg-red-100 text-red-600 font-semibold px-3 py-1.5 rounded-xl text-xs transition-colors border border-red-200"
                                title="Delete record"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-4 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm px-6 py-2.5 rounded-xl font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RATING MODAL */}
      {selectedRequestToRate && (
        <RateDriverModal
          request={selectedRequestToRate}
          onClose={() => setSelectedRequestToRate(null)}
          onReviewSubmitted={() => fetchPassengerTripHistory()}
        />
      )}
    </div>
  );
};

export default PassengerDashboard;