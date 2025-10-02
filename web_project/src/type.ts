export type LogLevel = "INFO" | "DEBUG" | "WARN" | "ERROR" | "TRACE" | "FATAL" | "UNKNOWN";

export type Filters = {
  q: string;
  level: string;
  section: string;
  from: string;
  to: string;
  wantReq: boolean;     
  wantRes: boolean;     
  unreadOnly: boolean;  
};