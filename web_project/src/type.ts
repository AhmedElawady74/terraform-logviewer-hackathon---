// web_project/src/type.ts
export interface LogItem {
  id: number;
  ts?: string;                 // ISO timestamp
  level?: string;              // ERROR/WARN/INFO/DEBUG/TRACE
  section?: string;            // core/provider/plan/apply/...
  summary?: string;            // short text or JSON string
  is_read: boolean;            // read/unread flag
  has_req_body?: boolean;      // request body exists
  has_res_body?: boolean;      // response body exists
  tf_req_id?: string | null;   // correlation id if available
}