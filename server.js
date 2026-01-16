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
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`, {
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
    const { title, targetAge, artStyle, referenceContent } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: '동화책 제목을 입력해주세요.' });
    }

    // 연령대별 설정
    const ageSettings = {
      '4-5': { wordCount: '400-500', sentenceLength: '5-8', vocabulary: '쉬운' },
      '5-7': { wordCount: '500-800', sentenceLength: '8-12', vocabulary: '보통' },
      '7-8': { wordCount: '800-1000', sentenceLength: '10-15', vocabulary: '다소 어려운' }
    };
    const settings = ageSettings[targetAge] || ageSettings['5-7'];

    // Gemini로 스토리 생성
    const referenceSection = referenceContent ? `

참고할 동화 내용:
${referenceContent}

위 내용을 참고하여 새롭게 재해석하거나 유사한 구조로 창작해주세요.` : '';

    const prompt = `당신은 유아 교육 전문 동화 작가입니다. 다음 조건으로 동화책을 제작해주세요.

제목: "${title}"
타겟 연령: ${targetAge}세
단어 수: ${settings.wordCount}자
문장 길이: ${settings.sentenceLength}어절
어휘 수준: ${settings.vocabulary}${referenceSection}

다음 형식의 JSON으로 응답해주세요:

{
  "title": "동화책 제목",
  "characters": [
    {
      "name": "캐릭터 이름",
      "description": "외모와 성격 상세 설명 (한국어)",
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
- 10-12페이지 분량
- 종결어미: ~했어, ~였어, ~구나 사용
- 밝고 긍정적인 이야기
- **매우 중요**: 캐릭터 description은 한국어로 작성하되, 이미지 생성에 필요한 시각적 요소(색상, 크기, 특징 등)를 자세히 포함하세요
- **매우 중요**: scene_description은 한국어로 작성하되, 이미지 생성에 필요한 시각적 요소를 자세히 포함하세요
- **매우 중요**: 각 페이지에 scene_structure 객체를 반드시 포함하세요
- **매우 중요**: vocabulary는 반드시 동화 내용과 관련된 구체적인 명사(noun) 8개를 선정하세요 (예: Apple, Tree, Star, Moon, River, Mountain 등)
- **매우 중요**: 각 단어는 {"word": "영어명사", "korean": "한글뜻"} 형식으로 작성하세요

예시:
- text: "토끼가 숲에서 당근을 발견했어요" 
- scene_description: "숲속에서 흰 토끼가 오렌지색 당근을 발견하고 깜짝 놀라며 기뻐하는 장면. 토끼의 귀가 쫑긋 서있고 눈이 반짝거립니다."
- scene_structure: {"characters": "흰 토끼가 기쁜 표정으로 당근을 발견함", "background": "초록색 숲속, 햇살이 비치는 낮", "atmosphere": "밝고 즐거운 분위기"}
- vocabulary 예시: [{"word": "Rabbit", "korean": "토끼"}, {"word": "Carrot", "korean": "당근"}, {"word": "Forest", "korean": "숲"}]

JSON만 응답하세요.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
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
    let storyText = data.candidates[0].content.parts[0].text;
    
    // JSON 추출
    storyText = storyText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const storybook = JSON.parse(storyText);
    
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
