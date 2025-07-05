import { FreeLeafletMap } from './FreeLeafletMap';
import { Id } from "../convex/_generated/dataModel";

export function EmergencyMap({ sessionId }: { sessionId: Id<"sessions"> }) {
  return <FreeLeafletMap sessionId={sessionId} mode="view" />;
}