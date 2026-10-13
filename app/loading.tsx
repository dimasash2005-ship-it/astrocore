// Shown while a page is loading. It fades in after a short delay,
// so quick page switches don't flash it.

import CosmosLoader from "@/components/cosmos/CosmosLoader"

export default function Loading() {
  return <CosmosLoader fullscreen={false} delay={280} />
}
