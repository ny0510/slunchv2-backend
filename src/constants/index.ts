export const ALLERGY_TYPES: Record<number, string> = {
  1: '난류',
  2: '우유',
  3: '메밀',
  4: '땅콩',
  5: '대두',
  6: '밀',
  7: '고등어',
  8: '게',
  9: '새우',
  10: '돼지고기',
  11: '복숭아',
  12: '토마토',
  13: '아황산류',
  14: '호두',
  15: '닭고기',
  16: '쇠고기',
  17: '오징어',
  18: '조개류(굴, 전복, 홍합 포함)',
  19: '잣',
};

export const ERROR_MESSAGES = {
  SCHOOL_NAME_REQUIRED: '학교 이름을 입력해주세요.',
  SCHOOL_CODE_REQUIRED: '학교 코드를 입력해주세요.',
  REGION_CODE_REQUIRED: '지역 코드를 입력해주세요.',
  YEAR_REQUIRED: '년도를 입력해주세요.',
  MONTH_REQUIRED: '월을 입력해주세요.',
  GRADE_REQUIRED: '학년을 입력해주세요.',
  CLASS_REQUIRED: '반을 입력해주세요.',
  TOKEN_REQUIRED: '토큰을 입력해주세요.',
  TITLE_REQUIRED: '제목을 입력해주세요.',
  CONTENT_REQUIRED: '내용을 입력해주세요.',
  DATE_REQUIRED: '날짜를 입력해주세요.',
  ID_REQUIRED: 'ID를 입력해주세요.',
  TIME_REQUIRED: '알림 시간을 입력해주세요.',

  NO_DATA: '해당하는 데이터가 없습니다.',
  SCHOOL_NOT_FOUND: '학교를 찾을 수 없어요.',
  TIMETABLE_NOT_FOUND: '시간표를 찾을 수 없어요.',
  TOKEN_NOT_FOUND: '토큰을 찾을 수 없어요.',
  TOKEN_ALREADY_EXISTS: '이미 존재하는 토큰이에요.',
  UNKNOWN_ERROR: '알 수 없는 오류가 발생했어요.',

  UNAUTHORIZED: '권한이 없습니다.',
  INVALID_TIME_HOUR: '시간은 0~23 사이여야 해요.',
  INVALID_TIME_MINUTE: '분은 0~59 사이여야 해요.',

  ALL_NOTIFICATIONS_DELETED: '모든 공지가 삭제되었어요.',
  TOKEN_DELETED: '토큰이 삭제되었어요.',
  NOTIFICATION_DELETED: (id: string) => `공지 ${id}가 삭제되었어요.`,
} as const;

export const SUS_VIDEOS = ['FlUKCD2G0N0', 'jjDL_zySJv4', 'a8uyilHatBA', 'Jn8gHsEuULY'] as const;

export const DB_COLLECTIONS = {
  MEAL: 'meal',
  SCHOOL: 'school',
  SCHOOL_INFORMATION: 'schoolInformation',
  SCHEDULE: 'schedule',
  FCM: 'fcm',
  FCM_MEAL: 'fcm_meal',
  FCM_TIMETABLE: 'fcm_timetable',
  FCM_KEYWORD: 'fcm_keyword',
  NOTIFICATIONS: 'notifications',
} as const;

export const API_CONFIG = {
  RATE_LIMIT: {
    MAX_REQUESTS: 100,
    DURATION_MS: 60 * 1000,
  },
  DEFAULT_PORT: 3000,
  LOGS_DIR: 'logs',
} as const;
