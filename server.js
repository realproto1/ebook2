import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// API 키 (환경 변수 필수)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// API 키 체크 (경고만 표시, 서버는 계속 실행)
if (!GEMINI_API_KEY) {
  console.warn('⚠️ WARNING: GEMINI_API_KEY environment variable is not set!');
  console.warn('Please set GEMINI_API_KEY in Vercel Environment Variables.');
  console.warn('Visit: https://makersuite.google.com/app/apikey to get a new API key');
  console.warn('Server will start but API calls will fail until key is set.');
}

// API 키 검증 미들웨어
function requireAPIKey(req, res, next) {
  if (!GEMINI_API_KEY) {
    return res.status(403).json({ 
      success: false,
      error: '⚠️ GEMINI_API_KEY가 설정되지 않았습니다.\n\n' +
             'Vercel Dashboard → Settings → Environment Variables에서\n' +
             'GEMINI_API_KEY를 추가하고 재배포해주세요.\n\n' +
             'API 키 발급: https://makersuite.google.com/app/apikey'
    });
  }
  next();
}


// Gemini 이미지 생성 함수 (Nano Banana Pro) - 멀티모달 지원 + 자동 재시도
async function generateImage(prompt, referenceImages = [], retryCount = 0, maxRetries = 3) {
  try {
    console.log(`Calling Gemini Image Generation API (Attempt ${retryCount + 1}/${maxRetries})...`);
    console.log('Prompt:', prompt);
    console.log('Reference Images:', referenceImages.length);
    
    // parts 배열 구성 (프롬프트 + 레퍼런스 이미지들)
    const parts = [{ text: prompt }];
    
    // 레퍼런스 이미지 추가 (base64 데이터)
    for (const imageUrl of referenceImages) {
      if (imageUrl && imageUrl.startsWith('data:image/')) {
        const base64Data = imageUrl.split(',')[1];
        const mimeType = imageUrl.split(';')[0].split(':')[1];
        
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        });
      }
    }
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: parts
        }],
        generationConfig: {
          temperature: 1,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
          responseMimeType: 'text/plain'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error:', errorText);
      
      // 500 에러이고 재시도 횟수가 남아있으면 재시도
      if (response.status === 500 && retryCount < maxRetries - 1) {
        const waitTime = 2000 * (retryCount + 1); // 2초, 4초, 6초
        console.log(`🔄 500 Error detected. Retrying in ${waitTime/1000} seconds... (Attempt ${retryCount + 2}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return generateImage(prompt, referenceImages, retryCount + 1, maxRetries);
      }
      
      throw new Error(`Gemini API Error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Gemini API response received');
    
    // 응답에서 이미지 데이터 추출
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const parts = data.candidates[0].content.parts;
      
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          const base64Image = part.inlineData.data;
          console.log('Image generated successfully');
          return `data:${mimeType};base64,${base64Image}`;
        }
      }
    }
    
    throw new Error('No image data in response');
    
  } catch (error) {
    console.error('Image generation error:', error);
    throw error;
  }
}

// 디버깅용 환경 변수 상태 확인 엔드포인트
app.get('/api/debug/env', (req, res) => {
  const hasKey = !!GEMINI_API_KEY;
  const keyLength = GEMINI_API_KEY ? GEMINI_API_KEY.length : 0;
  const keyPreview = GEMINI_API_KEY ? `${GEMINI_API_KEY.substring(0, 10)}...` : 'NOT SET';
  
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    hasAPIKey: hasKey,
    keyLength: keyLength,
    keyPreview: keyPreview,
    message: hasKey ? '✅ API 키가 설정되어 있습니다' : '❌ API 키가 설정되지 않았습니다',
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('GEMINI') || k.includes('API'))
  });
});

// 1. 동화책 스토리 생성 API
app.post('/api/generate-storybook', requireAPIKey, async (req, res) => {
  try {
    const { title, targetAge, artStyle, referenceContent, totalPages = 10, geminiModel = 'gemini-3-pro-preview', existingCharacters } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: '동화책 제목을 입력해주세요.' });
    }

    // 연령대별 설정 (페이지 수, 단어 수, 문장 길이, 어휘 수준)
    const ageSettings = {
      '4': { 
        defaultPages: 10,
        pageRange: '8-12',
        wordCount: '800-1200', 
        sentenceLength: '6-8어절',
        sentenceComplexity: '매우 단순한 문장, 강한 반복 패턴',
        vocabulary: '초보 단계 일상 단어 (엄마, 아빠, 집, 밥 등)',
        description: '4세: 매우 짧은 문장, 반복적 리듬, 풍부한 의성어/의태어, 단순한 그림 설명 수준'
      },
      '5': { 
        defaultPages: 12,
        pageRange: '10-15',
        wordCount: '2000-3000', 
        sentenceLength: '10-14어절',
        sentenceComplexity: '단순한 문장 구조, 기본적인 연결',
        vocabulary: '쉬운 일상 단어와 기본 감정 표현 (기쁘다, 슬프다)',
        description: '5세: 짧고 명료한 문장, 간단한 인과관계, 구체적 상황 묘사, 반복 요소 활용'
      },
      '6': { 
        defaultPages: 15,
        pageRange: '12-18',
        wordCount: '2500-3500', 
        sentenceLength: '12-18어절',
        sentenceComplexity: '적절한 복문, 기본적인 인과관계 표현',
        vocabulary: '일상적 단어와 다양한 감정 표현 (질투하다, 기대하다)',
        description: '6세: 논리적 흐름, 감정 묘사 확대, 캐릭터 심리 표현, 대화 활용'
      },
      '7': { 
        defaultPages: 18,
        pageRange: '15-22',
        wordCount: '3000-4500', 
        sentenceLength: '15-22어절',
        sentenceComplexity: '복잡한 문장, 다양한 연결어미 사용',
        vocabulary: '추상 개념 일부 포함 (용기, 정직, 우정)',
        description: '7세: 복합적 스토리, 도덕적 메시지, 캐릭터 변화 표현, 다층적 갈등'
      },
      '8': { 
        defaultPages: 20,
        pageRange: '16-25',
        wordCount: '4000-5500', 
        sentenceLength: '18-25어절',
        sentenceComplexity: '고급 문장 구조, 은유와 비유 활용',
        vocabulary: '추상적 개념과 고급 어휘 (성찰, 희생, 운명)',
        description: '8세: 깊이 있는 주제, 복잡한 캐릭터 심리, 상징적 요소, 교훈적 통찰'
      }
    };
    const settings = ageSettings[targetAge] || ageSettings['5'];

    // 페이지 수 결정 (0이면 AI가 자동 결정, 아니면 지정된 수)
    let pageCount;
    let pageInstruction;
    
    if (totalPages === 0 || !totalPages) {
      // AI가 자동으로 적절한 페이지 수 결정
      pageCount = settings.defaultPages;
      const pageRangeText = settings.pageRange || `${settings.defaultPages - 2}-${settings.defaultPages + 2}`;
      pageInstruction = `스토리의 흐름과 내용에 맞춰 ${pageRangeText}페이지 사이에서 자연스럽게 조정하세요. 억지로 늘리거나 줄이지 말고, 이야기가 완결되는데 필요한 만큼만 사용하세요.`;
    } else {
      // 사용자가 지정한 페이지 수 (5-30 범위)
      pageCount = Math.min(Math.max(totalPages, 5), 30);
      pageInstruction = `정확히 ${pageCount}페이지로 작성하세요`;
    }

    // 기존 캐릭터 섹션 (다시 만들기 시)
    const existingCharSection = existingCharacters ? `

기존 캐릭터 정보 (이 캐릭터들을 반드시 사용하세요):
${existingCharacters.map((char, idx) => `${idx + 1}. ${char.name} (${char.role}): ${char.description}`).join('\n')}

**중요**: 위 캐릭터들을 그대로 사용하되, 새로운 스토리에 맞게 역할과 행동을 재구성하세요.` : '';

    // Gemini로 스토리 생성
    const referenceSection = referenceContent ? `

참고할 내용:
${referenceContent}

위 내용을 참고하여 새롭게 재해석하거나 유사한 구조로 창작해주세요.` : '';

    const prompt = `당신은 유아 교육 전문 동화 작가입니다. 다음 조건으로 동화책을 제작해주세요.

제목: "${title}"
타겟 연령: ${targetAge}세 (${settings.description})
페이지 수: ${pageInstruction}
총 단어 수: ${settings.wordCount}자
문장 길이: ${settings.sentenceLength}
문장 복잡도: ${settings.sentenceComplexity}
어휘 수준: ${settings.vocabulary}${existingCharSection}${referenceSection}

**연령대별 작문 가이드라인:**
${targetAge === '4-5' ? `
[4-5세 작문 스타일]
- 짧고 반복적인 문장 사용 (예: "토끼가 뛰어요. 팔짝팔짝 뛰어요.")
- 의성어/의태어 적극 활용 (예: 팔짝팔짝, 쿵쿵, 반짝반짝)
- 단순 명료한 표현, 한 문장에 하나의 행동
- 리듬감 있는 반복 패턴
- 예시: "토끼가 당근을 찾아요. 여기저기 찾아요. 당근이 어디 있을까요?"
` : ''}${targetAge === '5-7' ? `
[5-7세 작문 스타일]
- 인과관계가 명확한 문장 연결 (예: "~해서", "~때문에", "그래서")
- 감정 표현이 풍부한 묘사 (예: "기뻐서 웃었어요", "무서워서 떨었어요")
- 대화체와 지문의 적절한 조합
- 논리적 순서가 있는 스토리 전개
- 예시: "토끼는 배가 고팠어요. 그래서 숲속으로 먹을 것을 찾으러 갔어요. '어디 맛있는 게 없을까?' 토끼는 생각했어요."
` : ''}${targetAge === '7-8' ? `
[7-8세 작문 스타일]
- 복잡한 문장 구조와 복문 사용
- 은유와 비유 표현 활용 (예: "마음이 따뜻해졌어요", "용기가 샘솟았어요")
- 추상적 개념 포함 (우정, 용기, 정직 등)
- 다양한 어휘와 고급 표현
- 심리 묘사와 내면 성찰
- 예시: "토끼는 홀로 숲길을 걷다가 문득 깨달았어요. 진정한 용기란 두려움이 없는 게 아니라, 두려움을 이겨내는 것이라는 걸요."
` : ''}

**스토리 개연성 강화 요구사항:**
1. **명확한 스토리 구조**: 발단(문제 제시) → 전개(갈등 심화) → 위기(클라이맥스) → 결말(해결)
2. **논리적 인과관계**: 각 장면이 다음 장면으로 자연스럽게 이어져야 하며, "왜 그렇게 되었는지" 이유가 명확해야 함
3. **캐릭터 동기**: 각 캐릭터의 행동에는 명확한 이유와 목적이 있어야 함
4. **일관된 설정**: 장소, 시간, 세계관이 일관되게 유지되어야 함
5. **현실적 해결**: 갑작스러운 기적이나 데우스 엑스 마키나 없이, 캐릭터의 노력과 성장으로 문제 해결
6. **감정의 흐름**: 캐릭터의 감정 변화가 자연스럽고 공감 가능해야 함
**⭐⭐⭐ 매우 중요: 원본이 있는 유명 동화는 원작 구조를 존중하세요 ⭐⭐⭐**

**복선 규칙의 적용 범위:**

1. **오리지널 창작물 (새로 만드는 이야기)**: 
   - 위의 모든 복선 규칙을 엄격히 적용
   - 모든 중요 요소는 초반에 복선을 깔 것
   - 갑작스러운 등장 금지

2. **원본이 있는 유명 동화 (백설공주, 신데렐라, 잠자는 숲속의 공주 등)**:
   - ⭐ **원작의 고유한 구조와 전개를 존중하세요**
   - 복선 규칙보다 **원작의 스토리 흐름을 우선**
   - 원작에서 왕자가 후반부에 갑자기 등장한다면, 그대로 따를 것
   - 원작에 없는 만남을 억지로 추가하지 말 것

**원본 동화의 예시:**

❌ **잘못된 각색 (백설공주):**
- 페이지 3: "백설공주는 숲에서 한 왕자를 우연히 만났어. 왕자는 그녀의 아름다움에 반했지."
- 페이지 15: "그때 그 왕자가 나타나 백설공주에게 키스했어. 백설공주가 깨어났어!"
→ 문제: 원작에는 왕자가 초반에 등장하지 않음. 복선 규칙을 지키려다 원작 망침.

✅ **올바른 각색 (백설공주 - 원작 존중):**
- 페이지 1-10: 백설공주, 계모, 난쟁이들 이야기 (왕자 언급 없음)
- 페이지 11: "백설공주는 독사과를 먹고 깊은 잠에 빠졌어."
- 페이지 12: "그때 한 왕자가 지나가다가 유리관 속 백설공주를 보았어."
- 페이지 13: "왕자는 너무나 아름다운 공주를 보고 한눈에 반했어."
- 페이지 14: "왕자가 공주에게 키스하자 백설공주가 깨어났어!"
→ 해결: 원작처럼 왕자는 후반부에 갑자기 등장. 이것이 원작의 매력이자 구조.

❌ **잘못된 각색 (신데렐라):**
- 페이지 2: "신데렐라는 시장에서 한 왕자님을 만났어. 왕자는 그녀에게 관심을 보였지."
- 페이지 15: "신데렐라는 무도회에서 그 왕자를 다시 만났어."
→ 문제: 원작의 매직은 "첫 만남이 무도회"라는 점. 미리 만나면 무도회의 극적 효과 사라짐.

✅ **올바른 각색 (신데렐라 - 원작 존중):**
- 페이지 1-8: 계모와 언니들, 신데렐라의 고난
- 페이지 9: "궁전에서 무도회가 열린다는 소식이 들렸어."
페이지 10-12: 요정 대모, 마법, 유리 구두
페이지 13: "신데렐라는 무도회에서 왕자를 처음 만났어. 왕자는 그녀에게 한눈에 반했지."
- 페이지 10-12: 요정 대모, 마법, 유리 구두
- 페이지 13: "신데렐라는 무도회에서 왕자를 처음 만났어. 왕자는 그녀에게 한눈에 반했지."
→ 해결: 원작처럼 무도회가 첫 만남. 이것이 원작의 로맨스 구조.

**유명 동화 처리 가이드라인:**

제목이나 참고 내용으로 다음 동화들을 감지하면 **원작 구조를 우선**하세요:

**원작 존중 목록 (왕자가 후반에 등장):**
- 백설공주 (Snow White): 왕자는 마지막에 깨우러 옴
- 신데렐라 (Cinderella): 왕자는 무도회에서 첫 만남
- 잠자는 숲속의 공주 (Sleeping Beauty): 왕자는 100년 후 등장
- 인어공주 (The Little Mermaid): 왕자는 인어가 인간이 된 후 만남
- 라푼젤 (Rapunzel): 왕자는 탑에 갇힌 라푼젤을 후반에 발견

**복선 필요 목록 (오리지널 또는 복잡한 구조):**
- 알라딘 (Aladdin): 자스민은 초반에 언급 필요
- 피터팬 (Peter Pan): 후크의 악어 공포증은 초반에 설명
- 마법사의 제자: 마법 빗자루는 미리 소개
- 오리지널 창작물: 모든 복선 규칙 적용

**판단 기준:**
1. 제목에 "백설공주", "신데렐라", "잠자는 숲속의 공주" 등이 포함되면 → 원작 구조 존중
2. 참고 내용에 원작 줄거리가 있으면 → 그 구조 따르기
3. 완전히 새로운 창작물이면 → 복선 규칙 엄격 적용

**핵심 원칙:**
- **원작이 있으면 원작의 매력과 구조를 지킬 것**
- **복선 규칙은 오리지널 창작에만 엄격히 적용**
- **원작의 "운명적 만남" 같은 극적 요소를 훼손하지 말 것**

7. **복선과 회수**: 초반에 제시된 요소들이 후반에 의미 있게 활용되어야 함
   - ⭐ **오리지널 창작물에서는 중요한 요소는 반드시 복선을 깔아야 함**
   - ⭐ **원본 동화는 원작 구조를 존중하며 복선 규칙보다 우선함**
   - 나중에 중요하게 쓰일 사물, 캐릭터, 설정은 미리 언급 (오리지널 창작 시)
   - 예시 (❌ 복선 없음 - 오리지널 창작물):
     페이지 9: "후크 선장은 피터팬을 싫어했어."
     페이지 18: "갑자기 악어 소리가 들렸어. 후크 선장은 놀라 도망쳤어."
     → 문제: 악어는 갑자기 어디서? 왜 후크가 악어를 무서워하는지 모름
   
   - 예시 (✅ 복선 있음 - 오리지널 창작물):
     페이지 9: "후크 선장은 피터팬을 싫어했어. 예전에 피터팬이 악어에게 선장의 한쪽 손을 먹히게 했거든. 그 뒤로 악어는 시계를 삼켜서 째깍째깍 소리를 내며 선장을 쫓아다녀. 후크 선장은 그 소리만 들어도 벌벌 떨었어."
     페이지 18: "그 순간, 멀리서 째깍째깍 소리가 들렸어! 악어였어. 후크 선장은 악어 소리에 놀라 비명을 지르며 도망쳤어."
     → 해결: 악어 설정 미리 설명 → 나중에 자연스럽게 등장

8. **데우스 엑스 마키나 금지**
   - 갑자기 나타나 문제를 해결하는 요소 금지
   - 모든 해결책은 사전에 복선이 깔려 있어야 함
   - 예시 (❌ 갑자기 등장):
     "피터팬이 위험에 빠졌어. 그때 갑자기 마법 검이 나타나 적을 물리쳤어."
     → 문제: 마법 검은 어디서? 왜 갑자기?
   
   - 예시 (✅ 복선 후 등장):
     페이지 5: "피터팬은 네버랜드 나무 속에 숨겨둔 마법 검 이야기를 했어. 그 검은 위험할 때만 쓸 수 있다고 했지."
     페이지 15: "피터팬이 위험에 빠졌어. 그때 피터팬은 나무 속에 숨겨둔 마법 검을 꺼내 적을 물리쳤어."
     → 해결: 마법 검 미리 소개 → 나중에 자연스럽게 사용

**⭐ 매우 중요: 모든 사건에 명확한 배경 설명 필수 ⭐**

독자가 "어? 왜 갑자기?"라고 의문을 가질 만한 부분은 반드시 사전에 설명해야 합니다:

1. **캐릭터 등장/퇴장 설명**
   - 새 캐릭터가 등장하면 "왜" 등장했는지 설명
   - 기존 캐릭터가 사라지면 "왜" 사라졌는지 설명
   - 예시 (❌ 설명 없음): 
     페이지 1: "백설공주가 태어났어."
     페이지 2: "새 왕비는 욕심이 많았어."
     → 문제: 엄마는? 새 왕비는 갑자기 어디서?
   
   - 예시 (✅ 설명 있음):
     페이지 1: "백설공주가 태어났어. 하지만 엄마는 백설공주를 낳고 곧 세상을 떠났어."
     페이지 2: "왕은 슬픔을 이기지 못하고 새 왕비를 맞이했어. 하지만 새 왕비는 욕심이 많았지."
     → 해결: 엄마 사망 → 새 왕비 등장 순서 명확

2. **시간 경과 표현**
   - "시간이 흘렀어", "몇 년 후" 등으로 시간 점프 표시
   - 급작스러운 변화는 시간 경과로 설명
   - 예시 (❌ 시간 표현 없음):
     페이지 2: "백설공주가 태어났어."
     페이지 3: "백설공주는 아주 아름다운 소녀가 되었어."
     → 문제: 갑자기 성장?
   
   - 예시 (✅ 시간 표현 있음):
     페이지 3: "세월이 흘러 백설공주는 아름다운 소녀로 자랐어."
     → 해결: 시간 경과 명시

3. **동기와 이유 명시**
   - 캐릭터의 행동에는 항상 이유가 있어야 함
   - "왜 그랬는지" 독자가 이해할 수 있도록
   - 예시 (❌ 동기 없음):
     "왕비는 사냥꾼을 불러 명령했어."
     → 문제: 왜 갑자기 사냥꾼을?
   
   - 예시 (✅ 동기 있음):
     "거울이 백설공주가 더 아름답다고 하자, 왕비는 질투심에 불타올랐어. 왕비는 사냥꾼을 불러 명령했어."
     → 해결: 거울 → 질투 → 명령 순서

4. **상황 변화의 원인 설명**
   - 장소가 바뀌면 "왜" 바뀌었는지
   - 상황이 전환되면 "무엇이" 원인인지
   - 예시 (❌ 원인 없음):
     페이지 5: "왕비가 화를 냈어."
     페이지 6: "백설공주는 숲을 헤맸어."
     → 문제: 왜 갑자기 숲에?
   
   - 예시 (✅ 원인 있음):
     페이지 5: "왕비는 사냥꾼에게 백설공주를 숲으로 데려가라고 명령했어."
     페이지 6: "사냥꾼은 백설공주를 숲 깊은 곳으로 데려갔지만, 차마 해치지 못하고 도망가라고 말했어."
     페이지 7: "백설공주는 무서운 숲을 홀로 헤맸어."
     → 해결: 명령 → 숲 이동 → 도망 → 홀로 헤맴 순서

5. **전형적인 동화 구조에서 빠지기 쉬운 함정**
   - ❌ 새 계모가 갑자기 등장 (친엄마는?)
   - ❌ 주인공이 갑자기 다른 장소에 (어떻게?)
   - ❌ 캐릭터가 갑자기 적대적으로 변함 (왜?)
   - ❌ 해결책이 갑자기 등장 (어디서?)
   
   - ✅ 모든 전환에 "왜냐하면" 추가
   - ✅ "그래서", "그러자", "하지만" 등 연결어 활용
   - ✅ 최소 1-2문장으로 배경 설명

**백설공주 예시 (올바른 순서):**

페이지 1: "옛날 어느 왕국에 아름다운 공주가 태어났어. 피부는 눈처럼 하얗고 입술은 앵두처럼 붉어서 '백설공주'라고 불렸지."

페이지 2: "하지만 백설공주를 낳은 왕비는 출산 후 병으로 세상을 떠났어. 왕과 온 나라가 슬퍼했지."

페이지 3: "세월이 흘러 왕은 새 왕비를 맞이했어. 새 왕비는 아름답지만 교만하고 욕심이 많았어."

페이지 4: "새 왕비는 마법 거울을 가지고 있었어. 매일 거울에게 물었지. '거울아, 거울아, 이 세상에서 누가 가장 예쁘니?'"

→ 해결: 백설공주 탄생 → 엄마 사망 → 시간 경과 → 새 왕비 등장 → 마법 거울 소개 (모든 단계 명확)

**피터팬 예시 (복선과 회수):**

❌ 잘못된 예시:
페이지 9: "후크 선장은 피터팬을 싫어했어. 피터팬이 악어에게 선장의 손을 먹히게 했거든."
페이지 18: "갑자기 악어 소리가 들렸어. 후크 선장은 놀라 도망쳤어."
→ 문제: 악어가 왜 나타났는지 모름. 악어가 후크를 쫓아다닌다는 설명 없음.

✅ 올바른 예시:
페이지 9: "후크 선장은 피터팬을 무척 싫어했어. 예전에 피터팬이 악어에게 선장의 한쪽 손을 먹히게 했거든. 그 뒤로 악어는 시계를 삼켜서 째깍째깍 소리를 내며 선장을 쫓아다녔어. 후크 선장은 그 시계 소리만 들어도 벌벌 떨며 도망쳤지."

페이지 18: "피터팬과 후크 선장이 격렬하게 싸우고 있을 때였어. 멀리서 째깍째깍 시계 소리가 들려왔어! 악어가 나타난 거야. 후크 선장은 악어 소리에 비명을 지르며 바다로 뛰어들어 도망쳤어."
→ 해결: 악어 설정(시계 소리, 후크를 쫓음) 미리 설명 → 나중에 자연스럽게 등장

**복선 체크리스트 (오리지널 창작물 전용):**
스토리를 작성할 때 다음을 확인하세요:

**먼저 판단: 이 동화가 원본이 있는 유명 동화인가?**
- YES → 원작 구조 존중, 아래 체크리스트 생략 가능
- NO → 아래 체크리스트 모두 확인

**오리지널 창작물 체크리스트:**
1. 나중에 중요한 사물/인물/설정이 있는가? → 미리 소개했는가?
2. 갑자기 등장해서 문제를 해결하는 요소가 있는가? → 미리 복선을 깔았는가?
3. 독자가 "어? 이거 처음 나온 건데?"라고 생각할 부분이 있는가? → 사전에 언급했는가?
4. 모든 중요 요소가 초반 1/3 지점 이내에 소개되었는가?

**원본 동화 체크리스트:**
1. 원작의 스토리 구조를 따르고 있는가?
2. 원작의 극적 요소(운명적 만남 등)를 보존했는가?
3. 원작에 없는 억지 복선을 추가하지 않았는가?

**⭐ 매우 중요: 페이지별 텍스트와 삽화 일치 원칙 ⭐**

각 페이지는 **단일하고 명확한 시각적 장면**을 중심으로 구성해야 합니다:

1. **1페이지 = 1장면 원칙**
   - 한 페이지에는 하나의 명확한 장면만 담기
   - 텍스트가 2개 이상의 장면을 언급하면 안 됨
   - 예시 (❌ 잘못됨): "거울이 백설공주가 아름답다고 말했어. 왕비는 사냥꾼을 불러 명령했어." → 2개 장면이 섞임
   - 예시 (✅ 올바름): "왕비는 화가 나서 사냥꾼을 불러 명령했어." → 1개 장면만

2. **삽화로 표현 가능한 텍스트 작성**
   - 삽화만 봐도 무슨 일이 일어나는지 대략 이해 가능해야 함
   - 추상적인 개념보다는 구체적인 행동/상황 묘사
   - 예시 (❌ 추상적): "시간이 흘러 백설공주는 성장했어."
   - 예시 (✅ 구체적): "백설공주는 정원에서 새들과 함께 노래하며 놀았어."

3. **scene_description은 text와 완벽히 일치 (⭐매우 중요⭐)**
   - **text에 언급된 모든 캐릭터와 사물을 scene_description에 반드시 포함**
   - text에 없는 요소를 scene_description에 추가하면 안 됨
   - text의 핵심 장면을 시각적으로 자세히 묘사
   
   - 예시 텍스트: "개구리가 공주에게 말했어. '약속을 지켜주세요.'"
   - ❌ 잘못된 scene_description: "공주가 궁전에서 왕과 대화하는 장면"
     → 문제: 개구리가 빠짐! text에 있는 핵심 캐릭터를 누락
   - ✅ 올바른 scene_description: "궁전 안에서 작은 녹색 개구리가 공주를 올려다보며 말하고 있고, 공주는 놀란 표정으로 개구리를 내려다보는 장면"
   
   - 예시 텍스트: "왕비는 화가 나서 사냥꾼을 불러 명령했어."
   - ✅ scene_description: "화난 표정의 왕비가 왕좌에 앉아 사냥꾼을 내려다보며 손가락으로 지시하는 장면. 사냥꾼은 고개를 숙이고 있음."
   
   **중요 체크리스트:**
   - [ ] text에 나온 모든 캐릭터가 scene_description에 포함되었는가?
   - [ ] text에 나온 중요한 사물(예: 개구리, 유리구두, 사과 등)이 scene_description에 포함되었는가?
   - [ ] scene_description이 text의 핵심 행동/감정을 정확히 반영하는가?

4. **장면 전환이 필요한 경우 페이지 분리**
   - 장소 변경 → 새 페이지
   - 시간 경과 → 새 페이지
   - 주요 행동 변화 → 새 페이지
   - 예시: "거울 장면"과 "사냥꾼 명령 장면"은 반드시 별도 페이지로

5. **삽화 중심 스토리텔링**
   - 텍스트 없이 삽화만 순서대로 봐도 스토리 흐름 이해 가능하도록
   - 각 페이지의 삽화가 스토리의 핵심 순간(key moment)을 포착
   - 대화나 내레이션은 삽화를 보조하는 역할

**페이지 구성 예시 (백설공주 기준):**

잘못된 예시 ❌:
- 페이지 5: "거울이 백설공주가 아름답다고 대답했어. 왕비는 화가 나서 사냥꾼을 불렀어."
  → 문제: 거울 장면과 사냥꾼 장면이 섞임, 삽화로 뭘 그려야 할지 불명확

올바른 예시 ✅:
- 페이지 5: "거울이 대답했어. '백설공주님이 가장 아름다우십니다.' 왕비의 얼굴이 분노로 일그러졌어."
  → scene_description: "마법 거울 속에 백설공주의 모습이 비치고, 거울 앞에서 왕비가 분노하며 거울을 노려보는 장면"
  
- 페이지 6: "왕비는 사냥꾼을 불러 냉정하게 명령했어. '백설공주를 숲으로 데려가 없애버려라!'"
  → scene_description: "왕좌에 앉은 왕비가 사냥꾼에게 손가락으로 지시하는 장면. 사냥꾼은 난처한 표정으로 고개를 숙이고 있음"

**캐릭터 생성 규칙:**
- 그룹 캐릭터는 반드시 개별적으로 분리해서 생성하세요
- 예시: "일곱 난쟁이" → "난쟁이1", "난쟁이2", ..., "난쟁이7"로 각각 생성
- 예시: "세 명의 도둑" → "도둑1", "도둑2", "도둑3"으로 각각 생성
- 각 개별 캐릭터는 고유한 특징과 개성을 가져야 함 (예: 난쟁이1은 안경을 쓰고, 난쟁이2는 수염이 길고 등)
- **⭐ 변신하는 캐릭터는 반드시 "변신 전"과 "변신 후"를 구분하세요**
- 예시: "인어공주" → "인어공주 (인어)" + "인어공주 (인간)"
- 예시: "개구리 왕자" → "왕자 (개구리)" + "왕자 (인간)"
- 예시: "백조 공주" → "공주 (백조)" + "공주 (인간)"
- **⭐ 변장하는 캐릭터도 반드시 "본 모습"과 "변장 모습"을 구분하세요**
- 예시: "자파" → "자파 (본 모습)" + "자파 (늙은 노인 변장)"
- 예시: "마녀" → "마녀 (본 모습)" + "마녀 (할머니 변장)"
- 변신/변장 캐릭터의 name 형식: "캐릭터명 (형태)" (예: "자파 (본 모습)", "자파 (늙은 노인 변장)")
- 각 형태별로 완전히 다른 외모 설명 필요 (예: 인어 - 물고기 꼬리, 인간 - 다리)

다음 형식의 JSON으로 응답해주세요:

{
  "title": "동화책 제목",
  "characters": [
    {
      "name": "캐릭터 이름 (개별 캐릭터로 작성, 복수형 금지, 숫자 붙이지 말 것)",
      "description": "외모와 성격 상세 설명 (한국어, 개별 특징 포함)",
      "role": "주인공/조력자/악역 등",
      "height": 150
    }
  ],
  "pages": [
    {
      "pageNumber": 1,
      "text": "페이지 텍스트 (한국어, 2-4문장)",
      "scene_description": "위 text 필드의 장면을 시각적으로 자세히 설명 (한국어)",
      "scene_structure": {
        "characters": "이 장면에 등장하는 캐릭터들과 그들의 행동/표정 (한국어)",
        "background": "배경 설명 (장소, 시간대 등, 한국어)",
        "atmosphere": "분위기와 감정 (한국어)",
        "key_objects": "이 장면의 주요 사물들 - 스토리에 중요한 물건들의 상세한 시각적 설명 (예: 램프, 왕관, 마법 지팡이, 유리 구두, 황금 열쇠 등). 사물이 없으면 빈 문자열.",
        "spatial_layout": "캐릭터들의 좌우 위치 관계 (예: '빨간 망토는 왼쪽, 늑대는 오른쪽', '알라딘은 중앙, 지니는 오른쪽 위', '공주는 오른쪽, 왕자는 왼쪽'). 연속된 장면에서는 이전 페이지와 일관성 유지 필요."
      }
    }
  ],
  "theme": "교훈 및 주제",
  "educational_content": {
    "symbols": ["상징 해석 질문 3-4개"],
    "activity": "창의 활동 아이디어",
    "vocabulary": [
      {"word": "영어명사1", "korean": "한글뜻1", "definition": "단어의 뜻을 쉽게 설명", "example": "예문 (한글)"},
      {"word": "영어명사2", "korean": "한글뜻2", "definition": "단어의 뜻을 쉽게 설명", "example": "예문 (한글)"},
      {"word": "영어명사3", "korean": "한글뜻3", "definition": "단어의 뜻을 쉽게 설명", "example": "예문 (한글)"},
      {"word": "영어명사4", "korean": "한글뜻4", "definition": "단어의 뜻을 쉽게 설명", "example": "예문 (한글)"},
      {"word": "영어명사5", "korean": "한글뜻5", "definition": "단어의 뜻을 쉽게 설명", "example": "예문 (한글)"},
      {"word": "영어명사6", "korean": "한글뜻6", "definition": "단어의 뜻을 쉽게 설명", "example": "예문 (한글)"},
      {"word": "영어명사7", "korean": "한글뜻7", "definition": "단어의 뜻을 쉽게 설명", "example": "예문 (한글)"},
      {"word": "영어명사8", "korean": "한글뜻8", "definition": "단어의 뜻을 쉽게 설명", "example": "예문 (한글)"}
    ]
  },
  "key_objects": [
    {
      "name": "영어명사1",
      "korean": "한글명1",
      "description": "사물의 상세한 시각적 설명 (색상, 재질, 모양, 크기, 특징)",
      "size": "small/medium/large",
      "sizeCm": 10,
      "example": "이 사물이 등장하는 예시 문장"
    },
    {
      "name": "영어명사2",
      "korean": "한글명2",
      "description": "사물의 상세한 시각적 설명 (색상, 재질, 모양, 크기, 특징)",
      "size": "small/medium/large",
      "sizeCm": 10,
      "example": "이 사물이 등장하는 예시 문장"
    },
    {
      "name": "영어명사3",
      "korean": "한글명3",
      "description": "사물의 상세한 시각적 설명 (색상, 재질, 모양, 크기, 특징)",
      "size": "small/medium/large",
      "sizeCm": 10,
      "example": "이 사물이 등장하는 예시 문장"
    },
    {
      "name": "영어명사4",
      "korean": "한글명4",
      "description": "사물의 상세한 시각적 설명 (색상, 재질, 모양, 크기, 특징)",
      "size": "small/medium/large",
      "sizeCm": 10,
      "example": "이 사물이 등장하는 예시 문장"
    },
    {
      "name": "영어명사5",
      "korean": "한글명5",
      "description": "사물의 상세한 시각적 설명 (색상, 재질, 모양, 크기, 특징)",
      "size": "small/medium/large",
      "sizeCm": 10,
      "example": "이 사물이 등장하는 예시 문장"
    },
    {
      "name": "영어명사6",
      "korean": "한글명6",
      "description": "사물의 상세한 시각적 설명 (색상, 재질, 모양, 크기, 특징)",
      "size": "small/medium/large",
      "sizeCm": 10,
      "example": "이 사물이 등장하는 예시 문장"
    },
    {
      "name": "영어명사7",
      "korean": "한글명7",
      "description": "사물의 상세한 시각적 설명 (색상, 재질, 모양, 크기, 특징)",
      "size": "small/medium/large",
      "sizeCm": 10,
      "example": "이 사물이 등장하는 예시 문장"
    },
    {
      "name": "영어명사8",
      "korean": "한글명8",
      "description": "사물의 상세한 시각적 설명 (색상, 재질, 모양, 크기, 특징)",
      "size": "small/medium/large",
      "sizeCm": 10,
      "example": "이 사물이 등장하는 예시 문장"
    }
  ]
}

요구사항:
- 정확히 ${pageCount}페이지 분량으로 작성
- 종결어미: ~했어, ~였어, ~구나 사용
- 밝고 긍정적인 이야기
- **매우 중요**: 그룹 캐릭터는 반드시 개별적으로 분리하세요 (예: "일곱 난쟁이" 제목이면 난쟁이1~7을 각각 생성)
- **매우 중요**: 캐릭터 name은 단수형으로만 작성하세요 (복수형 금지: "난쟁이들" ❌)
- **매우 중요**: 1명인 캐릭터는 절대 숫자를 붙이지 마세요 (❌ "왕자1", "공주1" → ✅ "왕자", "공주")
- **매우 중요**: 2명 이상 그룹만 숫자 붙임 (✅ "난쟁이1", "난쟁이2" when 일곱 난쟁이)
- **매우 중요**: 캐릭터 description은 한국어로 작성하되, 이미지 생성에 필요한 시각적 요소(색상, 크기, 특징 등)를 자세히 포함하세요
- **⭐ 절대 필수 - 캐릭터 키(height) 설정 ⭐**:
  - 각 캐릭터에 **height 필드를 반드시 포함**하세요 (단위: cm)
  - 성인 남성: 170-185cm
  - 성인 여성: 160-175cm
  - 어린이(10-15세): 140-160cm
  - 어린이(5-10세): 110-140cm
  - 유아(3-5세): 90-110cm
  - 난쟁이/작은 캐릭터: 80-120cm
  - 거인/큰 캐릭터: 200-250cm
  - 동물은 실제 크기 기준 (예: 토끼 30cm, 늑대 80cm, 말 160cm)
  - 캐릭터 간 키 차이가 스토리에 중요한 경우 명확히 구분하세요
- **⭐ 절대 필수 - 캐릭터 의상 명시 ⭐**: 
  - 각 캐릭터의 description에 **의상의 색상과 스타일을 명확히 포함**하세요
  - 예: "파란색 드레스와 흰색 앞치마", "빨간색 망토와 파란색 상의", "청록색 의상"
  - 의상 색상은 매우 구체적으로 명시 (예: "파란색" 대신 "짙은 남색", "연한 하늘색" 등)
  - **특별한 의상 변경 장면이 아닌 한, 같은 의상을 스토리 전체에서 유지해야 함**
  - 변신/변장 캐릭터는 각 형태별로 다른 의상 명시 가능
- **매우 중요**: 각 캐릭터는 구별 가능한 고유 특징을 가져야 합니다 (예: 난쟁이1은 안경, 난쟁이2는 긴 수염)
- **매우 중요**: scene_description은 한국어로 작성하되, 이미지 생성에 필요한 시각적 요소를 자세히 포함하세요
- **매우 중요**: 각 페이지에 scene_structure 객체를 반드시 포함하세요
- **⭐ 절대 필수 - 스토리 개연성 ⭐**: 
  - 중요한 사물(램프, 반지, 책 등)이 캐릭터 간에 이동할 때는 반드시 명확하게 표현하세요
  - 예: "자파가 램프를 빼앗음" → 다음 페이지에서 램프는 자파가 가지고 있어야 함
  - 예: "원숭이가 램프를 다시 가져옴" → 이런 식으로 명확한 이동 과정 필요
  - 한 페이지에서 A가 빼앗았으면, 다음 페이지에서 갑자기 B가 가지고 있으면 안 됨
- **⭐ 절대 필수 - 캐릭터 사전 소개 ⭐**:
  - 중요한 캐릭터는 처음 등장하기 전 또는 등장할 때 반드시 소개해야 함
  - 예: "자스민 공주"가 등장하기 전 "알라딘은 평소 좋아하던 자스민 공주를..." 같은 사전 언급 필요
  - 갑자기 새로운 캐릭터가 나타나면 안 됨 (독자가 혼란스러움)
  - 주요 캐릭터는 초반부터 존재를 암시하거나 소개하세요
- **⭐ 절대 필수 - 주요 사물 일관성 ⭐**: scene_structure에 key_objects 필드를 포함하세요!
  - 스토리에서 반복적으로 등장하는 중요한 사물(램프, 왕관, 유리 구두, 마법 지팡이 등)은 **상세한 시각적 설명**을 포함하세요
  - **⭐ 매우 중요: 사물이 처음 등장하는 페이지에만 상세한 설명을 작성하세요!**
  - **처음 등장 시:** 색상, 재질, 모양, 크기, 특징적인 장식을 모두 포함한 완전한 설명
  - **이후 등장 시:** 간단한 언급만 (예: "마법 램프", "유리 구두") - 시스템이 자동으로 처음 설명을 참조함
- **⭐ 절대 필수 - Key Objects 생성 ⭐**:
  - 스토리에서 중요한 역할을 하는 8개의 핵심 사물을 key_objects 배열에 포함하세요
  - 각 사물은 name(영어), korean(한글), description(상세 시각 설명), size(크기), example(예시 문장)을 포함
  - 우선순위: 1) 스토리의 핵심 아이템 (마법 램프, 유리 구두, 독사과 등)
  - 우선순위: 2) 자주 등장하는 중요 사물 (왕관, 거울, 지팡이 등)
  - 우선순위: 3) 상징적 의미가 있는 사물
  - size는 small(손에 들 수 있는 크기), medium(사람 키 정도), large(건물/큰 물체) 중 선택
  - **⭐ sizeCm 필드를 반드시 포함하세요**: 사물의 실제 크기를 cm 단위로 지정
    • small: 1-30cm (예: 사과 8cm, 왕관 15cm, 반지 2cm)
    • medium: 30-200cm (예: 의자 80cm, 거울 150cm, 책상 100cm)
    • large: 200-1000cm (예: 나무 500cm, 집 400cm, 성 2000cm)
  - description은 캐릭터 description과 같은 수준의 상세함으로 작성 (색상, 재질, 모양, 장식 등)
  - example은 스토리에서 이 사물이 실제로 사용되는 문장 작성
  - 예시 (처음 등장): "마법 램프 (구리색, 곡선형 손잡이, 긴 주둥이, 표면에 아랍 문양이 새겨진 오래된 램프)"
  - 예시 (이후 등장): "마법 램프 - 알라딘의 손에 들려있음" 또는 "마법 램프 - 바닥에 놓여있음"
  - 사물이 등장하지 않는 페이지는 빈 문자열 "" 사용
- **⭐ 절대 필수 ⭐**: scene_structure의 background에는 반드시 시간대를 명확히 표시하세요! 
  (예: "햇살이 비치는 낮", "별이 빛나는 밤", "촛불이 켜진 저녁", "달빛이 비치는 밤")
  ❌ "숲속", "궁전 식당" (시간대 없음)
  ✅ "숲속, 햇살이 비치는 낮", "궁전 식당, 촛불이 켜진 밤"
- **⭐ 절대 필수 - 공간적 일관성 ⭐**: scene_structure에 spatial_layout 필드를 포함하세요!
  - 주요 캐릭터들의 좌우 위치 관계를 명시하세요 (예: "빨간 망토는 왼쪽, 늑대는 오른쪽")
  - **연속된 장면에서는 캐릭터의 좌우 위치를 일관되게 유지하세요!**
  - 예: Page 5에서 "공주는 왼쪽, 왕자는 오른쪽"이면, Page 6에서도 동일하게 유지
  - 캐릭터가 이동하거나 장면이 완전히 바뀌는 경우에만 위치 변경 허용
  - 갑작스러운 좌우 반전은 독자를 혼란스럽게 만들므로 절대 금지!
- **⭐ 매우 중요 - vocabulary 선정 규칙 ⭐**: vocabulary는 반드시 동화에 등장하는 중요한 **사물**과 **사람(캐릭터)**을 우선적으로 선정하세요!
  
  **우선순위 1: 주요 캐릭터 (사람)**
  - 동화의 주인공과 주요 인물들을 먼저 포함하세요
  - 예: Princess(공주), Prince(왕자), Witch(마녀), Dwarf(난쟁이), Wolf(늑대), Grandmother(할머니) 등
  
  **우선순위 2: 스토리의 핵심 사물**
  - 스토리 전개에 중요한 역할을 하는 물건들
  - scene_structure의 key_objects에 반복적으로 등장하는 사물들
  - 예: Apple(사과), Mirror(거울), Crown(왕관), Lamp(램프), Slipper(구두), Basket(바구니) 등
  
  **우선순위 3: 자주 등장하는 배경 사물**
  - 여러 페이지에 걸쳐 등장하는 배경 요소
  - 예: Castle(성), Forest(숲), Tree(나무), House(집), River(강) 등
  
  **⭐ 중요한 캐릭터·사물이 8개 미만인 경우:**
  - 위 우선순위대로 먼저 선정하고, 남은 자리는 일반적인 구체적 명사로 채우세요
  - 예: Star(별), Moon(달), Sun(해), Flower(꽃), Mountain(산) 등
  
  **형식**: 각 단어는 {"word": "영어명사", "korean": "한글뜻"} 형식으로 작성하세요
  
  **예시 (백설공주 스토리):**
  1. {"word": "Princess", "korean": "공주"} ← 주인공
  2. {"word": "Queen", "korean": "왕비"} ← 주요 악역
  3. {"word": "Prince", "korean": "왕자"} ← 주요 인물
  4. {"word": "Dwarf", "korean": "난쟁이"} ← 주요 조력자
  5. {"word": "Apple", "korean": "사과"} ← 핵심 사물 (독이 든 사과)
  6. {"word": "Mirror", "korean": "거울"} ← 핵심 사물 (마법 거울)
  7. {"word": "Castle", "korean": "성"} ← 주요 배경
  8. {"word": "Forest", "korean": "숲"} ← 주요 배경

캐릭터 명명 예시:
올바른 예시 ✅:
- 단일 캐릭터: {"name": "백설공주"}, {"name": "왕자"}, {"name": "왕비"}
- 그룹 캐릭터: {"name": "난쟁이1"}, {"name": "난쟁이2"}, ..., {"name": "난쟁이7"}

잘못된 예시 ❌:
- {"name": "왕자1"} ← 1명인데 숫자 붙임
- {"name": "공주1"} ← 1명인데 숫자 붙임
- {"name": "난쟁이들"} ← 복수형 사용

캐릭터 상세 예시 (백설공주 스토리):
- {"name": "백설공주", "description": "긴 검은 머리와 하얀 피부, 빨간 리본을 한 소녀", "role": "주인공"}
- {"name": "왕자", "description": "잘생긴 금발 머리, 파란 왕자복을 입은 청년", "role": "조력자"}
- {"name": "왕비", "description": "화려한 검은 드레스, 사악한 표정의 중년 여성", "role": "악역"}
- {"name": "난쟁이1", "description": "둥근 안경을 쓰고 똑똑해 보이는 작은 난쟁이, 파란 모자", "role": "조력자"}
- {"name": "난쟁이2", "description": "긴 하얀 수염을 기른 작은 난쟁이, 빨간 모자", "role": "조력자"}
- {"name": "난쟁이3", "description": "졸린 표정의 작은 난쟁이, 초록 모자", "role": "조력자"}
(이런 식으로 각 난쟁이마다 고유한 특징 부여)

**변신 캐릭터 예시 (인어공주 스토리):**
- {"name": "인어공주 (인어)", "description": "긴 빨간 머리, 아름다운 얼굴, 초록색 비늘의 물고기 꼬리, 조개껍질 장식", "role": "주인공"}
- {"name": "인어공주 (인간)", "description": "긴 빨간 머리, 아름다운 얼굴, 인간의 다리, 파란색 드레스 착용", "role": "주인공"}
- {"name": "왕자", "description": "잘생긴 검은 머리, 하얀 해군 제복을 입은 청년", "role": "조력자"}

**변신 캐릭터 예시 (개구리 왕자 스토리):**
- {"name": "왕자 (개구리)", "description": "작은 녹색 개구리, 반짝이는 눈, 금빛 왕관을 쓴 개구리", "role": "주인공"}
- {"name": "왕자 (인간)", "description": "잘생긴 금발 청년, 금빛 왕관, 화려한 왕자복 착용", "role": "주인공"}
- {"name": "공주", "description": "아름다운 금발 머리, 분홍색 드레스를 입은 소녀", "role": "조력자"}

**변장 캐릭터 예시 (알라딘 스토리):**
- {"name": "자파 (본 모습)", "description": "검은 수염과 터번을 쓴 사악한 마법사, 검은 로브와 뱀 지팡이를 든 중년 남성", "role": "악역"}
- {"name": "자파 (늙은 노인 변장)", "description": "구부정한 자세의 늙은 노인, 회색 수염과 누더기 옷, 지팡이를 짚은 할아버지", "role": "악역"}
- {"name": "알라딘", "description": "갈색 머리의 가난한 소년, 남루한 옷을 입은 청소년", "role": "주인공"}
- {"name": "원숭이", "description": "작고 귀여운 갈색 원숭이, 빨간 조끼를 입은 알라딘의 친구", "role": "조력자"}
- {"name": "자스민 공주", "description": "긴 검은 머리, 청록색 의상을 입은 아름다운 공주", "role": "조력자"}
- {"name": "지니", "description": "거대한 파란 요정, 근육질 몸, 하반신은 연기로 되어있음", "role": "조력자"}

**⭐ 의상 일관성 예시 (미녀와 야수 스토리) - 매우 중요! ⭐:**
- {"name": "벨", "description": "갈색 머리를 뒤로 묶은 아름다운 소녀, **파란색 드레스**와 흰색 앞치마 착용", "role": "주인공"}
- {"name": "야수", "description": "갈색 털을 가진 거대한 짐승, **빨간색 망토**와 **파란색 상의** 착용, 날카로운 뿔과 이빨", "role": "주인공"}
→ ⭐ 중요: 벨은 **항상 파란색 드레스**, 야수는 **항상 빨간색 망토와 파란색 상의**를 입어야 함!
→ ⚠️ 금지: 벨이 갑자기 흰색 드레스나 노란색 드레스를 입으면 안 됨 (특별한 의상 변경 장면이 아닌 한)
→ ⚠️ 금지: 야수가 갑자기 다른 색 옷을 입으면 안 됨

장면 예시:

**⭐ 시간대(낮/밤) 구분 규칙 - 매우 중요! ⭐**
- scene_structure의 background에는 반드시 시간대를 명확히 포함하세요!
- 낮 장면 표현: "햇살이 비치는 낮", "밝은 아침", "화창한 낮", "오후 햇살", "정오의 밝은 빛"
- 밤 장면 표현: "별이 빛나는 밤", "달빛이 비치는 밤", "어두운 밤", "자정", "달이 뜬 밤하늘"
- 석양/새벽 표현: "석양이 지는 저녁", "붉은 노을이 지는 황혼", "동트는 새벽", "새벽녘"
- ❌ 잘못된 예: "궁전 식당" (시간대 없음)
- ✅ 올바른 예: "궁전 식당, 촛불이 켜진 밤" 또는 "궁전 식당, 햇살이 비치는 낮"

**예시 1: 낮 장면 (동물 캐릭터)**
- text: "토끼가 숲에서 당근을 발견했어요" 
- scene_description: "숲속에서 흰 토끼가 오렌지색 당근을 발견하고 깜짝 놀라며 기뻐하는 장면. 토끼의 귀가 쫑긋 서있고 눈이 반짝거립니다. 햇살이 나뭇잎 사이로 비춥니다."
- scene_structure: {"characters": "흰 토끼가 기쁜 표정으로 당근을 발견함", "background": "초록색 숲속, 햇살이 비치는 밝은 낮", "atmosphere": "밝고 즐거운 분위기", "key_objects": "크고 싱싱한 오렌지색 당근", "spatial_layout": "토끼는 중앙, 당근은 토끼 앞 오른쪽"}

**예시 2: 밤 장면 (개구리가 등장하는 경우)**
- text: "개구리가 공주에게 다가와 말했어요. '약속을 지켜주세요.'"
- ❌ 잘못된 scene_description: "공주가 궁전 안에서 왕과 대화하는 장면"
  → 문제: 개구리가 완전히 누락됨!
- ✅ 올바른 scene_description: "궁전 안에서 작은 녹색 개구리가 공주 앞에 있고, 공주를 올려다보며 말하고 있습니다. 공주는 놀란 표정으로 개구리를 내려다보고 있습니다. 창밖으로 밤하늘이 보입니다."
- scene_structure: {"characters": "녹색 개구리가 공주 앞에서 말하고, 공주는 놀란 표정으로 개구리를 봄", "background": "궁전 식당, 촛불이 켜진 저녁 식사 시간", "atmosphere": "놀라움과 긴장감", "key_objects": "황금 공 (공주가 떨어뜨린 황금색으로 빛나는 공)", "spatial_layout": "공주는 왼쪽, 개구리는 오른쪽"}

**예시 3: 밤 장면 (침실)**
- text: "밤이 되어 개구리는 공주 침실에서 함께 잤어요"
- scene_description: "어두운 침실에서 달빛이 창문을 통해 은은히 들어오고, 작은 녹색 개구리가 침대 한쪽에 웅크리고 자고 있습니다."
- scene_structure: {"characters": "녹색 개구리가 침대에서 자고 있음", "background": "왕궁 침실, 달빛이 비치는 밤", "atmosphere": "고요하고 평화로운 밤", "key_objects": "황금 공 (침대 옆 탁자 위에 놓여진 황금 공)", "spatial_layout": "공주는 왼쪽 침대에, 개구리는 오른쪽 침대 끝에"}
  → ⭐ 중요: 이전 페이지와 동일하게 공주 왼쪽, 개구리 오른쪽 유지!

**예시 3-1: 공간적 일관성 유지 (빨간 망토 예시)**

**Page 5 (처음 만남):**
- text: "빨간 망토는 숲에서 늑대를 만났어요"
- scene_structure: {"characters": "빨간 망토가 놀란 표정으로 늑대를 바라봄", "background": "어두운 숲속, 오후 햇살", "atmosphere": "긴장감", "key_objects": "바구니", "spatial_layout": "빨간 망토는 왼쪽, 늑대는 오른쪽"}
  → ⭐ 첫 만남: 빨간 망토 왼쪽, 늑대 오른쪽

**Page 6 (대화 장면):**
- text: "늑대가 빨간 망토에게 물었어요. '어디 가니?'"
- scene_structure: {"characters": "늑대가 말하고, 빨간 망토가 대답함", "background": "숲속 오솔길, 오후 햇살", "atmosphere": "긴장된 대화", "key_objects": "바구니", "spatial_layout": "빨간 망토는 왼쪽, 늑대는 오른쪽"}
  → ⭐ 중요: Page 5와 동일한 위치 유지! 절대 좌우 반전하지 말 것!

**Page 7 (계속 대화):**
- scene_structure: {..., "spatial_layout": "빨간 망토는 왼쪽, 늑대는 오른쪽"}
  → ⭐ 여전히 동일한 위치 유지!

**예시 4: 알라딘 동화 - 램프의 일관성 유지 (매우 중요!)**

**Page 3 (처음 등장):**
- text: "알라딘이 신비한 램프를 발견했어요"
- scene_description: "어두운 동굴 속에서 알라딘이 오래되고 먼지가 쌓인 구리색 램프를 발견하는 장면. 램프는 특이한 곡선 모양의 손잡이와 긴 주둥이를 가지고 있습니다."
- scene_structure: {"characters": "알라딘이 놀란 표정으로 램프를 쳐다봄", "background": "어두운 동굴, 보물들이 쌓여있음", "atmosphere": "신비롭고 긴장감 넘치는 분위기", "key_objects": "**마법 램프** (구리색, 곡선형 손잡이, 긴 주둥이, 표면에 아랍 문양이 새겨진 오래된 램프)"}
  → ⭐ 중요: 처음 등장이므로 상세한 시각적 특징을 모두 명시!

**Page 4 (두 번째 등장):**
- text: "알라딘이 램프를 문질렀어요"
- scene_description: "알라딘이 램프를 손으로 문지르자 연기가 피어오르는 장면"
- scene_structure: {"characters": "알라딘이 램프를 문지르고 있음", "background": "동굴 안, 빛이 번쩍이는 순간", "atmosphere": "놀라움과 마법적인 순간", "key_objects": "마법 램프 - 알라딘의 손에 들려있음"}
  → ⭐ 중요: 이미 등장했으므로 간단히 언급만! 시스템이 자동으로 Page 3의 상세 설명 참조

**Page 5 (세 번째 등장):**
- text: "램프에서 지니가 나왔어요!"
- scene_structure: {"characters": "거대한 지니가 램프에서 나오고 있음", "background": "동굴 안, 마법의 연기로 가득함", "atmosphere": "경이롭고 놀라운 순간", "key_objects": "마법 램프 - 바닥에 놓여있음"}
  → ⭐ 중요: 여전히 간단히 언급만! 시스템이 자동으로 Page 3의 상세 설명 참조

**예시 5: 신데렐라 - 유리 구두의 일관성**

**Page 7 (처음 등장):**
- text: "신데렐라는 무도회에서 왕자와 춤을 췄어요"
- scene_structure: {"characters": "신데렐라와 왕자가 춤을 추고 있음", "background": "화려한 무도회장, 촛불이 켜진 밤", "atmosphere": "로맨틱하고 황홀한 분위기", "key_objects": "**유리 구두** (투명하고 반짝이는 크리스탈 구두, 작고 섬세한 굽)"}
  → ⭐ 처음 등장: 상세한 설명 포함

**Page 8 (두 번째 등장):**
- text: "자정이 되자 신데렐라는 계단을 내려가다 구두 한 짝을 잃어버렸어요"
- scene_structure: {"characters": "신데렐라가 급하게 계단을 내려가고 있음", "background": "궁전 계단, 달빛이 비치는 자정", "atmosphere": "긴박하고 아쉬운 순간", "key_objects": "유리 구두 - 한 짝은 계단에 남겨짐"}
  → ⭐ 이미 등장: 간단히 언급만, 시스템이 Page 7의 설명 자동 참조

**예시 4: 변신 전 모습 유지 (밤 장면)**
- text: "마법이 풀리기 전, 개구리는 공주 옆에서 자고 있었어요."
- ✅ scene_description: "어두운 침실에서 작은 녹색 개구리가 침대 한쪽 구석에 웅크리고 자고 있고, 공주는 침대 반대편에서 불편한 표정으로 누워있습니다. 달빛이 창문을 통해 들어옵니다."
- scene_structure: {"characters": "녹색 개구리가 침대에서 자고 있고, 공주는 불편한 표정", "background": "왕궁 침실, 달빛이 비치는 밤", "atmosphere": "불편하고 긴장된 분위기"}
  → 중요: "마법이 풀리기 전"이므로 아직 개구리 상태여야 함!

**예시 5: 변신 후 모습 (아침 장면)**
- text: "아침이 되자 개구리는 멋진 왕자로 변했어요!"
- ✅ scene_description: "침실에서 햇살이 비치는 아침, 멋진 왕자가 침대 옆에 서있고 공주는 놀란 표정으로 왕자를 바라보는 장면. 밝은 햇빛이 창문을 통해 쏟아져 들어옵니다."
- scene_structure: {"characters": "잘생긴 왕자가 서있고, 공주는 놀란 표정으로 바라봄", "background": "왕궁 침실, 햇살이 비치는 아침", "atmosphere": "놀라움과 기쁨의 순간"}
  → 중요: 이제는 "왕자"로 변했으므로 개구리가 아닌 왕자를 그려야 함!

- vocabulary 예시 (우선순위대로 선정): 
  1순위 주요 캐릭터: [{"word": "Rabbit", "korean": "토끼", "definition": "귀가 길고 뒷다리로 깡충깡충 뛰는 동물", "example": "토끼가 당근을 먹어요"}]
  2순위 핵심 사물: [{"word": "Carrot", "korean": "당근", "definition": "주황색이고 땅속에서 자라는 채소", "example": "토끼는 당근을 좋아해요"}]
  3순위 배경 요소: [{"word": "Forest", "korean": "숲", "definition": "나무가 많이 모여 있는 곳", "example": "숲속에는 동물들이 살아요"}, {"word": "Tree", "korean": "나무", "definition": "땅에 뿌리를 내리고 자라는 큰 식물", "example": "나무 아래에서 쉬었어요"}]
  나머지: [{"word": "Flower", "korean": "꽃", "definition": "예쁜 색깔과 향기가 나는 식물", "example": "예쁜 꽃이 피었어요"}, {"word": "Sun", "korean": "해", "definition": "하늘에서 밝게 빛나는 뜨거운 별", "example": "해가 밝게 빛나요"}, {"word": "Moon", "korean": "달", "definition": "밤하늘에 떠 있는 밝은 천체", "example": "밤에 달을 봤어요"}, {"word": "Star", "korean": "별", "definition": "밤하늘에서 반짝이는 작은 빛", "example": "별이 반짝반짝 빛나요"}]

⭐ **vocabulary 작성 규칙:**
1. **word**: 영어 명사 (대문자 시작)
2. **korean**: 한글 뜻
3. **definition**: 아이들이 이해하기 쉬운 설명 (1-2문장, ~는/은 ~이다/예요 형식)
4. **example**: 동화 내용이나 일상에서 사용하는 간단한 예문 (한 문장, ~해요/~이에요 형식)

**예시 (백설공주 스토리):**
- {"word": "Princess", "korean": "공주", "definition": "왕과 왕비의 딸로 궁전에 사는 여자아이", "example": "공주는 궁전에서 살아요"}
- {"word": "Queen", "korean": "왕비", "definition": "왕의 아내로 왕국을 다스리는 여자", "example": "왕비는 마법 거울을 가지고 있어요"}
- {"word": "Apple", "korean": "사과", "definition": "빨갛고 둥근 과일", "example": "빨간 사과가 맛있어요"}
- {"word": "Mirror", "korean": "거울", "definition": "자기 모습을 비춰볼 수 있는 물건", "example": "거울을 보며 웃었어요"}
- {"word": "Forest", "korean": "숲", "definition": "나무가 많이 모여 있는 곳", "example": "숲속에서 길을 잃었어요"}
- {"word": "House", "korean": "집", "definition": "사람이나 동물이 사는 곳", "example": "작은 집을 발견했어요"}
- {"word": "Prince", "korean": "왕자", "definition": "왕과 왕비의 아들로 궁전에 사는 남자아이", "example": "왕자가 말을 타고 왔어요"}
- {"word": "Dwarf", "korean": "난쟁이", "definition": "키가 작고 수염이 있는 작은 사람", "example": "난쟁이들이 노래를 불러요"}

JSON만 응답하세요.`;

    // 선택한 Gemini 모델 사용
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`;
    console.log(`🤖 Using AI Model: ${geminiModel}`);
    
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini Error:', errorText);
      
      let errorMessage = 'AI 스토리 생성 실패';
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error) {
          const code = errorJson.error.code;
          const status = errorJson.error.status;
          const message = errorJson.error.message;
          
          if (code === 503 || status === 'UNAVAILABLE') {
            errorMessage = 'AI 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.';
          } else if (code === 429) {
            errorMessage = 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
          } else if (code === 403) {
            errorMessage = 'API 키 권한 오류입니다. 관리자에게 문의하세요.';
          } else {
            errorMessage = `AI 오류: ${message}`;
          }
        }
      } catch (e) {
        // JSON 파싱 실패 시 기본 메시지 사용
      }
      
      return res.status(response.status).json({ 
        success: false,
        error: errorMessage 
      });
    }

    const data = await response.json();
    
    // 에러 응답 체크
    if (data.error) {
      console.error('Gemini API Error:', data.error);
      throw new Error(`Gemini API Error: ${data.error.message || JSON.stringify(data.error)}`);
    }
    
    // 응답 구조 검증
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
      console.error('Unexpected Gemini response structure:', JSON.stringify(data, null, 2));
      throw new Error('Gemini API returned unexpected response structure');
    }
    
    let storyText = data.candidates[0].content.parts[0].text;
    
    // JSON 추출
    storyText = storyText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let storybook;
    try {
      storybook = JSON.parse(storyText);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Failed to parse text:', storyText.substring(0, 500) + '...');
      throw new Error('Failed to parse AI response as JSON. The AI response may be incomplete or malformed.');
    }
    
    // 그룹 캐릭터 자동 확장 (예: "일곱 난쟁이" → 난쟁이1, 난쟁이2, ...)
    const expandedCharacters = [];
    for (const char of storybook.characters) {
      // AI가 이미 숫자를 붙인 경우 감지 (예: "왕자1", "난쟁이1")
      const aiNumberedMatch = char.name.match(/^(.+?)(\d+)$/);
      
      const groupMatch = char.name.match(/^(.*?)\s*[x×X]\s*(\d+)$/); // "도둑 x 3" 형식
      const numberMatch = char.name.match(/(\d+)\s*(명|마리|개|분|분의)/); // "세 명의 도둑" 형식
      const koreanNumberMatch = char.name.match(/(일곱|여섯|다섯|네|셋|두|하나|한)\s*(명의|마리의|개의)?\s*(.+)/); // "일곱 난쟁이" 형식
      
      // 한글 숫자를 아라비아 숫자로 변환
      const koreanNumbers = {
        '하나': 1, '한': 1, '하나의': 1,
        '둘': 2, '두': 2, '두의': 2,
        '셋': 3, '세': 3, '세의': 3,
        '넷': 4, '네': 4, '네의': 4,
        '다섯': 5, '다섯의': 5,
        '여섯': 6, '여섯의': 6,
        '일곱': 7, '일곱의': 7,
        '여덟': 8, '여덟의': 8,
        '아홉': 9, '아홉의': 9,
        '열': 10, '열의': 10
      };
      
      let count = 1;
      let baseName = char.name;
      
      // AI가 이미 숫자를 붙인 경우 (예: "왕자1" → "왕자")
      if (aiNumberedMatch && !groupMatch && !numberMatch && !koreanNumberMatch) {
        const possibleBase = aiNumberedMatch[1];
        const number = parseInt(aiNumberedMatch[2]);
        
        // 같은 base name을 가진 다른 캐릭터가 있는지 확인
        const sameBaseCount = storybook.characters.filter(c => 
          c.name.startsWith(possibleBase) && c.name.match(/^.+?\d+$/)
        ).length;
        
        if (sameBaseCount > 1) {
          // 여러 개 있으면 그룹으로 판단
          baseName = possibleBase;
          // 이미 개별화되어 있으므로 그대로 추가
          expandedCharacters.push(char);
          continue;
        } else {
          // 단 1개만 있으면 숫자 제거
          console.log(`AI가 불필요하게 숫자 붙임: "${char.name}" → "${possibleBase}"`);
          expandedCharacters.push({
            name: possibleBase,
            description: char.description,
            role: char.role
          });
          continue;
        }
      }
      
      if (groupMatch) {
        // "도둑 x 3" 형식
        baseName = groupMatch[1].trim();
        count = parseInt(groupMatch[2]);
      } else if (numberMatch) {
        // "3명의 도둑" 형식
        count = parseInt(numberMatch[1]);
        baseName = char.name.replace(numberMatch[0], '').trim();
      } else if (koreanNumberMatch) {
        // "일곱 난쟁이" 형식
        const koreanNum = koreanNumberMatch[1];
        count = koreanNumbers[koreanNum] || 1;
        baseName = koreanNumberMatch[3].trim();
      }
      
      // 그룹 캐릭터인 경우 (2명 이상)
      if (count > 1 && count <= 10) {
        console.log(`그룹 캐릭터 확장: "${char.name}" → ${count}명`);
        for (let i = 1; i <= count; i++) {
          expandedCharacters.push({
            name: `${baseName}${i}`,
            description: `${char.description} (${i}번째 ${baseName})`,
            role: char.role
          });
        }
      } else {
        // 단일 캐릭터
        expandedCharacters.push(char);
      }
    }
    
    storybook.characters = expandedCharacters;
    
    // ID와 메타데이터 추가
    storybook.id = Date.now().toString();
    storybook.targetAge = targetAge;
    storybook.artStyle = artStyle;
    storybook.createdAt = new Date().toISOString();
    
    res.json({
      success: true,
      storybook
    });

  } catch (error) {
    console.error('Storybook generation error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false,
      error: '스토리 생성 실패: ' + error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// 2. 캐릭터 레퍼런스 이미지 생성
app.post('/api/generate-character-image', requireAPIKey, async (req, res) => {
  try {
    const { character, artStyle, settings = {} } = req.body;
    
    // 설정값 기본값
    const aspectRatio = settings.aspectRatio || '16:9';
    const enforceNoText = settings.enforceNoText !== false;
    const additionalPrompt = settings.additionalPrompt || '';
    
    // character.description을 영어로 번역 (한글인 경우)
    let characterDescriptionEn = character.description;
    if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(character.description)) {
      // 한글이 포함되어 있으면 번역
      console.log('Translating character description to English...');
      const translateUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const translateResponse = await fetch(translateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ 
            parts: [{ 
              text: `Translate the following Korean character description to English for image generation. Keep it detailed and visual:\n\n${character.description}` 
            }] 
          }]
        })
      });
      
      if (translateResponse.ok) {
        const translateData = await translateResponse.json();
        if (translateData.candidates && 
            translateData.candidates[0] && 
            translateData.candidates[0].content && 
            translateData.candidates[0].content.parts && 
            translateData.candidates[0].content.parts[0]) {
          characterDescriptionEn = translateData.candidates[0].content.parts[0].text.trim();
          console.log('Translated character description:', characterDescriptionEn);
        } else {
          console.warn('Translation response structure unexpected, using original description');
          characterDescriptionEn = character.description;
        }
      } else {
        console.warn('Translation failed, using original description');
        characterDescriptionEn = character.description;
      }
    }
    
    // 텍스트 제거 강조
    const noTextPrompt = enforceNoText ? 
      '\n\n**CRITICAL - NO TEXT:** Do NOT include ANY text, labels, words, letters, captions, titles, or character names in the image. Absolutely NO TEXT of any kind. Pure illustration only.' : 
      '\n\n**IMPORTANT:** Do NOT include any text, labels, words, or letters in the image. No text overlays, no character names, no captions. Pure illustration only.';
    
    const prompt = `Create a professional character design reference sheet for a children's storybook character. 

**Character Description:** ${characterDescriptionEn}

**Art Style:** ${artStyle} style for children's book illustration.

**Image Aspect Ratio:** ${aspectRatio}

**Layout:** Generate a single image showing the character in multiple views and expressions:
- Front view (center, main pose)
- Side view (left side)  
- 3/4 view (right side)
- Three facial expressions at the bottom: happy, surprised, and neutral

**Background:** Clean white background suitable for character reference.

**Quality:** High detail, vibrant colors, soft shading, professional children's book illustration quality. The character should have a warm, friendly, and appealing appearance suitable for young children aged 4-8 years.

**Composition:** Arrange all views in a single cohesive character sheet layout that clearly shows the character's design from different angles.
${noTextPrompt}
${additionalPrompt ? '\n\n**Additional Requirements:** ' + additionalPrompt : ''}`;
    
    console.log('Generating character image with settings:', { aspectRatio, enforceNoText });

    const imageUrl = await generateImage(prompt);
    
    res.json({
      success: true,
      imageUrl,
      prompt
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false,
      error: '이미지 생성 실패: ' + error.message
    });
  }
});

// 3. 페이지 삽화 생성 (캐릭터 레퍼런스 이미지 참조)
app.post('/api/generate-illustration', requireAPIKey, async (req, res) => {
  try {
    const { page, artStyle, characterReferences, settings = {}, editNote = '', previousPages = [] } = req.body;
    
    // 설정값 기본값
    const aspectRatio = settings.aspectRatio || '16:9';
    const enforceNoText = settings.enforceNoText !== false;
    const enforceCharacterConsistency = settings.enforceCharacterConsistency !== false;
    const additionalPrompt = settings.additionalPrompt || '';
    
    // editNote를 영어로 번역 (한글인 경우)
    let editNoteEn = '';
    if (editNote && editNote.trim()) {
      if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(editNote)) {
        // 한글이 포함되어 있으면 번역
        console.log('Translating edit note to English...');
        const translateUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const translateResponse = await fetch(translateUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ 
              parts: [{ 
                text: `Translate the following Korean edit note for image modification to English:\n\n${editNote}` 
              }] 
            }]
          })
        });
        
        if (translateResponse.ok) {
          const translateData = await translateResponse.json();
          if (translateData.candidates && 
              translateData.candidates[0] && 
              translateData.candidates[0].content && 
              translateData.candidates[0].content.parts && 
              translateData.candidates[0].content.parts[0]) {
            editNoteEn = translateData.candidates[0].content.parts[0].text.trim();
            console.log('Translated edit note:', editNoteEn);
          } else {
            console.warn('Translation response structure unexpected, using original edit note');
            editNoteEn = editNote;
          }
        } else {
          console.warn('Translation failed, using original edit note');
          editNoteEn = editNote;
        }
      } else {
        editNoteEn = editNote;
      }
    }
    
    // scene_description을 영어로 번역 (한글인 경우)
    let sceneDescriptionEn = page.scene_description;
    if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(page.scene_description)) {
      // 한글이 포함되어 있으면 번역
      console.log('Translating scene description to English...');
      const translateUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const translateResponse = await fetch(translateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ 
            parts: [{ 
              text: `Translate the following Korean scene description to English for image generation. Keep it detailed and visual:\n\n${page.scene_description}` 
            }] 
          }]
        })
      });
      
      if (translateResponse.ok) {
        const translateData = await translateResponse.json();
        if (translateData.candidates && 
            translateData.candidates[0] && 
            translateData.candidates[0].content && 
            translateData.candidates[0].content.parts && 
            translateData.candidates[0].content.parts[0]) {
          sceneDescriptionEn = translateData.candidates[0].content.parts[0].text.trim();
          console.log('Translated scene description:', sceneDescriptionEn);
        } else {
          console.warn('Translation response structure unexpected, using original description');
          sceneDescriptionEn = page.scene_description;
        }
      } else {
        console.warn('Translation failed, using original description');
        sceneDescriptionEn = page.scene_description;
      }
    }
    
    // 캐릭터 레퍼런스 이미지 수집
    const referenceImages = [];
    let characterInfo = '';
    
    if (characterReferences && characterReferences.length > 0) {
      const consistencyLevel = enforceCharacterConsistency ? 
        '\n\n**🎯 Character Consistency - ABSOLUTE CRITICAL REQUIREMENT 🎯:**\nThe characters in this scene MUST match EXACTLY the appearance shown in the reference images with PIXEL-PERFECT accuracy.\nThis is NOT optional - this is MANDATORY.\n\n' :
        '\n\n**🎯 Character Consistency - MANDATORY REQUIREMENT 🎯:**\nThe characters in this scene MUST match the reference images exactly.\n\n';
      
      characterInfo = consistencyLevel;
      
      characterReferences.forEach((char, index) => {
        if (char.referenceImage) {
          referenceImages.push(char.referenceImage);
          if (enforceCharacterConsistency) {
            characterInfo += `**Reference Image ${index + 1} - ${char.name}:**
COPY THIS CHARACTER WITH PIXEL-PERFECT ACCURACY:
- Face: EXACT same facial features, eye shape, eye color, nose, mouth
- Hair: EXACT same hairstyle, hair color, hair length
- Clothing: EXACT same outfit colors, style, patterns, accessories
- Body: EXACT same body proportions, height, build
- Skin tone: EXACT same skin color and texture
- EVERY SINGLE DETAIL must match the reference image

**⚠️ CRITICAL - CLOTHING CONSISTENCY:**
DO NOT change the character's clothing/outfit between pages unless the story explicitly mentions a costume change.
If the reference shows a blue dress, it MUST be blue in ALL pages.
If the reference shows a red cape, it MUST be red in ALL pages.
Keep the EXACT SAME clothing throughout the story.\n\n`;
          } else {
            characterInfo += `**Reference Image ${index + 1} - ${char.name}:**
Match this character's appearance: ${char.description}
**IMPORTANT:** Keep the same clothing/outfit in all scenes.\n\n`;
          }
        }
      });
      
      if (enforceCharacterConsistency) {
        characterInfo += '\n**🚨 ABSOLUTE REQUIREMENT - NO EXCEPTIONS 🚨:**\nLook at EVERY reference image above and recreate EACH character with PIXEL-PERFECT accuracy.\nSame face, same hair, same clothing, same colors, same features, same proportions, same EVERYTHING.\nDo NOT deviate from the reference images by even 0.1%.\nDo NOT change clothing colors, styles, or patterns.\nDo NOT modify hairstyles or facial features.\nPERFECT REPLICATION REQUIRED.';
      } else {
        characterInfo += '\n**IMPORTANT REQUIREMENT:**\nMatch the reference images carefully, especially clothing and facial features.\nKeep the same outfit colors and styles throughout the story.';
      }
    }
    
    // 구조화된 장면 설명 구성 (한글을 영어로 번역)
    let sceneDetails = '';
    if (page.scene_structure) {
      // scene_structure도 영어로 번역
      const structureText = `Characters & Actions: ${page.scene_structure.characters}\nBackground Setting: ${page.scene_structure.background}\nMood & Atmosphere: ${page.scene_structure.atmosphere}`;
      
      console.log('Translating scene structure to English...');
      const translateUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const translateResponse = await fetch(translateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ 
            parts: [{ 
              text: `Translate the following Korean scene structure to English for image generation:\n\n${structureText}` 
            }] 
          }]
        })
      });
      
      if (translateResponse.ok) {
        const translateData = await translateResponse.json();
        if (translateData.candidates && 
            translateData.candidates[0] && 
            translateData.candidates[0].content && 
            translateData.candidates[0].content.parts && 
            translateData.candidates[0].content.parts[0]) {
          const translated = translateData.candidates[0].content.parts[0].text.trim();
          sceneDetails = `\n\n**Scene Structure:**\n${translated}`;
          console.log('Translated scene structure:', translated);
        } else {
          console.warn('Translation response structure unexpected, using original structure');
          sceneDetails = `\n\n**Scene Structure:**
- **Characters & Actions:** ${page.scene_structure.characters}
- **Background Setting:** ${page.scene_structure.background}  
- **Mood & Atmosphere:** ${page.scene_structure.atmosphere}${page.scene_structure.key_objects ? `\n- **Key Objects:** ${page.scene_structure.key_objects}` : ''}${page.scene_structure.spatial_layout ? `\n- **Spatial Layout:** ${page.scene_structure.spatial_layout}` : ''}`;
        }
      } else {
        sceneDetails = `\n\n**Scene Structure:**
- **Characters & Actions:** ${page.scene_structure.characters}
- **Background Setting:** ${page.scene_structure.background}  
- **Mood & Atmosphere:** ${page.scene_structure.atmosphere}${page.scene_structure.key_objects ? `\n- **Key Objects:** ${page.scene_structure.key_objects}` : ''}${page.scene_structure.spatial_layout ? `\n- **Spatial Layout:** ${page.scene_structure.spatial_layout}` : ''}`;
      }
    }
    
    // 전체 스토리 맥락 구성 (이전 페이지들)
    let storyContext = '';
    let objectConsistencyNote = '';
    let spatialConsistencyNote = '';
    
    if (previousPages && previousPages.length > 0) {
      console.log(`Including story context from ${previousPages.length} previous pages`);
      const previousTexts = previousPages
        .filter(p => p.pageNumber < page.pageNumber)
        .sort((a, b) => a.pageNumber - b.pageNumber)
        .map(p => `Page ${p.pageNumber}: ${p.text}`)
        .join('\n');
      
      // 바로 이전 페이지의 spatial_layout 참조 (공간적 일관성 유지)
      const previousPage = previousPages
        .filter(p => p.pageNumber === page.pageNumber - 1)
        .sort((a, b) => b.pageNumber - a.pageNumber)[0];
      
      if (previousPage && previousPage.scene_structure && previousPage.scene_structure.spatial_layout) {
        const previousLayout = previousPage.scene_structure.spatial_layout;
        if (previousLayout.trim() && page.scene_structure && page.scene_structure.spatial_layout) {
          spatialConsistencyNote = `\n\n**⭐ CRITICAL - SPATIAL CONSISTENCY ⭐:**
The previous page (Page ${previousPage.pageNumber}) had this character layout:
"${previousLayout}"

The current page (Page ${page.pageNumber}) has this layout:
"${page.scene_structure.spatial_layout}"

**ABSOLUTE REQUIREMENT - MAINTAIN SPATIAL CONSISTENCY:**
- If the same characters appear in consecutive pages, they MUST maintain their left-right positions
- For example: If "Red Riding Hood on left, Wolf on right" in previous page, they must STAY "Red Riding Hood on left, Wolf on right" in current page
- DO NOT flip/mirror the positions unless there is a clear scene change or character movement
- Sudden left-right reversal confuses readers and breaks visual continuity
- Keep characters in their established spatial positions throughout continuous scenes`;
        }
      }
      
      // 처음 등장한 key_objects를 찾아서 참조 (일관성 유지)
      // 현재 페이지에 key_objects가 있으면, 이전 페이지들에서 처음 등장한 설명을 찾음
      if (page.scene_structure && page.scene_structure.key_objects && page.scene_structure.key_objects.trim()) {
        // 현재 페이지의 key_objects에서 사물 이름 추출 (예: "마법 램프", "유리 구두" 등)
        const currentObjects = page.scene_structure.key_objects;
        
        // 이전 페이지들을 순서대로 순회하며 처음 등장한 key_objects 찾기
        const sortedPreviousPages = previousPages
          .filter(p => p.pageNumber < page.pageNumber && p.scene_structure && p.scene_structure.key_objects)
          .sort((a, b) => a.pageNumber - b.pageNumber);
        
        if (sortedPreviousPages.length > 0) {
          // 처음 등장한 페이지의 key_objects
          const firstAppearance = sortedPreviousPages[0];
          const firstObjects = firstAppearance.scene_structure.key_objects;
          
          if (firstObjects.trim()) {
            objectConsistencyNote = `\n\n**⭐ CRITICAL - OBJECT CONSISTENCY ⭐:**
These key objects FIRST appeared on Page ${firstAppearance.pageNumber} with this description:
${firstObjects}

**ABSOLUTE REQUIREMENT:** The objects in the current page MUST look EXACTLY THE SAME as when they first appeared on Page ${firstAppearance.pageNumber}. Use the EXACT same:
- Colors (same color tones and shades)
- Shapes (same geometric forms and proportions)
- Materials (same textures and finishes)
- Decorations (same patterns and ornaments)
- Size and proportions (same relative sizes)

For example:
- If a "copper-colored lamp with curved handle and Arab patterns" appeared first, it must ALWAYS be copper-colored with curved handle and Arab patterns
- If a "transparent crystal shoe with delicate heel" appeared first, it must ALWAYS be transparent crystal with delicate heel
- Keep PIXEL-PERFECT consistency with the first appearance to maintain story continuity`;
          }
        }
      }
      
      if (previousTexts) {
        storyContext = `\n\n**STORY CONTEXT - What happened before this scene:**
${previousTexts}

**CURRENT PAGE ${page.pageNumber}:** ${page.text}

**CRITICAL:** The illustration MUST match the current page state. For example, if a character transformed (like mermaid becoming human), they MUST appear in their NEW form on the current page, not their old form.${objectConsistencyNote}${spatialConsistencyNote}`;
      }
    }
    
    // 텍스트 제거 강조 (기본적으로도 강력하게 적용)
    const noTextPrompt = enforceNoText ? 
      '\n\n**🚫 CRITICAL - ABSOLUTELY NO TEXT 🚫:**\nDo NOT include ANY text, labels, words, letters, captions, titles, speech bubbles, dialogue boxes, or text overlays in the image.\nAbsolutely NO TEXT of any kind - not even a single letter or number.\nNO VISUAL TEXT ELEMENTS WHATSOEVER.\nPure illustration only with zero text content.' : 
      '\n\n**🚫 IMPORTANT - NO TEXT 🚫:**\nDo NOT include any text, labels, words, letters, captions, titles, speech bubbles, dialogue boxes, or text overlays in the image.\nNo visual text of any kind.\nPure illustration only.';
    
    const prompt = `Create a beautiful, professional illustration for a children's storybook page.
${storyContext}

**Main Scene Description:** ${sceneDescriptionEn}
${sceneDetails}
${characterInfo}
${editNoteEn ? `\n\n**Important Modification Request:** ${editNoteEn}` : ''}

**Art Style:** ${artStyle} style for children's book illustration.

**Image Aspect Ratio:** ${aspectRatio}

**Composition:** Create a warm, inviting scene that captures the emotion and action of the story moment. Use a horizontal composition suitable for a storybook spread.

**Lighting & Atmosphere:** ${page.scene_structure?.background?.includes('밤') || page.scene_structure?.background?.includes('night') || page.scene_structure?.background?.includes('달빛') || page.scene_structure?.background?.includes('moonlight') || page.scene_structure?.background?.includes('저녁') || page.scene_structure?.background?.includes('evening') ? 'NIGHT SCENE: Dark sky with stars or moonlight. Use cool blue/purple tones for nighttime atmosphere. Include visible moon or stars if outdoors. Indoor scenes should have candles, lanterns, or dim warm lighting.' : 'DAY SCENE: Bright, clear daylight with warm sunlight. Use bright yellows and warm colors for daytime atmosphere. Show clear blue sky if outdoors. Indoor scenes should have natural sunlight streaming through windows.'} The scene should feel magical yet safe and welcoming for young children.

**Quality:** High detail, rich colors, professional children's book illustration quality. The image should be engaging and age-appropriate for children aged 4-8 years.

**Background:** Detailed but not overwhelming - the focus should remain on the characters and their actions while providing a rich, immersive environment.
${noTextPrompt}
${additionalPrompt ? '\n\n**Additional Requirements:** ' + additionalPrompt : ''}

Make the illustration emotionally engaging and visually captivating while maintaining a child-friendly, whimsical tone.`;
    
    console.log('Generating illustration with', referenceImages.length, 'reference images');
    console.log('Settings:', { aspectRatio, enforceNoText, enforceCharacterConsistency });

    const imageUrl = await generateImage(prompt, referenceImages);
    
    res.json({
      success: true,
      imageUrl,
      prompt
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false,
      error: '이미지 생성 실패: ' + error.message
    });
  }
});

// 4. 단어 학습용 이미지 생성 (캐릭터와 사물 일관성 강화)
app.post('/api/generate-vocabulary-images', requireAPIKey, async (req, res) => {
  try {
    const { vocabulary, artStyle, settings = {}, storybook = {} } = req.body;
    
    if (!vocabulary || vocabulary.length === 0) {
      return res.status(400).json({ error: '단어 목록이 필요합니다.' });
    }
    
    const aspectRatio = settings.aspectRatio || '1:1';
    const enforceNoText = settings.enforceNoText !== false;
    const additionalPrompt = settings.additionalPrompt || '';
    
    // 동화책의 캐릭터와 key_objects 정보 수집
    const characters = storybook.characters || [];
    const allKeyObjects = [];
    
    // 모든 페이지에서 key_objects 수집
    if (storybook.pages && Array.isArray(storybook.pages)) {
      storybook.pages.forEach(page => {
        if (page.scene_structure && page.scene_structure.key_objects) {
          allKeyObjects.push(page.scene_structure.key_objects);
        }
      });
    }
    
    const images = [];
    
    for (const vocabItem of vocabulary) {
      try {
        // vocabItem이 객체인지 문자열인지 확인
        const word = typeof vocabItem === 'object' ? vocabItem.word : vocabItem;
        const korean = typeof vocabItem === 'object' ? vocabItem.korean : '';
        
        const noTextPrompt = enforceNoText ? 
          '\n\n**CRITICAL - NO TEXT:** Do NOT include ANY text, labels, words, letters, or captions in the image. Absolutely NO TEXT of any kind. Pure illustration only.' :
          '\n\n**IMPORTANT:** Do NOT include any text, labels, words, or letters in the image.';
        
        // 이 단어가 캐릭터인지 확인
        const matchingCharacter = characters.find(char => 
          char.name && (
            char.name.toLowerCase().includes(korean.toLowerCase()) ||
            korean.toLowerCase().includes(char.name.toLowerCase()) ||
            char.role === '주인공' ||
            char.role === '조력자' ||
            char.role === '악역'
          )
        );
        
        // 이 단어가 주요 사물인지 확인
        const isKeyObject = allKeyObjects.some(objDesc => 
          objDesc && objDesc.toLowerCase().includes(korean.toLowerCase())
        );
        
        let prompt;
        let referenceImages = [];
        
        // 캐릭터인 경우 - 캐릭터 레퍼런스 이미지 사용
        if (matchingCharacter) {
          console.log(`📚 Character found for "${word}" (${korean}): ${matchingCharacter.name}`);
          
          if (matchingCharacter.referenceImage) {
            referenceImages.push(matchingCharacter.referenceImage);
            console.log(`  🎨 Using character reference image`);
          }
          
          prompt = `Create a simple, clear, educational illustration for a children's vocabulary learning card showing a character.

**Character to Illustrate:** ${word}${korean ? ` (${korean})` : ''}

**CRITICAL - Character Appearance (MUST FOLLOW EXACTLY):**
${matchingCharacter.description}

**Character Role:** ${matchingCharacter.role}

**Art Style:** ${artStyle} style for children's book illustration.

**Image Aspect Ratio:** ${aspectRatio}

**Requirements:**
- Show the character in a simple, clear, frontal pose
- Clean white or simple background (no complex scenes)
- **EXACT appearance matching the character description above**
- Bright, vibrant colors
- Child-friendly, appealing design
- Age-appropriate for 4-8 years old
- Focus on the character's distinctive features
- Make it easy for children to recognize this character
${noTextPrompt}
${additionalPrompt ? '\n\n**Additional Requirements:** ' + additionalPrompt : ''}

${matchingCharacter.referenceImage ? '**IMPORTANT:** Use the provided reference image to maintain EXACT visual consistency with the character\'s appearance in the storybook. Match ALL visual details precisely.' : ''}

Create a single, clear character portrait that children can easily recognize.`;
        }
        // 주요 사물인 경우 - scene_structure의 key_objects 설명 활용
        else if (isKeyObject) {
          console.log(`🔑 Key object found for "${word}" (${korean})`);
          
          // key_objects에서 관련 설명 찾기
          const objectDescription = allKeyObjects.find(objDesc => 
            objDesc && objDesc.toLowerCase().includes(korean.toLowerCase())
          );
          
          prompt = `Create a simple, clear, educational illustration for a children's vocabulary learning card showing an important story object.

**Object to Illustrate:** ${word}${korean ? ` (${korean})` : ''}

**Object Description from Story:**
${objectDescription || '이 동화에서 중요한 역할을 하는 사물입니다.'}

**Art Style:** ${artStyle} style for children's book illustration.

**Image Aspect Ratio:** ${aspectRatio}

**Requirements:**
- Show the object clearly and simply
- Clean white background
- **Match the visual description from the story above**
- Bright, vibrant colors
- Child-friendly, appealing design
- Age-appropriate for 4-8 years old
- Focus on the object's distinctive features as described
- Make it consistent with how it appears in the storybook illustrations
${noTextPrompt}
${additionalPrompt ? '\n\n**Additional Requirements:** ' + additionalPrompt : ''}

Create a single, clear object illustration that matches the storybook's visual style.`;
        }
        // 일반 단어인 경우 - 기본 프롬프트
        else {
          console.log(`📝 General word: "${word}" (${korean})`);
          
          prompt = `Create a simple, clear, educational illustration for a children's vocabulary learning card.

**Word to Illustrate:** ${word}${korean ? ` (${korean})` : ''}

**Art Style:** ${artStyle} style for children's book illustration.

**Image Aspect Ratio:** ${aspectRatio}

**Requirements:**
- Show a clear, simple representation of "${word}"
- Clean white background
- Bright, vibrant colors
- Child-friendly, appealing design
- Age-appropriate for 4-8 years old
- Focus on clarity and easy recognition
- The object should be a concrete, tangible noun (not abstract concepts)
${noTextPrompt}
${additionalPrompt ? '\n\n**Additional Requirements:** ' + additionalPrompt : ''}

Create a single, clear image that children can easily understand and associate with the word.`;
        }

        console.log(`Generating vocabulary image for: ${word}${korean ? ` (${korean})` : ''}`);
        const imageUrl = await generateImage(prompt, referenceImages);
        
        images.push({
          word: word,
          korean: korean,
          imageUrl: imageUrl,
          success: true,
          isCharacter: !!matchingCharacter,
          isKeyObject: isKeyObject
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        const word = typeof vocabItem === 'object' ? vocabItem.word : vocabItem;
        console.error(`Error generating image for ${word}:`, error);
        images.push({
          word: word,
          korean: typeof vocabItem === 'object' ? vocabItem.korean : '',
          imageUrl: null,
          success: false,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      images: images,
      total: vocabulary.length,
      successful: images.filter(img => img.success).length
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false,
      error: '단어 이미지 생성 실패: ' + error.message
    });
  }
});

// 퀴즈 생성 API
app.post('/api/generate-quiz', requireAPIKey, async (req, res) => {
  try {
    const { storybook, count = 5 } = req.body;
    
    if (!storybook || !storybook.pages || !storybook.title) {
      return res.status(400).json({
        success: false,
        error: '동화책 데이터가 필요합니다.'
      });
    }
    
    console.log(`\n📝 Generating ${count} quiz questions for: ${storybook.title}`);
    
    // 스토리 텍스트 추출
    const storyText = storybook.pages.map((page, idx) => 
      `페이지 ${idx + 1}: ${page.text}`
    ).join('\n\n');
    
    // 캐릭터 정보 추출
    const characterInfo = storybook.characters ? 
      storybook.characters.map(char => `${char.name}: ${char.role}`).join(', ') : '';
    
    const prompt = `다음 동화책을 읽고 어린이를 위한 독해 퀴즈 ${count}개를 만들어주세요.

**동화 제목:** ${storybook.title}

**캐릭터:** ${characterInfo}

**동화 내용:**
${storyText}

**퀴즈 생성 규칙:**
1. 타깃 연령: ${storybook.targetAge || '6'}세 수준
2. 각 퀴즈는 다음 형식으로 작성:
   - question: 질문 (간단하고 명확하게)
   - options: 4개의 선택지 (배열)
   - answer: 정답 번호 (0, 1, 2, 3 중 하나)
   - explanation: 정답 설명 (왜 이게 정답인지 간단히)
3. 퀴즈 유형을 다양하게:
   - 스토리 순서 (무엇을 먼저 했나요?)
   - 캐릭터 행동 (누가 ~했나요?)
   - 원인과 결과 (왜 ~했나요?)
   - 감정 이해 (어떻게 느꼈을까요?)
   - 교훈 이해 (이 이야기가 알려주는 것은?)
4. 모든 선택지는 그럴듯해야 하지만 명확히 하나만 정답
5. 쉬운 질문부터 조금씩 어려운 질문 순서로

**JSON 형식으로만 응답하세요:**
{
  "quizzes": [
    {
      "question": "질문",
      "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "answer": 0,
      "explanation": "정답 설명"
    }
  ]
}

JSON만 응답하세요. 다른 텍스트는 포함하지 마세요.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await axios.post(url, {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    });

    let quizText = response.data.candidates[0].content.parts[0].text;
    
    // JSON 추출
    quizText = quizText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const quizData = JSON.parse(quizText);
    
    console.log(`✅ Generated ${quizData.quizzes.length} quiz questions`);
    
    res.json({
      success: true,
      quizzes: quizData.quizzes,
      count: quizData.quizzes.length
    });

  } catch (error) {
    console.error('퀴즈 생성 실패:', error);
    res.status(500).json({
      success: false,
      error: '퀴즈 생성 실패: ' + error.message
    });
  }
});

// TTS 생성 API
app.post('/api/generate-tts', requireAPIKey, async (req, res) => {
  try {
    const { text, voiceConfig, model } = req.body;
    
    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: '텍스트가 필요합니다.'
      });
    }
    
    console.log(`\n🎙️ Generating TTS for text: "${text.substring(0, 50)}..."`);
    console.log(`Voice config: ${voiceConfig}`);
    console.log(`Model: ${model}`);
    
    // GoogleGenerativeAI 인스턴스 생성
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // TTS 모델 설정 - Gemini 2.5 Flash TTS
    const ttsModel = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash-preview-tts"
    });
    
    // 음성 이름 (기본값: Puck)
    const voiceName = model || 'Puck';
    
    console.log(`🎵 Using Gemini 2.5 Flash TTS - Voice: ${voiceName}`);
    
    // TTS 요청
    const result = await ttsModel.generateContent({
      contents: [{ 
        role: "user", 
        parts: [{ text: text }] 
      }],
      generationConfig: {
        responseModalities: ['audio'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName
            }
          }
        }
      }
    });
    
    // 오디오 데이터 추출
    const response = await result.response;
    
    if (response && response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];
      
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            // Base64 오디오 데이터를 데이터 URL로 변환
            const mimeType = part.inlineData.mimeType || 'audio/wav';
            const audioUrl = `data:${mimeType};base64,${part.inlineData.data}`;
            
            console.log(`✅ TTS generated successfully (mime: ${mimeType}, size: ${part.inlineData.data.length} bytes)`);
            
            return res.json({
              success: true,
              audioUrl: audioUrl,
              mimeType: mimeType
            });
          }
        }
      }
    }
    
    // 오디오를 찾지 못한 경우
    console.log('Full Gemini response:', JSON.stringify(response, null, 2));
    throw new Error('Gemini TTS API에서 오디오를 찾을 수 없습니다.');
    
  } catch (error) {
    console.error('TTS 생성 실패:', error);
    res.status(500).json({
      success: false,
      error: 'TTS 생성 실패: ' + error.message
    });
  }
});

// 동화책 번역 API
app.post('/api/translate-storybook', requireAPIKey, async (req, res) => {
  try {
    const { storybook, targetLanguage } = req.body;
    
    if (!storybook || !storybook.pages || !targetLanguage) {
      return res.status(400).json({
        success: false,
        error: '동화책 데이터와 타겟 언어가 필요합니다.'
      });
    }
    
    const languageMap = {
      'en': 'English',
      'ja': 'Japanese',
      'zh': 'Chinese',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'vi': 'Vietnamese',
      'th': 'Thai'
    };
    
    const targetLang = languageMap[targetLanguage] || 'English';
    
    console.log(`\n🌍 Translating storybook to ${targetLang}`);
    console.log(`Pages to translate: ${storybook.pages.length}`);
    
    // 모든 페이지의 텍스트를 한 번에 번역
    const pagesText = storybook.pages.map((page, idx) => 
      `[PAGE ${page.pageNumber}]\n${page.text}`
    ).join('\n\n---\n\n');
    
    const prompt = `Translate the following children's storybook to ${targetLang}.

**IMPORTANT TRANSLATION RULES:**
1. Maintain the natural tone and style for children ages ${storybook.targetAge || 4-8}
2. Keep cultural context appropriate for the target language
3. Preserve emotional nuance and storytelling rhythm
4. Keep character names as they are (do not translate proper nouns)
5. Adapt idioms and expressions to be culturally relevant
6. Maintain the same reading level and vocabulary complexity

**STORYBOOK TITLE:**
${storybook.title}

**THEME:**
${storybook.theme || ''}

**PAGES TO TRANSLATE:**
${pagesText}

**RESPOND IN THIS EXACT JSON FORMAT:**
{
  "translatedTitle": "translated title",
  "translatedTheme": "translated theme",
  "translatedPages": [
    {
      "pageNumber": 1,
      "text": "translated text for page 1"
    },
    {
      "pageNumber": 2,
      "text": "translated text for page 2"
    }
  ]
}

**CRITICAL:** Respond ONLY with valid JSON. No markdown, no explanation, just pure JSON.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.4,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192
          }
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    let translationText = data.candidates[0].content.parts[0].text;
    
    // JSON 추출
    translationText = translationText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const translationData = JSON.parse(translationText);
    
    console.log(`✅ Translation complete for ${translationData.translatedPages.length} pages`);
    
    res.json({
      success: true,
      translatedTitle: translationData.translatedTitle,
      translatedTheme: translationData.translatedTheme || storybook.theme,
      translatedPages: translationData.translatedPages
    });

  } catch (error) {
    console.error('번역 실패:', error);
    res.status(500).json({
      success: false,
      error: '번역 실패: ' + error.message
    });
  }
});

// TTS 생성 API
app.post('/api/generate-tts', requireAPIKey, async (req, res) => {
  try {
    const { text, model, voiceConfig } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: '텍스트가 필요합니다.'
      });
    }
    
    console.log(`\n🔊 TTS 생성 시작`);
    console.log(`Model: ${model}`);
    console.log(`Text length: ${text.length}`);
    console.log(`Voice config: ${voiceConfig}`);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `다음 텍스트를 자연스럽게 읽어주세요.

**음성 설정:** ${voiceConfig}

**텍스트:**
${text}`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.8,
            topK: 40,
            topP: 0.95
          }
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`TTS API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // TTS는 오디오 URL을 반환한다고 가정 (실제 구현은 모델에 따라 다름)
    // 여기서는 간단하게 처리
    const audioUrl = data.audioUrl || null;
    
    console.log(`✅ TTS 생성 완료`);
    
    res.json({
      success: true,
      audioUrl: audioUrl
    });

  } catch (error) {
    console.error('TTS 생성 실패:', error);
    res.status(500).json({
      success: false,
      error: 'TTS 생성 실패: ' + error.message
    });
  }
});

// API 키 제공 엔드포인트 (클라이언트에서 직접 Gemini API 호출용)
app.get('/api/config', (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(403).json({
      success: false,
      error: 'API 키가 설정되지 않았습니다.'
    });
  }
  
  res.json({
    success: true,
    apiKey: GEMINI_API_KEY
  });
});

// 메인 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
