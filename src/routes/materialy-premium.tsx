import { createFileRoute, redirect } from "@tanstack/react-router";

// Former standalone premium page: now the unified library catalogue with the Premium filter on.
export const Route = createFileRoute("/materialy-premium")({
  beforeLoad: () => { throw redirect({ to: "/biblioteka", search: { dostep: "premium" }, statusCode: 301 }); },
});
