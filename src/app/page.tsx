import { Suspense } from "react";
import { searchProjects } from "@/lib/actions/projects";
import { HomeClient } from "@/components/home-client";

export default async function Home() {
  const initialProjects = await searchProjects("");
  return (
    <Suspense>
      <HomeClient initialProjects={initialProjects} />
    </Suspense>
  );
}
