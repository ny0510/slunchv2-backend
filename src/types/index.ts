export interface Meal {
  date: string;
  meal: MealItem[] | string[];
  type: string;
  origin?: Origin[];
  calorie: string;
  nutrition?: Nutrition[];
  school_code?: string;
  region_code?: string;
}

export interface MealItem {
  food: string;
  allergy: Allergy[];
}

export interface Allergy {
  type: string;
  code: string;
}

export interface Origin {
  food: string;
  origin: string;
}

export interface Nutrition {
  type: string;
  amount: string;
}

export interface Cache extends Meal {
  meal: MealItem[];
  origin: Origin[];
  nutrition: Nutrition[];
  region_code: string;
  school_code: string;
}

export interface SchoolSearchResult {
  schoolName: string;
  schoolCode: string;
  region: string;
  regionCode: string;
}

export interface Notification {
  id: string;
  title: string;
  content: string;
  date: string;
}

export interface MealSubscription {
  token: string;
  time: string;
  schoolCode: string;
  regionCode: string;
}

export interface TimetableSubscription {
  token: string;
  time: string;
  schoolCode: string;
  grade: string;
  class: string;
}

export interface KeywordSubscription {
  token: string;
  keywords: string[];
  time: string;
  schoolCode: string;
  regionCode: string;
}

export interface FcmSubscription {
  token: string;
  time: string;
  schoolCode: string;
  regionCode: string;
}

export interface TimetableItem {
  subject: string;
  teacher: string;
  changed: boolean;
  originalSubject?: string;
  originalTeacher?: string;
}

export interface ErrorResponse {
  message: string;
}