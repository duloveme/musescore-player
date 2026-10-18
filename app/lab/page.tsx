import { PracticePlayer } from "@/components/practice-player";

export default function LabPage() {
  return (
    <PracticePlayer
      heading="합성 악보"
      scoreUrl="/fixtures/synthetic-drums.mscz"
      audioUrl="/fixtures/click-track.wav"
      initialSync={[{ id: "lead-in", scoreMs: 0, audioSec: 0.5 }]}
    />
  );
}
