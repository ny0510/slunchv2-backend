import { Elysia, error, t } from 'elysia';
import { getUser } from '../libraries/user';
import Path from 'path';
import Fs from 'fs/promises';

const UPLOAD_DIR = Path.join(__dirname, '../..', 'uploads');

// 디렉토리 확인 후 생성
async function ensureUploadDir() {
  try {
    await Fs.access(UPLOAD_DIR);
  } catch {
    await Fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

// Base64 데이터에서 MIME 타입 및 데이터 추출
function parseBase64(base64: string) {
  const match = base64.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/);
  if (!match) throw error(400, { message: '올바른 Base64 이미지가 아닙니다.' });

  const mimeType = match[1]; // ex) image/jpeg
  const extension = match[2]; // ex) jpeg
  const data = match[3]; // 실제 Base64 데이터

  return { mimeType, extension, data };
}

const app = new Elysia({ prefix: '/pfp', tags: ['파일 업로드'] })
  .get(
    '/',
    async ({ headers }) => {
      const { token } = headers;
      if (!token) throw error(400, { message: '토큰을 입력해주세요.' });

      let userid: string;
      try {
        userid = await getUser(token);
      } catch (e) {
        throw error(401, { message: '토큰이 유효하지 않습니다.' });
      }

      // 지원하는 확장자 목록
      const extensions = ['jpg', 'jpeg', 'png', 'webp'];
      let filePath: string | null = null;

      // 저장된 이미지 찾기
      for (const ext of extensions) {
        const potentialPath = Path.join(UPLOAD_DIR, `${userid}.${ext}`);
        try {
          await Fs.access(potentialPath);
          filePath = potentialPath;
          break;
        } catch {} // 파일이 없으면 무시하고 다음 확장자 확인
      }

      if (!filePath) throw error(404, { message: '프로필 사진이 없습니다.' });

      const buffer = await Fs.readFile(filePath);
      const ext = Path.extname(filePath).slice(1);
      const base64Image = `data:image/${ext};base64,${buffer.toString('base64')}`;

      return { image: base64Image };
    },
    {
      headers: t.Object({
        token: t.String({ description: '구글 OAuth 토큰' }),
      }),
      response: {
        200: t.Object({ image: t.String() }),
        400: t.Object({ message: t.String() }),
        401: t.Object({ message: t.String() }),
        404: t.Object({ message: t.String() }),
      },
      detail: { summary: '프로필 사진 가져오기' },
    }
  )
  .post(
    '/',
    async ({ headers, body }) => {
      const { token } = headers;
      const { image } = body;
      if (!token) throw error(400, { message: '토큰을 입력해주세요.' });
      if (!image) throw error(400, { message: '이미지를 입력해주세요.' });

      let userid: string;
      try {
        userid = await getUser(token);
      } catch (e) {
        throw error(401, { message: '토큰이 유효하지 않습니다.' });
      }

      await ensureUploadDir();

      // Base64에서 MIME 타입, 확장자, 데이터 추출
      const { extension, data } = parseBase64(image);
      const filePath = Path.join(UPLOAD_DIR, `${userid}.${extension}`);

      const buffer = Buffer.from(data, 'base64');

      if (buffer.length > 3 * 1024 * 1024) throw error(400, { message: '이미지가 너무 큽니다.' });

      // 기존 파일 삭제 (같은 유저의 다른 확장자 이미지 삭제)
      const oldFiles = ['jpg', 'jpeg', 'png', 'webp'].map((ext) => Path.join(UPLOAD_DIR, `${userid}.${ext}`));
      for (const file of oldFiles) {
        try {
          await Fs.unlink(file);
        } catch {}
      }

      await Fs.writeFile(filePath, buffer);

      return { message: '성공적으로 업로드되었습니다.' };
    },
    {
      headers: t.Object({
        token: t.String({ description: '구글 OAuth 토큰' }),
      }),
      body: t.Object({
        image: t.String({ description: 'Base64로 인코딩된 이미지' }),
      }),
      response: {
        200: t.Object({ message: t.String() }),
        400: t.Object({ message: t.String() }),
      },
      detail: { summary: '프로필 사진 업로드' },
    }
  );

export default app;
