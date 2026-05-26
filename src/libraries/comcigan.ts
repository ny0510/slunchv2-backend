import { decode, encode } from 'iconv-lite';

const BASE_URL = 'http://comci.net:4082';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const REGEXES = {
  mainRoute: /(?<=\.\/)\d+(?=\?\d+l)/,
  searchRoute: /(?<=\?)\d+(?=l)/,
  timetableRoute: /(?<=')\d+(?=_')/,
  teacherCode: [/(?<=성명=자료\.자료)\d+/, /(?<=Q성명\(자료\.자료)\d+/],
  originalCode: /(?<=원자료=Q자료\(자료\.자료)\d+/,
  dayCode: /(?<=일일자료=Q자료\(자료\.자료)\d+/,
  subjectCode: /(?<=자료\.자료)\d+(?=\[sb\])/,
  whiteSpace: /\0+$/,
};

export enum Weekday {
  Monday = 1,
  Tuesday = 2,
  Wednesday = 3,
  Thursday = 4,
  Friday = 5,
}

export interface Region {
  code: number;
  name: string;
}

export interface SchoolData {
  code: number;
  name: string;
  region: Region;
}

export type Timetable = {
  subject: string;
  teacher: string;
  changed: boolean;
} & ({ changed: true; originalSubject: string; originalTeacher: string } | { changed: false });

type TimetableResult = Timetable | Timetable[] | Timetable[][] | Timetable[][][] | Timetable[][][][];

interface ComciganData {
  mainRoute: string;
  searchRoute: string;
  timetableRoute: string;
  teacherCode: string;
  originalCode: string;
  dayCode: string;
  subjectCode: string;
}

type RawTimetable = number[][][][];
type ParsedResponse = Record<string, unknown>;

export class School {
  code: number;
  name: string;
  region: Region;

  constructor(
    private readonly client: Comcigan,
    data: SchoolData
  ) {
    this.code = data.code;
    this.name = data.name;
    this.region = data.region;
  }

  static async fromName(name: string): Promise<School> {
    const comcigan = new Comcigan();
    const schools = await comcigan.searchSchools(name);
    return schools[0];
  }

  async getTimetable(): Promise<Timetable[][][][]>;
  async getTimetable(nextweek: boolean): Promise<Timetable[][][][]>;
  async getTimetable(grade: number): Promise<Timetable[][][]>;
  async getTimetable(grade: number, nextweek: boolean): Promise<Timetable[][][]>;
  async getTimetable(grade: number, cls: number): Promise<Timetable[][]>;
  async getTimetable(grade: number, cls: number, nextweek: boolean): Promise<Timetable[][]>;
  async getTimetable(grade: number, cls: number, day: Weekday): Promise<Timetable[]>;
  async getTimetable(grade: number, cls: number, day: Weekday, nextweek: boolean): Promise<Timetable[]>;
  async getTimetable(grade: number, cls: number, day: Weekday, period: number): Promise<Timetable>;
  async getTimetable(grade?: number | boolean, cls?: number | boolean, day?: Weekday | boolean, period?: number | boolean): Promise<TimetableResult> {
    const nextweek = typeof grade === 'boolean' ? grade : typeof cls === 'boolean' ? cls : typeof day === 'boolean' ? day : typeof period === 'boolean' ? period : false;

    if (typeof grade !== 'number') return this.client.getTimetable(this.code, nextweek);
    if (typeof cls !== 'number') return this.client.getTimetable(this.code, grade, nextweek);
    if (typeof day !== 'number') return this.client.getTimetable(this.code, grade, cls, nextweek);
    if (typeof period !== 'number') return this.client.getTimetable(this.code, grade, cls, day, nextweek);
    return this.client.getTimetable(this.code, grade, cls, day, period);
  }
}

class DataManager {
  private data: ComciganData | null = null;
  private lastFetchDate = 0;

  async getData(): Promise<ComciganData> {
    if (this.data && this.lastFetchDate === new Date().getDate()) return this.data;

    const bootstrap = await fetchBootstrapText('/st');
    const data = {
      mainRoute: matchRequired(bootstrap, REGEXES.mainRoute, 'Failed to fetch main route'),
      searchRoute: matchRequired(bootstrap, REGEXES.searchRoute, 'Failed to fetch search route'),
      timetableRoute: matchRequired(bootstrap, REGEXES.timetableRoute, 'Failed to fetch timetable route'),
      teacherCode: matchAnyRequired(bootstrap, REGEXES.teacherCode, 'Failed to fetch teacher code'),
      originalCode: matchRequired(bootstrap, REGEXES.originalCode, 'Failed to fetch original code'),
      dayCode: matchRequired(bootstrap, REGEXES.dayCode, 'Failed to fetch day code'),
      subjectCode: matchRequired(bootstrap, REGEXES.subjectCode, 'Failed to fetch subject code'),
    };

    this.lastFetchDate = new Date().getDate();
    this.data = data;
    return data;
  }
}

export default class Comcigan {
  private readonly dataManager = new DataManager();

  async searchSchools(schoolName: string): Promise<School[]> {
    const { mainRoute, searchRoute } = await this.dataManager.getData();
    const res = await fetchText(`/${mainRoute}?${searchRoute}l${encodeEUCKR(schoolName)}`);
    const { 학교검색: data } = parseResponse<{ 학교검색: [number, string, string, number][] }>(res);

    return data.map(([regionCode, regionName, name, schoolCode]) =>
      new School(this, {
        code: schoolCode,
        name,
        region: { code: regionCode, name: regionName },
      })
    );
  }

  private async getRawTimetable(schoolCode: number, nextweek = false): Promise<Timetable[][][][]> {
    const { mainRoute, timetableRoute, teacherCode, originalCode, dayCode, subjectCode } = await this.dataManager.getData();
    const week = nextweek ? 2 : 1;
    const res = await fetchText(`/${mainRoute}_T?${encodeBase64(`${timetableRoute}_${schoolCode}_0_${week}`)}`);
    const data = parseResponse<ParsedResponse>(res);

    const teachers = data[`자료${teacherCode}`] as string[];
    const teachersLen = Math.floor(Math.log10(teachers.length - 1)) + 1;
    const subjects = data[`자료${subjectCode}`] as string[];
    const original = data[`자료${originalCode}`] as RawTimetable;
    const now = data[`자료${dayCode}`] as RawTimetable;

    const getSubject = (code?: number) => {
      if (!code) return '없음';

      const subject = subjects[(code / 10 ** (teachersLen + 1)) | 0];
      return typeof subject === 'string' ? subject : '없음';
    };
    const getTeacher = (code?: number) => {
      if (!code) return '없음';

      const teacher = teachers[code % 10 ** teachersLen];
      return typeof teacher === 'string' ? teacher : '없음';
    };

    return mergeMap(now.slice(1), original.slice(1), (gNow, gOrigin) =>
      mergeMap(gNow.slice(1), gOrigin.slice(1), (cNow, cOrigin) =>
        mergeMap(cNow.slice(1), cOrigin.slice(1), (dNow, dOrigin) =>
          mergeMap(dNow.slice(1), dOrigin.slice(1), (pNow, pOrigin) => {
            const changed = pNow !== pOrigin;
            const subject = getSubject(pNow);
            const teacher = getTeacher(pNow);

            if (!changed) return { subject, teacher, changed };
            return {
              subject,
              teacher,
              changed,
              originalSubject: getSubject(pOrigin),
              originalTeacher: getTeacher(pOrigin),
            };
          })
        )
      )
    );
  }

  async getTimetable(schoolCode: number): Promise<Timetable[][][][]>;
  async getTimetable(schoolCode: number, nextweek: boolean): Promise<Timetable[][][][]>;
  async getTimetable(schoolCode: number, grade: number): Promise<Timetable[][][]>;
  async getTimetable(schoolCode: number, grade: number, nextweek: boolean): Promise<Timetable[][][]>;
  async getTimetable(schoolCode: number, grade: number, cls: number): Promise<Timetable[][]>;
  async getTimetable(schoolCode: number, grade: number, cls: number, nextweek: boolean): Promise<Timetable[][]>;
  async getTimetable(schoolCode: number, grade: number, cls: number, day: Weekday): Promise<Timetable[]>;
  async getTimetable(schoolCode: number, grade: number, cls: number, day: Weekday, nextweek: boolean): Promise<Timetable[]>;
  async getTimetable(schoolCode: number, grade: number, cls: number, day: Weekday, period: number): Promise<Timetable>;
  async getTimetable(schoolCode: number, grade?: number | boolean, cls?: number | boolean, day?: Weekday | boolean, period?: number | boolean): Promise<TimetableResult> {
    const nextweek = typeof grade === 'boolean' ? grade : typeof cls === 'boolean' ? cls : typeof day === 'boolean' ? day : typeof period === 'boolean' ? period : false;
    const raw = await this.getRawTimetable(schoolCode, nextweek);

    if (typeof grade !== 'number') return raw;
    if (typeof cls !== 'number') return raw[grade - 1];
    if (typeof day !== 'number') return raw[grade - 1][cls - 1];
    if (typeof period !== 'number') return raw[grade - 1][cls - 1][day - 1];
    return raw[grade - 1][cls - 1][day - 1][period - 1];
  }
}

async function fetchText(path: string): Promise<string> {
  const response = await request(path);
  return response.text();
}

async function fetchBootstrapText(path: string): Promise<string> {
  const response = await request(path);
  return decode(Buffer.from(await response.arrayBuffer()), 'euc-kr');
}

function request(path: string): Promise<Response> {
  return fetch(new URL(path, BASE_URL), {
    headers: { 'User-Agent': USER_AGENT },
  });
}

function matchRequired(input: string, regex: RegExp, message: string): string {
  const match = regex.exec(input);
  if (!match) throw new Error(message);
  return match[0];
}

function matchAnyRequired(input: string, regexes: RegExp[], message: string): string {
  for (const regex of regexes) {
    const match = regex.exec(input);
    if (match) return match[0];
  }
  throw new Error(message);
}

function parseResponse<T>(str: string): T {
  return JSON.parse(str.replace(REGEXES.whiteSpace, ''));
}

function encodeEUCKR(str: string): string {
  return [...encode(str, 'euc-kr')].map((v) => `%${v.toString(16)}`).join('');
}

function encodeBase64(str: string): string {
  return Buffer.from(str).toString('base64');
}

function mergeMap<T, F>(a: T[], b: T[], callbackFn: (a: T, b: T) => F): F[] {
  const result = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) result.push(callbackFn(a[i], b[i]));
  return result;
}
