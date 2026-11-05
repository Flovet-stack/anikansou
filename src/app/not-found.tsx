import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">
        This page doesn&apos;t exist.{" "}
        <Link href="/" className="underline underline-offset-4">
          Go home
        </Link>
      </p>
    </>
  );
}
