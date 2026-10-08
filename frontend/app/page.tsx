"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FullScreenLoader, homePathFor, useAuth } from "@/lib/auth";

export default function Home() {
  const { user, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated" && user) router.replace(homePathFor(user.role));
    if (status === "unauthenticated") router.replace("/login");
  }, [status, user, router]);

  return <FullScreenLoader />;
}
