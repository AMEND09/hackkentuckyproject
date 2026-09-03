import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { api } from "../src/api/client";

export default function Index() {
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    api
      .get("/auth/me/")
      .then((r) => {
        const role = r.data.role;
        setTarget(role === "guardian" ? "/guardian" : role === "driver" ? "/driver" : "/login");
      })
      .catch(() => setTarget("/login"));
  }, []);
  if (!target) return null;
  return <Redirect href={target} />;
}
