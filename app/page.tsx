"use client";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export default function HomePage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();

  const handleGetStarted = () => {
    if (isSignedIn) {
      router.push("/welcome");
    } else {
      router.push("/auth");
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="w-full max-w-sm bg-white p-6 rounded-lg shadow-md text-center">
        <div className="text-2xl font-bold mb-2">🍂 VitaFin</div>
        <div className="text-lg font-semibold mb-1">Manage your money with ease</div>
        <p className="text-gray-500 mb-6">
          Simple budgeting, smart insights, and total control of your expenses.
        </p>

        <button
          onClick={handleGetStarted}
          className="bg-orange-400 text-white py-2 px-4 rounded w-full hover:bg-orange-500"
        >
          Get Started
        </button>

        {isLoaded && isSignedIn && (
          <p className="mt-4 text-sm text-green-700">
            You’re already signed in as <span className="font-semibold">{user?.primaryEmailAddress?.emailAddress}</span>
          </p>
        )}

        <p className="text-xs text-gray-500 mt-6">
          By continuing, you agree to our{" "}
          <a href="#" className="underline">Terms of Service</a> and{" "}
          <a href="#" className="underline">Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}
