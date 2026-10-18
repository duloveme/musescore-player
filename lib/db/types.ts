export type Song = {
  id: string;
  owner_id: string;
  title: string;
  artist: string;
  difficulty: string;
  tags: string[];
  favorite: boolean;
  last_practiced_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type SongAsset = {
  id: string;
  song_id: string;
  owner_id: string;
  kind: "score" | "audio";
  bucket: string;
  object_path: string;
  byte_size: number;
  mime: string;
  original_name: string;
  version: number;
  status: "uploading" | "ready" | "failed" | "replaced";
  created_at: string;
  updated_at: string;
};

export type SyncPointRow = {
  id: string;
  song_id: string;
  owner_id: string;
  score_asset_id: string | null;
  audio_asset_id: string | null;
  score_ms: number;
  audio_sec: number;
  version: number;
};

export type PracticeLoop = {
  id: string;
  song_id: string;
  owner_id: string;
  name: string;
  start_measure: number;
  end_measure: number;
  score_asset_id: string | null;
};

export type PracticeSettings = {
  song_id: string;
  owner_id: string;
  tempo_ratio: number;
  original_volume: number;
  drum_volume: number;
  metronome_volume: number;
  count_in_volume: number;
  original_enabled: boolean;
  drum_enabled: boolean;
  metronome_enabled: boolean;
  count_in: "0" | "1" | "2";
  count_in_every_loop: boolean;
  measures_per_screen: 2 | 4 | 8;
  last_measure: number;
  last_beat: number;
  visual_offset_ms: number;
  version: number;
  updated_at: string;
};

export const SONG_FILES_BUCKET = "song-files";
