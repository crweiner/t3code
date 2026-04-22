import { createFileRoute } from "@tanstack/react-router";

function NilusTaskDetailRouteView() {
  return null;
}

export const Route = createFileRoute("/nilus/tasks/$taskNumber")({
  component: NilusTaskDetailRouteView,
});
