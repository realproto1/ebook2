# 보안 사고 보고서

## 🚨 사고 내용
- **날짜**: 2026-01-16
- **유형**: API 키 유출
- **영향**: Gemini API 키가 GitHub 공개 저장소에 노출

## 📍 발견 경위
- Google이 자동으로 유출된 키 감지
- API 호출 시 403 PERMISSION_DENIED 에러 발생
- 에러 메시지: "Your API key was reported as leaked"

## 🔍 원인 분석
1. **커밋 이력**:
   - `cad250d`: API 키가 코드에 하드코딩됨
   - `1d81fc9`: 하드코딩된 키 제거
   - `c86994b`: README에서 API 키 제거
   
2. **문제점**:
   - Git 히스토리에 API 키가 영구 기록됨
   - GitHub 공개 저장소에 노출
   - Google 자동 스캔으로 감지 및 차단

## ✅ 조치 사항

### 즉시 조치 (완료)
- [x] 새 API 키 발급
- [x] Vercel 환경 변수 업데이트
- [x] 로컬 .env 파일 업데이트
- [x] 재배포

### 예방 조치 (권장)
- [ ] .gitignore에 .env 포함 확인
- [ ] pre-commit hook으로 민감 정보 검사
- [ ] API 키를 환경 변수로만 사용
- [ ] 코드 리뷰 시 보안 체크

### 장기 조치 (선택)
- [ ] Git 히스토리에서 민감 정보 완전 제거 (git filter-repo)
- [ ] 저장소를 private으로 전환 고려
- [ ] Secrets 스캐닝 도구 활용 (GitHub Secret Scanning)

## 📚 교훈

### ❌ 절대 하지 말아야 할 것
1. API 키를 코드에 하드코딩
2. API 키를 커밋 메시지에 포함
3. API 키를 README나 문서에 예시로 포함
4. .env 파일을 Git에 커밋

### ✅ 반드시 해야 할 것
1. .env 파일 사용 + .gitignore에 추가
2. 환경 변수로만 API 키 관리
3. .env.example로 템플릿만 제공
4. 배포 플랫폼의 환경 변수 기능 사용
5. 유출 시 즉시 키 재발급

## 🔗 참고 자료
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [Git 히스토리에서 민감 정보 제거](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [환경 변수 모범 사례](https://12factor.net/config)

---

**작성자**: DevOps Team  
**마지막 업데이트**: 2026-01-16
