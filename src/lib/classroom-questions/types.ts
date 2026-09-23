export type ClassQuestion = {
  id: string;
  offering_id: string;
  body: string;
  visibility: "PRIVATE" | "COURSE";
  created_at: string;
  answer_text: string | null;
  answered_at: string | null;
  author_label: string;
  is_mine: boolean;
};

export type InstructorHomeSummary = {
  offering_id: string;
  learner_count: number;
  ended_sessions: number;
  attendance_records: number;
  unanswered_questions: number;
};
