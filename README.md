# 동화책 자동 생성기 v12.0

AI 기반 유아 교육용 동화책 자동 생성 플랫폼

## 📖 프로젝트 개요

**동화책 자동 생성기**는 Gemini 2.5 Flash AI를 활용하여 맞춤형 동화책을 자동으로 생성하는 웹 애플리케이션입니다. 캐릭터 일관성을 유지하면서 고품질의 삽화와 교육적 콘텐츠를 제공합니다.

## 🌟 주요 기능

### 1. AI 동화책 생성
- **자동 스토리 생성**: Gemini 2.5 Flash 기반 창의적인 동화 스토리
- **연령별 맞춤 콘텐츠**: 4-5세, 5-7세, 7-8세 연령대별 최적화
- **10-12페이지 분량**: 적절한 분량의 완성도 높은 동화책
- **7가지 그림체 프리셋**: 현대 일러스트, 수채화, 카툰, 전통 동화책, 애니메이션, 유화, 연필 스케치
- **커스텀 그림체**: 직접 입력으로 원하는 스타일 지정 (예: Pixar style 3D animation)

### 2. 캐릭터 레퍼런스 시스템
- **멀티모달 이미지 참조**: Gemini 2.5 Flash Image로 일관된 캐릭터 생성
- **캐릭터 관리**: 이름 편집, 추가, 삭제 기능
- **프롬프트 커스터마이징**: 각 캐릭터별 프롬프트 수정 가능
- **다중 뷰 레퍼런스**: 정면, 측면, 3/4 뷰 + 3가지 표정

### 3. 페이지 삽화 생성
- **캐릭터 일관성 보장**: 레퍼런스 이미지를 직접 참조하여 100% 일관성 유지
- **구조화된 장면 설명**: 캐릭터&행동, 배경, 분위기로 세분화
- **텍스트 편집 가능**: 모든 페이지 텍스트 실시간 수정
- **배치 생성**: 모든 페이지 삽화를 한 번에 생성

### 4. 이미지 생성 설정
- **이미지 비율**: 1:1, 4:3, 16:9, 3:4, 9:16 선택
- **텍스트 제거 강조**: CRITICAL NO TEXT 옵션
- **캐릭터 일관성 강조**: PIXEL-PERFECT 정확도 옵션
- **추가 프롬프트**: 자유로운 스타일 커스터마이징
- **이미지 품질**: 표준/고품질 선택

### 5. 교육 콘텐츠 (영어 단어 학습)
- **단어 이름 수정**: 각 단어를 클릭하여 편집 가능
- **개별 이미지 생성**: 각 단어마다 개별 생성/재생성
- **배치 생성**: 모든 단어 이미지 한 번에 생성
- **개별 다운로드**: 각 단어 이미지 개별 저장
- **배치 다운로드**: 모든 단어 이미지 한 번에 다운로드
- **8개 영어 단어**: 시각화 학습 지원

### 6. 다운로드 기능
- **전체 텍스트 다운로드**: .txt 형식으로 모든 페이지 저장
- **전체 삽화 다운로드**: 모든 페이지 이미지 일괄 다운로드
- **개별 다운로드**: 캐릭터/삽화/단어 이미지 개별 저장

## 🛠️ 기술 스택

### Backend
- **Node.js** + **Express**: RESTful API 서버
- **Gemini 2.5 Flash**: 스토리 생성 AI
- **Gemini 2.5 Flash Image (Nano Banana Pro)**: 이미지 생성 AI

### Frontend
- **HTML5** + **TailwindCSS**: 반응형 UI
- **Vanilla JavaScript**: 동적 인터랙션
- **Axios**: HTTP 클라이언트
- **LocalStorage**: 클라이언트 데이터 영속성

### DevOps
- **PM2**: 프로세스 관리
- **Git**: 버전 관리

## 📦 설치 및 실행

### 요구사항
- Node.js 18 이상
- npm 또는 yarn
- **Gemini API 키** (필수)

### API 키 발급

1. **Gemini API 키 발급**: https://makersuite.google.com/app/apikey
2. "Create API Key" 클릭
3. 생성된 API 키 복사

### 설치

```bash
# 저장소 클론
git clone https://github.com/realproto1/ebook2.git
cd ebook2

# 의존성 설치
npm install

# .env 파일 생성
cp .env.example .env

# .env 파일 편집하여 API 키 입력
# GEMINI_API_KEY=your_actual_api_key_here
```

### 개발 서버 실행

```bash
# 방법 1: 직접 실행
npm start

# 방법 2: PM2 사용 (권장)
pm2 start ecosystem.config.cjs
```

서버는 `http://localhost:3000`에서 실행됩니다.

### ⚠️ 중요 보안 주의사항

- **절대 API 키를 Git에 커밋하지 마세요**
- `.env` 파일은 `.gitignore`에 포함되어 있습니다
- API 키가 유출되면 즉시 새 키를 발급받으세요
- 프로덕션 환경에서는 환경 변수로 API 키를 설정하세요

## 🎯 사용 방법

### 1. 동화책 생성
1. "새 동화책 만들기" 클릭
2. 제목, 타겟 연령, 그림체 선택
3. "동화책 생성하기" 버튼 클릭
4. AI가 스토리, 캐릭터, 페이지를 자동 생성 (약 30초)

### 2. 이미지 설정 조정 (선택사항)
1. 오른쪽 상단 "설정" 버튼 클릭
2. 이미지 비율, 텍스트 제거, 캐릭터 일관성 등 조정
3. "저장" 클릭 (LocalStorage에 자동 저장)

### 3. 캐릭터 레퍼런스 생성
1. 각 캐릭터의 프롬프트 확인 및 수정 (선택사항)
2. "모든 레퍼런스 생성" 클릭 (또는 개별 생성)
3. 생성된 레퍼런스 이미지 확인 및 다운로드

### 4. 페이지 삽화 생성
1. 각 페이지의 텍스트 및 장면 설명 확인/수정
2. "모든 삽화 생성" 클릭 (또는 개별 생성)
3. 생성된 삽화 확인 및 다운로드

### 5. 다운로드
- **전체 텍스트**: 모든 페이지 텍스트를 .txt 파일로 저장
- **전체 삽화**: 모든 페이지 이미지를 PNG로 일괄 다운로드
- **개별 이미지**: 각 캐릭터/삽화/단어 이미지 개별 다운로드

## 🎨 주요 개선사항 (v12.0)

| 항목 | 이전 버전 | v12.0 |
|------|----------|-------|
| 캐릭터 일관성 | 텍스트 설명 기반 (70% 일관성) | 멀티모달 이미지 참조 (100% 일관성) |
| 장면 설명 | 단순 영어 설명 | 구조화된 한글 설명 (캐릭터/배경/분위기) |
| 텍스트 편집 | 불가능 | 모든 페이지 텍스트 수정 가능 |
| 캐릭터 관리 | 고정 | 이름 편집, 추가, 삭제 가능 |
| 이미지 설정 | 고정 | 5가지 비율, 텍스트/일관성 강조, 커스텀 프롬프트 |
| 배치 생성 | 없음 | 모든 레퍼런스/삽화 한 번에 생성 |
| 다운로드 | 없음 | 개별 및 전체 다운로드 지원 |

## 📊 프로젝트 구조

```
webapp/
├── server.js              # Express 서버 + AI API
├── package.json           # 프로젝트 메타데이터
├── ecosystem.config.cjs   # PM2 설정
├── .gitignore            # Git 제외 파일
├── README.md             # 프로젝트 문서 (이 파일)
└── public/
    ├── index.html        # 프론트엔드 HTML
    └── app.js            # 프론트엔드 JavaScript
```

## 🔧 API 엔드포인트

### POST /api/generate-storybook
동화책 스토리 생성
```json
{
  "title": "용감한 토끼의 모험",
  "targetAge": "5-7",
  "artStyle": "Modern Illustration"
}
```

### POST /api/generate-character-image
캐릭터 레퍼런스 이미지 생성
```json
{
  "character": {
    "name": "토끼",
    "description": "A brave white rabbit..."
  },
  "artStyle": "Modern Illustration",
  "settings": { "aspectRatio": "16:9", "enforceNoText": true }
}
```

### POST /api/generate-illustration
페이지 삽화 생성
```json
{
  "page": {
    "scene_description": "A rabbit in the forest",
    "scene_structure": {
      "characters": "토끼가 당근을 발견함",
      "background": "초록 숲속",
      "atmosphere": "밝고 즐거운"
    }
  },
  "artStyle": "Modern Illustration",
  "characterReferences": [...],
  "settings": { ... }
}
```

### POST /api/generate-vocabulary-images
단어 학습 이미지 생성
```json
{
  "vocabulary": ["apple", "tree", "friend", ...],
  "artStyle": "Modern Illustration",
  "settings": { ... }
}
```

## 🌐 데모

- **Vercel 프로덕션**: https://ebook2.vercel.app (배포 예정)
- **GitHub**: https://github.com/realproto1/ebook2

## ⚠️ 중요 안내

### LocalStorage 용량 제한
- 브라우저 LocalStorage는 5-10MB 제한이 있습니다
- **이미지는 저장되지 않습니다** (메타데이터만 저장)
- 각 세션에서 이미지를 다시 생성해야 합니다
- 또는 "다운로드" 기능으로 이미지를 로컬에 저장하세요

### LocalStorage 초과 시 해결 방법
브라우저 개발자 도구(F12)에서:
```javascript
localStorage.clear()
location.reload()
```

## 🚀 배포

### Vercel 배포 (권장)

#### 1. Vercel에 프로젝트 임포트
1. https://vercel.com 접속
2. GitHub 계정으로 로그인
3. "Import Project" → `ebook2` 저장소 선택
4. "Deploy" 클릭

#### 2. 환경 변수 설정 (중요!)
배포 전 또는 후에 환경 변수를 설정해야 합니다:

**Vercel Dashboard에서:**
1. 프로젝트 선택 → "Settings" → "Environment Variables"
2. 다음 변수 추가:
   - **Name**: `GEMINI_API_KEY`
   - **Value**: `YOUR_GEMINI_API_KEY_HERE` (https://makersuite.google.com/app/apikey에서 발급)
   - **Environment**: Production, Preview, Development 모두 선택
3. "Save" 클릭
4. 프로젝트 재배포 (Deployments → ... → Redeploy)

**⚠️ 중요**: 
- 절대 실제 API 키를 코드나 README에 포함하지 마세요
- API 키는 Vercel 환경 변수로만 설정하세요
- 유출된 키는 즉시 재발급 받으세요

#### 3. 배포 완료
- URL: `https://your-project.vercel.app`
- 자동 HTTPS 적용
- GitHub push 시 자동 재배포

### PM2로 로컬 배포
```bash
# PM2 설치 (전역)
npm install -g pm2

# 앱 시작
pm2 start ecosystem.config.cjs

# 상태 확인
pm2 list

# 로그 확인
pm2 logs storybook-generator --nostream

# 재시작
pm2 restart storybook-generator
```

## 📝 라이선스

MIT License

## 👨‍💻 개발자

- **프로젝트 관리**: realproto1
- **AI 엔진**: Google Gemini 2.5 Flash + Gemini 2.5 Flash Image

## 🤝 기여

이슈 및 풀 리퀘스트를 환영합니다!

## 📞 문의

- GitHub Issues: https://github.com/realproto1/ebook2/issues

---

**마지막 업데이트**: 2025-01-15  
**버전**: 12.0.0  
**상태**: ✅ Active
