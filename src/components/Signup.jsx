import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserAuth } from "../context/AuthContext";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("passenger");

  // New Profile Fields
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffixName, setSuffixName] = useState("");
  const [age, setAge] = useState("");

  // Role-specific fields
  const [licenseNumber, setLicenseNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { signUpNewUser } = UserAuth();
  const navigate = useNavigate();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Build extraData payload containing personal info and role-specific fields
    let extraData = {
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      suffix_name: suffixName,
      age: parseInt(age, 10) || 0,
    };

    if (role === "driver") {
      extraData.licensenumber = licenseNumber;
      extraData.phonenumber = phoneNumber;
    } else if (role === "passenger") {
      extraData.phonenumber = phoneNumber;
      extraData.address = address;
    }

    try {
      const result = await signUpNewUser(email, password, role, extraData);

      if (result.success) {
        // Successfully registered! Alert user and navigate straight to the Sign In page
        alert("Account created successfully! Please sign in with your new credentials.");
        navigate("/signin");
      } else {
        setError(result.error?.message || "Sign up failed");
      }
    } catch (err) {
      setError("Unexpected error occurred during sign up");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-slate-700">
      <div className="max-w-md w-full mx-auto bg-white p-8 border border-slate-200 rounded-xl shadow-sm">
        
        {/* Header Section */}
        <div className="text-center pb-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Create an account</h2>
          <p className="text-sm text-slate-500 mt-1">
            Already have an account?{" "}
            <Link to="/signin" className="font-semibold text-[#2563eb] hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <form onSubmit={handleSignUp} className="flex flex-col gap-4">
          
          {/* Credentials */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Account Credentials</label>
            <input
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:bg-white transition"
              type="email"
              placeholder="Email address"
              required
            />
            <input
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:bg-white transition mt-2"
              type="password"
              placeholder="Password"
              required
            />
          </div>

          {/* Role Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Select Role</label>
            <select
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:bg-white transition"
              value={role}
            >
              <option value="passenger">Passenger</option>
              <option value="driver">Driver</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Personal Information Fields */}
          <div className="flex flex-col gap-1 pt-2">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Personal Information</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:bg-white transition"
                type="text"
                placeholder="First Name"
                required
              />
              <input
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:bg-white transition"
                type="text"
                placeholder="Last Name"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              <input
                onChange={(e) => setMiddleName(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:bg-white transition"
                type="text"
                placeholder="Middle Name (Opt.)"
              />
              <input
                onChange={(e) => setSuffixName(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:bg-white transition"
                type="text"
                placeholder="Suffix (Jr., III)"
              />
            </div>
            <input
              onChange={(e) => setAge(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:bg-white transition mt-2"
              type="number"
              placeholder="Age"
              min="1"
              required
            />
          </div>

          {/* Conditional Role Inputs */}
          {role === "driver" && (
            <div className="flex flex-col gap-1 pt-2">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Driver Details</label>
              <input
                onChange={(e) => setLicenseNumber(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:bg-white transition"
                type="text"
                placeholder="License Number"
                required
              />
              <input
                value={phoneNumber}
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/\D/g, "");
                  setPhoneNumber(numericValue);
                }}
                onKeyPress={(e) => {
                  if (!/[0-9]/.test(e.key)) {
                    e.preventDefault();
                  }
                }}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:bg-white transition mt-2"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Phone Number (Numbers only)"
                required
              />
            </div>
          )}

          {role === "passenger" && (
            <div className="flex flex-col gap-1 pt-2">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Passenger Details</label>
              <input
                value={phoneNumber}
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/\D/g, "");
                  setPhoneNumber(numericValue);
                }}
                onKeyPress={(e) => {
                  if (!/[0-9]/.test(e.key)) {
                    e.preventDefault();
                  }
                }}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:bg-white transition"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Phone Number"
                required
              />
              <input
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:bg-white transition mt-2"
                type="text"
                placeholder="Complete Address"
                required
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 text-center">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 bg-[#2563eb] hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            {loading ? "Creating account..." : "Sign up"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Signup;