export type SourceStatus = "live" | "fallback" | "cache" | "error";

export type TeamSide = {
  id?: number;
  name: string;
  logo?: string;
};

export type MatchScore = {
  home: number | null;
  away: number | null;
  halftime?: string;
  fulltime?: string;
  penalty?: string;
  display: string;
};

export type MatchVenue = {
  id?: number;
  name?: string;
  city?: string;
};

export type MatchEvent = {
  minute: number | null;
  extraMinute?: number | null;
  team: string;
  player?: string;
  assist?: string;
  type: string;
  detail: string;
  comment?: string;
};

export type MatchStatistic = {
  team: string;
  values: Array<{
    type: string;
    value: string | number | null;
  }>;
};

export type WorldCupMatch = {
  id: string;
  sportType: "football";
  competition: string;
  season: number;
  round: string;
  group?: string;
  kickoffTime: string;
  status: "scheduled" | "live" | "finished" | "postponed" | "cancelled" | "unknown";
  statusText: string;
  homeTeam: TeamSide;
  awayTeam: TeamSide;
  score: MatchScore;
  venue: MatchVenue;
  events: MatchEvent[];
  statistics: MatchStatistic[];
  source: {
    provider: "sportmonks" | "api-football" | "worldcup26-free" | "thestatsapi-fixtures" | "mock";
    league: number;
    season: number;
  };
  lastUpdated: string;
};

export type WorldCupPayload<T> = {
  sourceStatus: SourceStatus;
  data: T;
  lastUpdated: string;
  message?: string;
};

export type ApiFootballFixture = {
  fixture?: {
    id?: number;
    date?: string;
    timestamp?: number;
    status?: {
      long?: string;
      short?: string;
      elapsed?: number | null;
    };
    venue?: {
      id?: number;
      name?: string;
      city?: string;
    };
  };
  league?: {
    id?: number;
    name?: string;
    season?: number;
    round?: string;
  };
  teams?: {
    home?: {
      id?: number;
      name?: string;
      logo?: string;
      winner?: boolean | null;
    };
    away?: {
      id?: number;
      name?: string;
      logo?: string;
      winner?: boolean | null;
    };
  };
  goals?: {
    home?: number | null;
    away?: number | null;
  };
  score?: {
    halftime?: {
      home?: number | null;
      away?: number | null;
    };
    fulltime?: {
      home?: number | null;
      away?: number | null;
    };
    extratime?: {
      home?: number | null;
      away?: number | null;
    };
    penalty?: {
      home?: number | null;
      away?: number | null;
    };
  };
};

export type ApiFootballEvent = {
  time?: {
    elapsed?: number | null;
    extra?: number | null;
  };
  team?: {
    id?: number;
    name?: string;
    logo?: string;
  };
  player?: {
    id?: number;
    name?: string;
  };
  assist?: {
    id?: number;
    name?: string;
  };
  type?: string;
  detail?: string;
  comments?: string;
};

export type ApiFootballStatistic = {
  team?: {
    id?: number;
    name?: string;
    logo?: string;
  };
  statistics?: Array<{
    type?: string;
    value?: string | number | null;
  }>;
};

export type ApiFootballResponse<T> = {
  get?: string;
  parameters?: Record<string, string | number>;
  errors?: unknown;
  results?: number;
  paging?: {
    current?: number;
    total?: number;
  };
  response?: T;
};
