import { FreeLeafletMap } from './FreeLeafletMap';

export function EmergencyMap({ sessionId }: { sessionId: string }) {
  return <FreeLeafletMap sessionId={sessionId} mode="view" />;
}