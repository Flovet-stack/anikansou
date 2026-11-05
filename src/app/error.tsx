"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold">
        Something went wrong
      </h1>
      <Button className="mt-4" onClick={() => retry()}>
        Try again
      </Button>
    </>
  );
}
