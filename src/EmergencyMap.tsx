import { MapboxMap } from './MapboxMap';
import { Id } from "../convex/_generated/dataModel";

export function EmergencyMap({ sessionId }: { sessionId: Id<"sessions"> }) {
  return <MapboxMap sessionId={sessionId} mode="view" />;
}