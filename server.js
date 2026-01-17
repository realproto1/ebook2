import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

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
      '4-5': { 
        defaultPages: 16,
        wordCount: '1000-1500', 
        sentenceLength: '8-12어절',
        sentenceComplexity: '단순한 문장 구조, 반복적인 패턴',
        vocabulary: '매우 쉬운 일상 단어',
        description: '4-5세: 짧고 반복적인 문장, 의성어/의태어 활용, 단순 명료한 표현'
      },
      '5-7': { 
        defaultPages: 20,
        wordCount: '2000-3000', 
        sentenceLength: '12-18어절',
        sentenceComplexity: '적절한 복문, 인과관계 표현',
        vocabulary: '일상적인 단어와 쉬운 감정 표현',
        description: '5-7세(권장): 논리적 연결, 감정 표현 풍부, 다양한 어휘'
      },
      '7-8': { 
        defaultPages: 24,
        wordCount: '3000-4500', 
        sentenceLength: '18-25어절',
        sentenceComplexity: '복잡한 문장 구조, 은유와 비유 사용',
        vocabulary: '추상적 개념과 고급 어휘',
        description: '7-8세: 복잡한 스토리, 추상적 개념, 교훈적 메시지'
      }
    };
    const settings = ageSettings[targetAge] || ageSettings['5-7'];

    // 페이지 수 결정 (0이면 AI가 자동 결정, 아니면 지정된 수)
    let pageCount;
    let pageInstruction;
    
    if (totalPages === 0 || !totalPages) {
      // AI가 자동으로 적절한 페이지 수 결정
      pageCount = settings.defaultPages;
      pageInstruction = `스토리의 흐름에 맞춰 ${settings.defaultPages - 2}~${settings.defaultPages + 2}페이지 사이에서 적절히 조정하세요`;
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
7. **복선과 회수**: 초반에 제시된 요소들이 후반에 의미 있게 활용되어야 함

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

3. **scene_description은 text와 완벽히 일치**
   - text에 없는 요소를 scene_description에 추가하면 안 됨
   - text의 핵심 장면을 시각적으로 자세히 묘사
   - 예시 텍스트: "왕비는 화가 나서 사냥꾼을 불러 명령했어."
   - 예시 scene_description: "화난 표정의 왕비가 왕좌에 앉아 사냥꾼을 내려다보며 손가락으로 지시하는 장면. 사냥꾼은 고개를 숙이고 있음."

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

다음 형식의 JSON으로 응답해주세요:

{
  "title": "동화책 제목",
  "characters": [
    {
      "name": "캐릭터 이름 (개별 캐릭터로 작성, 복수형 금지, 숫자 붙이지 말 것)",
      "description": "외모와 성격 상세 설명 (한국어, 개별 특징 포함)",
      "role": "주인공/조력자/악역 등"
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
        "atmosphere": "분위기와 감정 (한국어)"
      }
    }
  ],
  "theme": "교훈 및 주제",
  "educational_content": {
    "symbols": ["상징 해석 질문 3-4개"],
    "activity": "창의 활동 아이디어",
    "vocabulary": [
      {"word": "영어명사1", "korean": "한글뜻1"},
      {"word": "영어명사2", "korean": "한글뜻2"},
      {"word": "영어명사3", "korean": "한글뜻3"},
      {"word": "영어명사4", "korean": "한글뜻4"},
      {"word": "영어명사5", "korean": "한글뜻5"},
      {"word": "영어명사6", "korean": "한글뜻6"},
      {"word": "영어명사7", "korean": "한글뜻7"},
      {"word": "영어명사8", "korean": "한글뜻8"}
    ]
  }
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
- **매우 중요**: 각 캐릭터는 구별 가능한 고유 특징을 가져야 합니다 (예: 난쟁이1은 안경, 난쟁이2는 긴 수염)
- **매우 중요**: scene_description은 한국어로 작성하되, 이미지 생성에 필요한 시각적 요소를 자세히 포함하세요
- **매우 중요**: 각 페이지에 scene_structure 객체를 반드시 포함하세요
- **매우 중요**: vocabulary는 반드시 동화 내용과 관련된 구체적인 명사(noun) 8개를 선정하세요 (예: Apple, Tree, Star, Moon, River, Mountain 등)
- **매우 중요**: 각 단어는 {"word": "영어명사", "korean": "한글뜻"} 형식으로 작성하세요

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

장면 예시:
- text: "토끼가 숲에서 당근을 발견했어요" 
- scene_description: "숲속에서 흰 토끼가 오렌지색 당근을 발견하고 깜짝 놀라며 기뻐하는 장면. 토끼의 귀가 쫑긋 서있고 눈이 반짝거립니다."
- scene_structure: {"characters": "흰 토끼가 기쁜 표정으로 당근을 발견함", "background": "초록색 숲속, 햇살이 비치는 낮", "atmosphere": "밝고 즐거운 분위기"}
- vocabulary 예시: [{"word": "Rabbit", "korean": "토끼"}, {"word": "Carrot", "korean": "당근"}, {"word": "Forest", "korean": "숲"}]

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
    const { page, artStyle, characterReferences, settings = {}, editNote = '' } = req.body;
    
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
        '\n\n**Character Consistency - ABSOLUTE REQUIREMENT:** The characters in this scene MUST match EXACTLY the appearance shown in the reference images I provided above with PIXEL-PERFECT accuracy.\n\n' :
        '\n\n**Character Consistency:** The characters in this scene should match the appearance shown in the reference images I provided above.\n\n';
      
      characterInfo = consistencyLevel;
      
      characterReferences.forEach((char, index) => {
        if (char.referenceImage) {
          referenceImages.push(char.referenceImage);
          if (enforceCharacterConsistency) {
            characterInfo += `**Reference Image ${index + 1}:** This is ${char.name}. Copy this character's EXACT appearance with PIXEL-PERFECT accuracy (colors, fur/clothing patterns, facial features, body proportions, eye shape and color, accessories, every single detail) from the reference image.\n`;
          } else {
            characterInfo += `**Reference Image ${index + 1}:** This is ${char.name} - ${char.description}\n`;
          }
        }
      });
      
      if (enforceCharacterConsistency) {
        characterInfo += '\n**ABSOLUTE REQUIREMENT:** Look at the reference images above and recreate each character with PIXEL-PERFECT accuracy. Same colors, same features, same proportions, same EVERYTHING. Do NOT deviate from the reference images by even 1%.';
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
- **Mood & Atmosphere:** ${page.scene_structure.atmosphere}`;
        }
      } else {
        sceneDetails = `\n\n**Scene Structure:**
- **Characters & Actions:** ${page.scene_structure.characters}
- **Background Setting:** ${page.scene_structure.background}  
- **Mood & Atmosphere:** ${page.scene_structure.atmosphere}`;
      }
    }
    
    // 텍스트 제거 강조
    const noTextPrompt = enforceNoText ? 
      '\n\n**CRITICAL - NO TEXT:** Do NOT include ANY text, labels, words, letters, captions, titles, speech bubbles, or text overlays in the image. Absolutely NO TEXT of any kind. Pure illustration only.' : 
      '\n\n**IMPORTANT:** Do NOT include any text, labels, words, letters, or captions in the image. No speech bubbles, no titles, no text overlays. Pure illustration only.';
    
    const prompt = `Create a beautiful, professional illustration for a children's storybook page.

**Main Scene Description:** ${sceneDescriptionEn}
${sceneDetails}
${characterInfo}
${editNoteEn ? `\n\n**Important Modification Request:** ${editNoteEn}` : ''}

**Art Style:** ${artStyle} style for children's book illustration.

**Image Aspect Ratio:** ${aspectRatio}

**Composition:** Create a warm, inviting scene that captures the emotion and action of the story moment. Use a horizontal composition suitable for a storybook spread.

**Lighting & Atmosphere:** Soft, warm lighting with gentle shadows. The scene should feel magical yet safe and welcoming for young children.

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

// 4. 단어 학습용 이미지 생성
app.post('/api/generate-vocabulary-images', requireAPIKey, async (req, res) => {
  try {
    const { vocabulary, artStyle, settings = {} } = req.body;
    
    if (!vocabulary || vocabulary.length === 0) {
      return res.status(400).json({ error: '단어 목록이 필요합니다.' });
    }
    
    const aspectRatio = settings.aspectRatio || '1:1';
    const enforceNoText = settings.enforceNoText !== false;
    const additionalPrompt = settings.additionalPrompt || '';
    
    const images = [];
    
    for (const vocabItem of vocabulary) {
      try {
        // vocabItem이 객체인지 문자열인지 확인
        const word = typeof vocabItem === 'object' ? vocabItem.word : vocabItem;
        const korean = typeof vocabItem === 'object' ? vocabItem.korean : '';
        
        const noTextPrompt = enforceNoText ? 
          '\n\n**CRITICAL - NO TEXT:** Do NOT include ANY text, labels, words, letters, or captions in the image. Absolutely NO TEXT of any kind. Pure illustration only.' :
          '\n\n**IMPORTANT:** Do NOT include any text, labels, words, or letters in the image.';
        
        const prompt = `Create a simple, clear, educational illustration for a children's vocabulary learning card.

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

        console.log(`Generating vocabulary image for: ${word}${korean ? ` (${korean})` : ''}`);
        const imageUrl = await generateImage(prompt);
        
        images.push({
          word: word,
          korean: korean,
          imageUrl: imageUrl,
          success: true
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
