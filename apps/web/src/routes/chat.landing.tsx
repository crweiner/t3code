import { createFileRoute } from "@tanstack/react-router";

import { ChatIndexRouteView } from "./_chat.index";

export const Route = createFileRoute("/chat/landing")({
  component: ChatIndexRouteView,
});
