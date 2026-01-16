# Vercel 배포 가이드

## 📦 배포 준비

### 1. GitHub 저장소 준비
- 프로젝트가 GitHub에 푸시되어 있어야 합니다
- `vercel.json` 파일이 프로젝트 루트에 있어야 합니다

### 2. Vercel 계정 생성
1. https://vercel.com 접속
2. GitHub 계정으로 로그인
3. 저장소 접근 권한 허용

## 🚀 배포 단계

### 1단계: 프로젝트 임포트
1. Vercel 대시보드에서 "Add New..." → "Project" 클릭
2. GitHub 저장소 `ebook2` 선택
3. "Import" 클릭

### 2단계: 프로젝트 설정
**Framework Preset**: 
- Other (Express.js 사용)

**Build Command**: 
- 비워두기 (빌드 불필요)

**Output Directory**: 
- 비워두기

**Install Command**:
- `npm install`

### 3단계: 환경 변수 설정 (매우 중요!)

**Environment Variables 섹션에서:**

1. **GEMINI_API_KEY** 추가:
   ```
   Name: GEMINI_API_KEY
   Value: [당신의 Gemini API 키]
   ```
   - https://makersuite.google.com/app/apikey 에서 발급
   - "Production", "Preview", "Development" 모두 선택

2. **NODE_ENV** 추가 (선택사항):
   ```
   Name: NODE_ENV
   Value: production
   ```

### 4단계: 배포
1. "Deploy" 버튼 클릭
2. 빌드 로그 확인
3. 배포 완료 후 URL 확인 (예: `https://ebook2.vercel.app`)

## 🔍 배포 후 확인

### 성공 확인
1. 배포된 URL 접속
2. 브라우저 개발자 도구(F12) 열기
3. Console 탭 확인
4. 동화책 생성 테스트

### 실패 시 디버깅

#### 403 Error (Forbidden)
**원인**: 환경 변수 `GEMINI_API_KEY`가 설정되지 않음

**해결**:
1. Vercel 대시보드 → 프로젝트 선택
2. "Settings" → "Environment Variables"
3. `GEMINI_API_KEY` 추가 또는 확인
4. "Deployments" → 최신 배포 선택 → "..." → "Redeploy"

#### 500 Error (Internal Server Error)
**원인**: 서버 코드 오류 또는 API 키 문제

**해결**:
1. Vercel 대시보드 → "Deployments" → 최신 배포 선택
2. "View Function Logs" 클릭
3. 에러 메시지 확인
4. 로그에 "GEMINI_API_KEY environment variable is not set" 있으면 환경 변수 재설정

#### 404 Error (Not Found)
**원인**: 라우팅 문제

**해결**:
1. `vercel.json` 파일 확인
2. `routes` 설정이 올바른지 확인

## 🔄 재배포

### 자동 재배포
- GitHub에 `git push` 하면 자동으로 재배포됩니다

### 수동 재배포
1. Vercel 대시보드 → "Deployments"
2. 최신 배포 선택 → "..." → "Redeploy"

## 🛡️ 보안 주의사항

### ⚠️ 절대 하지 말아야 할 것
- ❌ API 키를 코드에 하드코딩
- ❌ API 키를 GitHub에 커밋
- ❌ API 키를 README에 포함
- ❌ API 키를 클라이언트 코드(app.js)에 노출

### ✅ 반드시 해야 할 것
- ✅ API 키는 Vercel 환경 변수로만 설정
- ✅ `.env` 파일은 `.gitignore`에 포함
- ✅ 유출된 API 키는 즉시 재발급

## 📊 환경 변수 우선순위

1. **Production**: 프로덕션 배포에서 사용
2. **Preview**: Pull Request 미리보기에서 사용
3. **Development**: `vercel dev` 로컬 개발 시 사용

**권장**: 세 가지 환경 모두에 동일한 API 키 설정

## 🔗 유용한 링크

- **Vercel 대시보드**: https://vercel.com/dashboard
- **Gemini API 키 발급**: https://makersuite.google.com/app/apikey
- **Vercel 문서**: https://vercel.com/docs
- **프로젝트 GitHub**: https://github.com/realproto1/ebook2

## 📞 지원

배포 문제가 있으면:
1. Vercel 함수 로그 확인
2. GitHub Issues에 문의: https://github.com/realproto1/ebook2/issues

---

**마지막 업데이트**: 2025-01-15
