import { createFileRoute, redirect } from "@tanstack/react-router";

import { NoActiveThreadState } from "../components/NoActiveThreadState";

export function ChatIndexRouteView() {
  return <NoActiveThreadState />;
}

export const Route = createFileRoute("/_chat/")({
  beforeLoad: () => {
    throw redirect({ to: "/nilus", replace: true });
  },
  component: ChatIndexRouteView,
});
