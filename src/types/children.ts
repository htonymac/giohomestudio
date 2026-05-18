export interface ChildrenPacingEntry {
  entryId: string;
  type: "story_sentence" | "word_intro" | "letter_spell" | "word_repeat" | "sentence_read" | "pause";
  text: string;
  durationMs: number;
  imageConceptKey: string;
  subtitleHighlightMode: "full" | "word_by_word" | "letter_by_letter" | "none";
  currentWordIndex?: number;
  currentLetterIndex?: number;
  ssmlPause?: number;
}

export interface ChildrenPacingPlan {
  storyId: string;
  mode: "story" | "learning";
  entries: ChildrenPacingEntry[];
  totalDurationMs: number;
  wordList?: string[];
}

export interface ChildrenNarrationTimingEntry {
  entryId: string;
  audioStart: number;   // ms from start of audio
  audioEnd: number;
}
