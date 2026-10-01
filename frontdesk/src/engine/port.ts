// The engine is Paperclip: ORBIT creates issues for Scout and Orbi, then polls their comments.
export interface EnginePort {
  createIssue(args: { assignee: 'scout' | 'orbi'; title: string; body: string }): Promise<{ issueId: string }>;
  // Oldest first. The draft poll relies on this order to pick the newest valid draft; any client must honour it.
  comments(issueId: string): Promise<string[]>;
  comment(issueId: string, text: string): Promise<void>;
}
