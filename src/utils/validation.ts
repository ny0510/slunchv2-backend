import { ERROR_MESSAGES } from '../constants';
import { throwBadRequest } from './errors';

export function validateRequired(value: any, errorMessage: string): void {
  if (!value) {
    throwBadRequest(errorMessage);
  }
}

export function validateSchoolParams(schoolCode?: string, regionCode?: string): void {
  validateRequired(schoolCode, ERROR_MESSAGES.SCHOOL_CODE_REQUIRED);
  validateRequired(regionCode, ERROR_MESSAGES.REGION_CODE_REQUIRED);
}

export function validateDateParams(year?: string, month?: string): void {
  validateRequired(year, ERROR_MESSAGES.YEAR_REQUIRED);
  validateRequired(month, ERROR_MESSAGES.MONTH_REQUIRED);
}

export function validateTimeFormat(time: string): void {
  const [hour, minute] = time.split(':').map(Number);

  if (isNaN(hour) || hour < 0 || hour > 23) {
    throwBadRequest(ERROR_MESSAGES.INVALID_TIME_HOUR);
  }

  if (isNaN(minute) || minute < 0 || minute > 59) {
    throwBadRequest(ERROR_MESSAGES.INVALID_TIME_MINUTE);
  }
}

export function formatDate(ymd: string): string {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

export function formatDateForApi(year: string, month: string, day?: string): string {
  return `${year}${month.padStart(2, '0')}${day ? day.padStart(2, '0') : ''}`;
}

export function getCurrentDateFormatted(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

export function getCurrentTimeFormatted(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}